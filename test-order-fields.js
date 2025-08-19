// Test if the new order fields work correctly
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testNewOrderFields() {
  console.log('🧪 Testing new order fields...')

  const testOrderId = `TEST-FIELDS-${Date.now()}`
  const testOrder = {
    id: testOrderId,
    customer_name: 'フィールドテスト顧客',
    assigned_to: 'USER-1',
    carried_by: 'USER-2',
    status: 'approved',
    order_date: '2025-01-24',
    required_date: '2025-01-31',
    notes: 'テスト備考',
    created_by: 'テストユーザー',
    needs_approval: false
  }

  try {
    // 1. Create order with new fields
    console.log('📝 Creating order with new fields:', testOrder)
    const { data: createData, error: createError } = await supabase
      .from('orders')
      .insert([testOrder])
      .select()

    if (createError) {
      console.log('❌ Order creation failed:', createError.message)
      console.log('❗ You need to run the SQL script first:')
      console.log('   add-missing-order-fields.sql')
      return false
    }

    console.log('✅ Order created successfully:', createData[0])

    // 2. Read back the order
    const { data: readData, error: readError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrderId)

    if (readError) {
      console.log('❌ Failed to read order:', readError.message)
      return false
    }

    console.log('✅ Order read successfully:')
    const order = readData[0]
    console.log(`  - order_date: ${order.order_date}`)
    console.log(`  - required_date: ${order.required_date}`)
    console.log(`  - notes: ${order.notes}`)
    console.log(`  - created_by: ${order.created_by}`)

    // 3. Clean up
    console.log('\n🧹 Cleaning up test data...')
    await supabase.from('orders').delete().eq('id', testOrderId)
    console.log('✅ Test data cleaned up')

    return true

  } catch (error) {
    console.log('❌ Unexpected error:', error.message)
    return false
  }
}

async function main() {
  const success = await testNewOrderFields()

  if (success) {
    console.log('\n🎉 All fields are working correctly!')
    console.log('The preparation screen should now display:')
    console.log('  - 発注日 (order_date)')
    console.log('  - 希望日 (required_date)')
  } else {
    console.log('\n⚠️ Test failed!')
    console.log('Please run the SQL script in Supabase SQL Editor:')
    console.log('  add-missing-order-fields.sql')
  }
}

main().catch(console.error)