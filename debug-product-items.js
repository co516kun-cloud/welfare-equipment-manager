import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xbltuzyazsafxbacrzfs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHR1enlhenNhZnhiYWNyemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjU5NjMsImV4cCI6MjA2ODkwMTk2M30.RwlAsXQ_sj9k9-5Zxs3aP0pC3seKOVe-NVVi-ioSykw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugProductItems() {
  console.log('🔍 商品アイテムのステータス調査開始...')

  try {
    // 1. 全ての商品アイテムを取得
    const { data: items, error } = await supabase
      .from('product_items')
      .select('*')
      .order('id')
    
    if (error) {
      console.error('❌ 商品アイテム取得エラー:', error)
      return
    }

    console.log(`\n📦 商品アイテム一覧 (${items.length}件):`)
    console.log('ID\t\tProduct ID\tStatus\t\tCondition\tQR Code')
    console.log('─'.repeat(80))

    items.forEach(item => {
      console.log(`${item.id}\t${item.product_id}\t${item.status}\t\t${item.condition}\t${item.qr_code}`)
    })

    // 2. ステータス別の集計
    console.log(`\n📊 ステータス別集計:`)
    const statusCounts = {}
    items.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
    })

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}件`)
    })

    // 3. 利用可能な商品の確認
    const availableItems = items.filter(item => item.status === 'available')
    console.log(`\n✅ 利用可能な商品 (${availableItems.length}件):`)
    availableItems.forEach(item => {
      console.log(`  - ${item.id} (${item.product_id}) - QR: ${item.qr_code}`)
    })

    // 4. 問題のある商品の特定
    const problematicItems = items.filter(item => 
      item.status === 'preparing' || 
      item.status === 'unknown' ||
      !['available', 'rented', 'returned', 'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order'].includes(item.status)
    )
    
    if (problematicItems.length > 0) {
      console.log(`\n⚠️  問題のある商品 (${problematicItems.length}件):`)
      problematicItems.forEach(item => {
        console.log(`  - ${item.id}: status="${item.status}" (予期しないステータス)`)
      })
    }

    // 5. 推奨修正
    console.log('\n🔧 推奨修正:')
    if (problematicItems.length > 0) {
      console.log('以下のクエリで問題のある商品を修正できます:')
      console.log('')
      problematicItems.forEach(item => {
        if (item.status === 'preparing') {
          console.log(`UPDATE product_items SET status = 'available' WHERE id = '${item.id}';`)
        } else if (item.status === 'unknown') {
          console.log(`UPDATE product_items SET status = 'available', condition = 'good' WHERE id = '${item.id}';`)
        }
      })
    } else {
      console.log('すべての商品は適切なステータスです。')
    }

  } catch (error) {
    console.error('❌ エラー:', error)
  }
}

debugProductItems()