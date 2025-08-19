// Debug script to check order flow in detail
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugCurrentState() {
  console.log('🔍 Debugging current database state...')

  // 1. Check orders
  console.log('\n📋 Current Orders:')
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (ordersError) {
    console.log('❌ Error fetching orders:', ordersError.message)
  } else {
    orders.forEach(order => {
      console.log(`  - ${order.id}: ${order.customer_name} (${order.status}) at ${order.created_at}`)
    })
  }

  // 2. Check order items  
  console.log('\n📦 Current Order Items:')
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (itemsError) {
    console.log('❌ Error fetching order items:', itemsError.message)
  } else {
    orderItems.forEach(item => {
      console.log(`  - ${item.id}: Product ${item.product_id}, Qty ${item.quantity}`)
      console.log(`    Approval: ${item.approval_status}, Processing: ${item.item_processing_status}`)
    })
  }

  // 3. Check product items in preparing status
  console.log('\n🔄 Product Items in Preparing Status:')
  const { data: preparingItems, error: preparingError } = await supabase
    .from('product_items')
    .select('*')
    .eq('status', 'preparing')

  if (preparingError) {
    console.log('❌ Error fetching preparing items:', preparingError.message)
  } else {
    if (preparingItems.length === 0) {
      console.log('  No items in preparing status')
    } else {
      preparingItems.forEach(item => {
        console.log(`  - ${item.id}: Product ${item.product_id} (${item.status})`)
      })
    }
  }

  // 4. Check what would be shown in preparation screen
  console.log('\n🎯 Items that should appear in Preparation Screen:')
  
  if (orders.length > 0 && orderItems.length > 0) {
    // Simulate preparation screen logic
    const preparationItems = []
    
    for (const order of orders) {
      if (order.status === 'preparing' || order.status === 'pending') {
        const orderItemsForOrder = orderItems.filter(item => item.order_id === order.id)
        
        for (const item of orderItemsForOrder) {
          // Check if item should appear in preparation screen
          const shouldAppear = (
            (item.approval_status === 'not_required' && item.item_processing_status === 'preparing') ||
            (item.approval_status === 'approved' && item.item_processing_status === 'preparing') ||
            (order.status === 'preparing' && item.item_processing_status !== 'ready')
          )
          
          if (shouldAppear) {
            preparationItems.push({
              orderId: order.id,
              orderCustomer: order.customer_name,
              orderStatus: order.status,
              itemId: item.id,
              productId: item.product_id,
              quantity: item.quantity,
              approvalStatus: item.approval_status,
              processingStatus: item.item_processing_status
            })
          }
        }
      }
    }
    
    if (preparationItems.length === 0) {
      console.log('  ❌ No items would appear in preparation screen')
      console.log('  🔍 Checking why...')
      
      orders.forEach(order => {
        console.log(`    Order ${order.id} status: ${order.status}`)
        const relatedItems = orderItems.filter(item => item.order_id === order.id)
        relatedItems.forEach(item => {
          console.log(`      Item ${item.id}: approval=${item.approval_status}, processing=${item.item_processing_status}`)
          const condition1 = item.approval_status === 'not_required' && item.item_processing_status === 'preparing'
          const condition2 = item.approval_status === 'approved' && item.item_processing_status === 'preparing'
          const condition3 = order.status === 'preparing' && item.item_processing_status !== 'ready'
          console.log(`        Conditions: c1=${condition1}, c2=${condition2}, c3=${condition3}`)
        })
      })
      
    } else {
      console.log(`  ✅ ${preparationItems.length} items would appear:`)
      preparationItems.forEach(item => {
        console.log(`    - Order ${item.orderId} (${item.orderCustomer}): Product ${item.productId}`)
      })
    }
  }
}

async function createTestOrder() {
  console.log('\n🧪 Creating a test order to debug the flow...')

  try {
    // Create test order
    const testOrder = {
      id: `DEBUG-ORD-${Date.now()}`,
      customer_name: 'デバッグテスト顧客',
      assigned_to: 'USER-1',
      carried_by: 'USER-2',
      status: 'preparing'
    }

    console.log('📝 Creating order:', testOrder)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([testOrder])
      .select()

    if (orderError) {
      console.log('❌ Order creation failed:', orderError.message)
      return
    }

    console.log('✅ Order created')

    // Create test order item
    const testOrderItem = {
      id: `DEBUG-ITEM-${Date.now()}`,
      order_id: testOrder.id,
      product_id: 'PRD-1',
      quantity: 1,
      approval_status: 'not_required',
      item_processing_status: 'preparing'
    }

    console.log('📦 Creating order item:', testOrderItem)
    const { data: itemData, error: itemError } = await supabase
      .from('order_items')
      .insert([testOrderItem])
      .select()

    if (itemError) {
      console.log('❌ Order item creation failed:', itemError.message)
      return
    }

    console.log('✅ Order item created')

    // Check if it would appear in preparation screen
    console.log('\n🎯 Checking if this order would appear in preparation screen...')
    
    const shouldAppear = (
      (testOrderItem.approval_status === 'not_required' && testOrderItem.item_processing_status === 'preparing') ||
      (testOrderItem.approval_status === 'approved' && testOrderItem.item_processing_status === 'preparing') ||
      (testOrder.status === 'preparing' && testOrderItem.item_processing_status !== 'ready')
    )

    console.log(`Should appear: ${shouldAppear}`)
    console.log(`  - approval_status: ${testOrderItem.approval_status}`)
    console.log(`  - item_processing_status: ${testOrderItem.item_processing_status}`)
    console.log(`  - order status: ${testOrder.status}`)

    // Clean up
    console.log('\n🧹 Cleaning up test data...')
    await supabase.from('order_items').delete().eq('id', testOrderItem.id)
    await supabase.from('orders').delete().eq('id', testOrder.id)
    console.log('✅ Test data cleaned up')

  } catch (error) {
    console.log('❌ Error in test order creation:', error.message)
  }
}

async function main() {
  await debugCurrentState()
  await createTestOrder()
  
  console.log('\n📱 Instructions:')
  console.log('1. Go to http://localhost:5175')
  console.log('2. Login with: claude.test@gmail.com / test123456')
  console.log('3. Try creating an order and watch browser console')
  console.log('4. Check if popup appears and if items show in preparation screen')
}

main().catch(console.error)