/**
 * 貸与日数修正スクリプト
 *
 * 目的: 貸与中（rented）以外のステータスなのに貸与開始日が残っている商品を修正
 * 処理:
 * 1. loan_start_dateから現在までの日数を計算
 * 2. total_rental_daysに加算
 * 3. loan_start_dateとcustomer_nameをクリア
 *
 * 実行方法:
 * npx ts-node fix-rental-days.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// .envファイルから環境変数を読み込む
dotenv.config()

// Supabase設定
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ エラー: VITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを.envファイルに設定してください')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 貸与日数を計算する関数
function calculateRentalDays(startDate: string, endDate?: string): number {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

interface ProductItem {
  id: string
  status: string
  loan_start_date?: string
  customer_name?: string
  total_rental_days?: number
}

async function fixRentalDays() {
  console.log('🚀 貸与日数修正スクリプト開始...\n')

  try {
    // 1. 貸与中以外で貸与開始日が残っている商品を取得
    const { data: items, error } = await supabase
      .from('product_items')
      .select('id, status, loan_start_date, customer_name, total_rental_days')
      .neq('status', 'rented')
      .not('loan_start_date', 'is', null)

    if (error) {
      console.error('❌ データ取得エラー:', error)
      return
    }

    if (!items || items.length === 0) {
      console.log('✅ 修正が必要な商品はありません')
      return
    }

    console.log(`📦 修正対象の商品: ${items.length}件\n`)

    // 2. 各商品を修正
    let successCount = 0
    let errorCount = 0

    for (const item of items as ProductItem[]) {
      try {
        // 現在の貸与日数を計算
        const rentalDays = item.loan_start_date
          ? calculateRentalDays(item.loan_start_date)
          : 0

        // 累積貸与日数に加算
        const newTotalRentalDays = (item.total_rental_days || 0) + rentalDays

        console.log(`📝 処理中: ${item.id}`)
        console.log(`   ステータス: ${item.status}`)
        console.log(`   顧客名: ${item.customer_name || 'なし'}`)
        console.log(`   貸与開始日: ${item.loan_start_date}`)
        console.log(`   今回の貸与日数: ${rentalDays}日`)
        console.log(`   累積貸与日数: ${item.total_rental_days || 0}日 → ${newTotalRentalDays}日`)

        // データベース更新
        const { error: updateError } = await supabase
          .from('product_items')
          .update({
            total_rental_days: newTotalRentalDays,
            loan_start_date: null,
            customer_name: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)

        if (updateError) {
          console.error(`   ❌ 更新エラー:`, updateError)
          errorCount++
        } else {
          console.log(`   ✅ 更新完了\n`)
          successCount++
        }

      } catch (itemError) {
        console.error(`   ❌ 処理エラー:`, itemError)
        errorCount++
      }
    }

    // 3. 結果サマリー
    console.log('\n' + '='.repeat(50))
    console.log('📊 処理結果')
    console.log('='.repeat(50))
    console.log(`✅ 成功: ${successCount}件`)
    console.log(`❌ 失敗: ${errorCount}件`)
    console.log(`📦 合計: ${items.length}件`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ スクリプト実行エラー:', error)
  }
}

// スクリプト実行
fixRentalDays()
  .then(() => {
    console.log('\n✅ スクリプト完了')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ スクリプト失敗:', error)
    process.exit(1)
  })
