import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xbltuzyazsafxbacrzfs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHR1enlhenNhZnhiYWNyemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjU5NjMsImV4cCI6MjA2ODkwMTk2M30.RwlAsXQ_sj9k9-5Zxs3aP0pC3seKOVe-NVVi-ioSykw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixProductItemsStatus() {
  console.log('🔧 商品アイテムのステータス修正開始...')

  try {
    // 1. BD_001のステータスをpreparingからavailableに修正
    console.log('\n1. BD_001のステータスを修正中...')
    const { error: error1 } = await supabase
      .from('product_items')
      .update({ status: 'available' })
      .eq('id', 'BD_001')
    
    if (error1) {
      console.error('❌ BD_001修正エラー:', error1)
    } else {
      console.log('✅ BD_001: preparing → available')
    }

    // 2. WC_004のステータスをunknownからavailableに修正し、conditionもgoodに設定
    console.log('\n2. WC_004のステータスと状態を修正中...')
    const { error: error2 } = await supabase
      .from('product_items')
      .update({ 
        status: 'available',
        condition: 'good'
      })
      .eq('id', 'WC_004')
    
    if (error2) {
      console.error('❌ WC_004修正エラー:', error2)
    } else {
      console.log('✅ WC_004: unknown → available, condition → good')
    }

    // 3. WK_001もcleaningからavailableに修正（割り当て可能にする）
    console.log('\n3. WK_001のステータスを修正中...')
    const { error: error3 } = await supabase
      .from('product_items')
      .update({ status: 'available' })
      .eq('id', 'WK_001')
    
    if (error3) {
      console.error('❌ WK_001修正エラー:', error3)
    } else {
      console.log('✅ WK_001: cleaning → available')
    }

    // 4. 修正結果の確認
    console.log('\n4. 修正結果の確認...')
    const { data: items, error: fetchError } = await supabase
      .from('product_items')
      .select('*')
      .order('id')
    
    if (fetchError) {
      console.error('❌ データ取得エラー:', fetchError)
      return
    }

    console.log('\n📦 修正後の商品アイテム一覧:')
    console.log('ID\t\tStatus\t\tCondition\tLocation')
    console.log('─'.repeat(60))

    items.forEach(item => {
      const statusIcon = item.status === 'available' ? '✅' : 
                        item.status === 'rented' ? '🔄' :
                        item.status === 'maintenance' ? '🔧' : '❓'
      console.log(`${item.id}\t${item.status}\t\t${item.condition}\t${item.location || '未設定'} ${statusIcon}`)
    })

    // 5. 利用可能な商品の確認
    const availableItems = items.filter(item => item.status === 'available')
    console.log(`\n✅ 利用可能な商品: ${availableItems.length}件`)
    availableItems.forEach(item => {
      console.log(`  - ${item.id} (QR: ${item.qr_code})`)
    })

    console.log('\n🎉 修正完了！管理番号の割り当てが可能になりました。')

  } catch (error) {
    console.error('❌ 修正処理エラー:', error)
  }
}

fixProductItemsStatus()