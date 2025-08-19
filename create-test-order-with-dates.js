// Create a test order with proper date fields to verify the fix
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestOrderWithDates() {
  console.log('📝 Creating test order with proper date fields...')

  const orderId = `ORDER-WITH-DATES-${Date.now()}`
  const testOrder = {
    id: orderId,
    customer_name: '日付テスト顧客',
    assigned_to: 'USER-1',
    carried_by: 'USER-2',
    status: 'approved',
    order_date: '2025-01-24', // 発注日
    required_date: '2025-01-31', // 希望日
    notes: '日付表示のテスト発注',
    created_by: 'テストシステム'
  }

  try {
    // Create order
    console.log('🚀 Creating order:', testOrder)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([testOrder])
      .select()

    if (orderError) {
      console.log('❌ Order creation failed:', orderError.message)
      return false
    }

    console.log('✅ Order created successfully')

    // Create order item
    const testOrderItem = {
      id: `ITEM-${orderId}`,
      order_id: orderId,
      product_id: 'PRD-1',
      quantity: 1,
      approval_status: 'not_required',
      item_processing_status: 'waiting'
    }

    console.log('📦 Creating order item:', testOrderItem)
    const { data: itemData, error: itemError } = await supabase
      .from('order_items')  
      .insert([testOrderItem])
      .select()

    if (itemError) {
      console.log('❌ Order item creation failed:', itemError.message)
      return false
    }

    console.log('✅ Order item created successfully')

    // Verify the data
    console.log('\n🔍 Verifying created data...')
    const { data: verifyData, error: verifyError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)

    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message)
      return false
    }

    const order = verifyData[0]
    console.log('📋 Order verification:')
    console.log(`  - order_date: ${order.order_date}`)
    console.log(`  - required_date: ${order.required_date}`)
    console.log(`  - notes: ${order.notes}`)
    console.log(`  - created_by: ${order.created_by}`)

    console.log('\n🎯 This order should now appear in preparation screen with:')
    console.log(`  - 発注日: ${order.order_date}`)
    console.log(`  - 希望日: ${order.required_date}`)

    return true

  } catch (error) {
    console.log('❌ Unexpected error:', error.message)
    return false
  }
}

async function main() {
  const success = await createTestOrderWithDates()

  if (success) {
    console.log('\n🎉 Test order created successfully!')
    console.log('📱 Check the preparation screen at: http://localhost:5175')
    console.log('🔐 Login with: claude.test@gmail.com / test123456')
    console.log('\nThe test order should now show proper dates.')
  } else {
    console.log('\n❌ Test order creation failed')
  }
}

main().catch(console.error)