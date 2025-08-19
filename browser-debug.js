// ブラウザのコンソールで実行するデバッグスクリプト
// 1. http://localhost:5175 でアプリを開く
// 2. ブラウザの開発者ツールのコンソールタブを開く
// 3. このスクリプト全体をコピー&ペーストして実行

async function debugMyPageIssue() {
  console.log('🔍 マイページ表示問題のデバッグを開始...\n')

  try {
    // supabaseクライアントをグローバルから取得（アプリで使用されているもの）
    const { createClient } = window.supabase || {}
    if (!createClient) {
      console.log('❌ Supabaseクライアントが見つかりません。アプリが正しく読み込まれているか確認してください。')
      return
    }

    const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    // 2. 現在のログインユーザー確認
    console.log('\n2️⃣ 現在のログインユーザー確認:')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.log('❌ エラー:', userError.message)
    } else if (user) {
      console.log(`✅ ログインユーザー: ${user.email}`)
      console.log(`   ユーザーメタデータ:`, user.user_metadata)
    } else {
      console.log('❌ ログインしていません')
    }

    // 3. usersテーブルの内容確認
    console.log('\n3️⃣ usersテーブルの内容確認:')
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

    // 4. 配送対象発注の確認（delivered以外）
    console.log('\n4️⃣ 配送対象発注の確認:')
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .neq('status', 'delivered')

    if (ordersError) {
      console.log('❌ エラー:', ordersError.message)
    } else {
      console.log(`✅ 配送対象発注数: ${orders.length}`)
      orders.forEach(order => {
        console.log(`\n   発注 ${order.id} (${order.status}):`)
        console.log(`     - 担当者: ${order.assigned_to}`)
        console.log(`     - 持出者: ${order.carried_by}`)
        console.log(`     - 顧客: ${order.customer_name}`)
        
        if (order.items) {
          order.items.forEach(item => {
            const assignedCount = item.assigned_item_ids ? item.assigned_item_ids.filter(id => id).length : 0
            console.log(`       商品 ${item.product_id}: 数量=${item.quantity}, 割当済み=${assignedCount}, 処理ステータス=${item.item_processing_status}`)
            if (item.assigned_item_ids) {
              console.log(`         割当ID: [${item.assigned_item_ids.join(', ')}]`)
            }
          })
        }
      })
    }

  } catch (error) {
    console.log('❌ 予期しないエラー:', error.message)
  }
}

// 実行
debugMyPageIssue();