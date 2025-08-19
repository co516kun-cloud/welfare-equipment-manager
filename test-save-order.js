// Test the saveOrder function with corrected schema
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSaveOrder() {
  console.log('🧪 Testing saveOrder function with corrected schema...')

  const testOrder = {
    id: `TEST-SAVE-${Date.now()}`,
    customer_name: '保存テスト顧客',
    assigned_to: 'USER-1', 
    carried_by: 'USER-2',
    status: 'preparing',
    created_at: new Date().toISOString(),
    items: [
      {
        id: `TEST-ITEM-${Date.now()}-1`,
        product_id: 'PRD-1',
        quantity: 1,
        approval_status: 'not_required',
        item_processing_status: 'preparing'
      }
    ]
  }

  console.log('📝 Test order to save:', testOrder)

  try {
    // 1. Save order (basic info only)
    console.log('\n📋 Step 1: Saving order basic info...')
    const orderData = {
      id: testOrder.id,
      customer_name: testOrder.customer_name,
      assigned_to: testOrder.assigned_to,
      carried_by: testOrder.carried_by,
      status: testOrder.status
    }

    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .upsert([orderData])
      .select()

    if (orderError) {
      console.log('❌ Order save failed:', orderError.message)
      return false
    }

    console.log('✅ Order saved:', orderResult)

    // 2. Save order items
    console.log('\n📦 Step 2: Saving order items...')
    const itemsData = testOrder.items.map(item => ({
      ...item,
      order_id: testOrder.id
    }))

    console.log('Items data to save:', itemsData)

    const { data: itemsResult, error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsData)
      .select()

    if (itemsError) {
      console.log('❌ Order items save failed:', itemsError.message)
      console.log('Error details:', itemsError)
      return false
    }

    console.log('✅ Order items saved:', itemsResult)

    // 3. Verify the save by reading back
    console.log('\n📖 Step 3: Verifying saved data...')
    
    const { data: savedOrder, error: readOrderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrder.id)

    if (readOrderError) {
      console.log('❌ Failed to read back order:', readOrderError.message)
    } else {
      console.log('✅ Order read back:', savedOrder)
    }

    const { data: savedItems, error: readItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', testOrder.id)

    if (readItemsError) {
      console.log('❌ Failed to read back items:', readItemsError.message)
    } else {
      console.log('✅ Items read back:', savedItems)
    }

    // 4. Clean up
    console.log('\n🧹 Step 4: Cleaning up...')
    await supabase.from('order_items').delete().eq('order_id', testOrder.id)
    await supabase.from('orders').delete().eq('id', testOrder.id)
    console.log('✅ Test data cleaned up')

    return true

  } catch (error) {
    console.log('❌ Unexpected error:', error.message)
    return false
  }
}

async function testProductStatusUpdate() {
  console.log('\n🧪 Testing product status update...')

  try {
    // Get an available item
    const { data: availableItems, error } = await supabase
      .from('product_items')
      .select('*')
      .eq('status', 'available')
      .limit(1)

    if (error || !availableItems || availableItems.length === 0) {
      console.log('❌ No available items found')
      return false
    }

    const item = availableItems[0]
    console.log(`📦 Testing with item: ${item.id}`)

    // Update to preparing
    const { error: updateError } = await supabase
      .from('product_items')
      .update({ status: 'preparing' })
      .eq('id', item.id)

    if (updateError) {
      console.log('❌ Status update failed:', updateError.message)
      return false
    }

    console.log('✅ Status updated to preparing')

    // Verify update
    const { data: updatedItem, error: verifyError } = await supabase
      .from('product_items')
      .select('*')
      .eq('id', item.id)

    if (verifyError) {
      console.log('❌ Failed to verify update:', verifyError.message)
      return false
    }

    console.log(`✅ Status verified: ${updatedItem[0].status}`)

    // Restore original status
    await supabase
      .from('product_items')
      .update({ status: 'available' })
      .eq('id', item.id)

    console.log('✅ Status restored to available')

    return true

  } catch (error) {
    console.log('❌ Error in status update test:', error.message)
    return false
  }
}

async function main() {
  const orderTest = await testSaveOrder()
  const statusTest = await testProductStatusUpdate()

  console.log('\n📊 Test Results:')
  console.log(`Order Save: ${orderTest ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Status Update: ${statusTest ? '✅ PASS' : '❌ FAIL'}`)

  if (orderTest && statusTest) {
    console.log('\n🎉 All tests passed! Try the application again.')
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.')
  }
}

main().catch(console.error)