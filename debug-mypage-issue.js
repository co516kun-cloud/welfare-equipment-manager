// マイページに商品が表示されない問題をデバッグするスクリプト
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugMyPageIssue() {
  console.log('🔍 マイページ表示問題のデバッグを開始...\n')

  try {
    // 1. ready_for_deliveryステータスの商品を確認
    console.log('1️⃣ ready_for_delivery ステータスの商品を確認:')
    const { data: readyItems, error: readyError } = await supabase
      .from('product_items')
      .select('*')
      .eq('status', 'ready_for_delivery')

    if (readyError) {
      console.log('❌ エラー:', readyError.message)
    } else {
      console.log(`✅ ready_for_delivery の商品数: ${readyItems.length}`)
      readyItems.forEach(item => {
        console.log(`   - ${item.id}: customer=${item.customer_name}`)
      })
    }

    // 2. usersテーブルの内容確認
    console.log('\n2️⃣ usersテーブルの内容確認:')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')

    if (usersError) {
      console.log('❌ エラー:', usersError.message)
    } else {
      console.log(`✅ 登録ユーザー数: ${users.length}`)
      users.forEach(user => {
        console.log(`   - ${user.name} (${user.email})`)
      })
    }

    // 3. 承認済み発注の確認
    console.log('\n3️⃣ 承認済み発注の確認:')
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('status', 'approved')

    if (ordersError) {
      console.log('❌ エラー:', ordersError.message)
    } else {
      console.log(`✅ 承認済み発注数: ${orders.length}`)
      orders.forEach(order => {
        console.log(`   発注 ${order.id}:`)
        console.log(`     - 担当者: ${order.assigned_to}`)
        console.log(`     - 持出者: ${order.carried_by}`)
        console.log(`     - アイテム数: ${order.items?.length || 0}`)
        
        if (order.items) {
          order.items.forEach(item => {
            const assignedCount = item.assigned_item_ids ? item.assigned_item_ids.filter(id => id).length : 0
            console.log(`       * 商品ID ${item.product_id}: 数量=${item.quantity}, 割当済み=${assignedCount}, ステータス=${item.item_processing_status}`)
          })
        }
      })
    }

    // 4. ready発注の確認
    console.log('\n4️⃣ ready発注の確認:')
    const { data: readyOrders, error: readyOrdersError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('status', 'ready')

    if (readyOrdersError) {
      console.log('❌ エラー:', readyOrdersError.message)
    } else {
      console.log(`✅ ready発注数: ${readyOrders.length}`)
      readyOrders.forEach(order => {
        console.log(`   発注 ${order.id}:`)
        console.log(`     - 担当者: ${order.assigned_to}`)
        console.log(`     - 持出者: ${order.carried_by}`)
      })
    }

    // 5. マイページ表示条件のシミュレーション
    console.log('\n5️⃣ マイページ表示条件をシミュレーション:')
    
    // すべての発注を取得
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .neq('status', 'delivered')

    if (allOrdersError) {
      console.log('❌ エラー:', allOrdersError.message)
      return
    }

    console.log('\n各営業マンごとの表示対象商品:')
    const salespeople = new Set()
    
    allOrders.forEach(order => {
      if (order.assigned_to) salespeople.add(order.assigned_to)
      if (order.carried_by) salespeople.add(order.carried_by)
    })

    for (const salesperson of salespeople) {
      console.log(`\n👤 ${salesperson}さんの商品:`)
      let itemCount = 0
      
      for (const order of allOrders) {
        if (order.assigned_to === salesperson || order.carried_by === salesperson) {
          if (order.items) {
            for (const item of order.items) {
              if (item.assigned_item_ids && item.assigned_item_ids.length > 0) {
                for (let i = 0; i < item.assigned_item_ids.length; i++) {
                  const assignedItemId = item.assigned_item_ids[i]
                  if (assignedItemId) {
                    // 商品詳細を取得
                    const { data: productItem } = await supabase
                      .from('product_items')
                      .select('*')
                      .eq('id', assignedItemId)
                      .single()

                    if (productItem && productItem.status === 'ready_for_delivery') {
                      itemCount++
                      console.log(`   ✅ ${assignedItemId} (${productItem.status}) - 顧客: ${order.customer_name}`)
                    } else if (productItem) {
                      console.log(`   ❌ ${assignedItemId} (${productItem.status}) - ready_for_deliveryではない`)
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      if (itemCount === 0) {
        console.log(`   表示対象商品なし`)
      }
    }

  } catch (error) {
    console.log('❌ 予期しないエラー:', error.message)
  }
}

debugMyPageIssue().catch(console.error)