// Test order creation with simplified schema
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOrderCreation() {
  console.log('🧪 Testing order creation with simplified schema...')

  // Create a test order with only the fields that exist
  const testOrder = {
    id: `ORD-${Date.now()}`,
    customer_name: 'テスト顧客様',
    assigned_to: 'USER-1',
    carried_by: 'USER-2',
    status: 'pending'
  }

  console.log('📝 Creating test order:', testOrder)

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([testOrder])
      .select()

    if (error) {
      console.log('❌ Order creation failed:', error.message)
      return false
    }

    console.log('✅ Order created successfully:', data)

    // Now test creating order items
    const testOrderItem = {
      id: `OI-${Date.now()}`,
      order_id: testOrder.id,
      product_id: 'PRD-1',
      quantity: 1,
      approval_status: 'not_required',
      item_processing_status: 'waiting'
    }

    console.log('📝 Creating test order item:', testOrderItem)

    const { data: itemData, error: itemError } = await supabase
      .from('order_items')
      .insert([testOrderItem])
      .select()

    if (itemError) {
      console.log('❌ Order item creation failed:', itemError.message)
    } else {
      console.log('✅ Order item created successfully:', itemData)
    }

    // Test reading back the order
    console.log('📖 Reading back the order...')
    const { data: orderData, error: readError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrder.id)

    if (readError) {
      console.log('❌ Order read failed:', readError.message)
    } else {
      console.log('✅ Order read successfully:', orderData)
    }

    // Clean up
    console.log('🧹 Cleaning up test data...')
    await supabase.from('order_items').delete().eq('order_id', testOrder.id)
    await supabase.from('orders').delete().eq('id', testOrder.id)
    console.log('✅ Test data cleaned up')

    return true

  } catch (err) {
    console.log('❌ Unexpected error:', err.message)
    return false
  }
}

// Test product item status update
async function testProductItemStatusUpdate() {
  console.log('\n🧪 Testing product item status update...')

  try {
    // Get an available product item
    const { data: items, error: itemsError } = await supabase
      .from('product_items')
      .select('*')
      .eq('status', 'available')
      .limit(1)

    if (itemsError || !items || items.length === 0) {
      console.log('❌ No available product items found:', itemsError?.message)
      return false
    }

    const item = items[0]
    console.log('📦 Found available item:', item.id)

    // Update to preparing status
    const { data: updateData, error: updateError } = await supabase
      .from('product_items')
      .update({ status: 'preparing' })
      .eq('id', item.id)
      .select()

    if (updateError) {
      console.log('❌ Status update failed:', updateError.message)
      return false
    }

    console.log('✅ Status updated to preparing:', updateData)

    // Update back to available
    await supabase
      .from('product_items')
      .update({ status: 'available' })
      .eq('id', item.id)

    console.log('✅ Status restored to available')
    return true

  } catch (err) {
    console.log('❌ Status update error:', err.message)
    return false
  }
}

async function main() {
  const orderTest = await testOrderCreation()
  const statusTest = await testProductItemStatusUpdate()

  console.log('\n📊 Test Results:')
  console.log(`Order Creation: ${orderTest ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Status Update: ${statusTest ? '✅ PASS' : '❌ FAIL'}`)

  if (orderTest && statusTest) {
    console.log('\n🎉 All tests passed! The application should work with Supabase.')
    console.log('🌐 Access the app at: http://localhost:5175')
    console.log('🔐 Login with: test@example.com / test123456')
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.')
  }
}

main().catch(console.error)