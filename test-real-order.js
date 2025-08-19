// Create a real order to test the complete flow with debug logs
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestOrderFlow() {
  console.log('🧪 Creating test order to simulate application behavior...')

  try {
    // Step 1: Create order  
    const orderId = `REAL-TEST-${Date.now()}`
    const order = {
      id: orderId,
      customer_name: 'リアルテスト顧客',
      assigned_to: 'USER-1',
      carried_by: 'USER-2',
      status: 'preparing'
    }

    console.log('📝 Creating order:', order)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([order])
      .select()

    if (orderError) {
      console.log('❌ Order creation failed:', orderError.message)
      return
    }

    console.log('✅ Order created successfully')

    // Step 2: Create order items
    const orderItems = [
      {
        id: `ITEM-${orderId}-1`,
        order_id: orderId,
        product_id: 'PRD-1',
        quantity: 1,
        approval_status: 'not_required',
        item_processing_status: 'preparing'
      }
    ]

    console.log('📦 Creating order items:', orderItems)
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select()

    if (itemsError) {
      console.log('❌ Order items creation failed:', itemsError.message)
      return
    }

    console.log('✅ Order items created successfully')

    // Step 3: Update product item status
    const { data: availableItems, error: availableError } = await supabase
      .from('product_items')
      .select('*')
      .eq('product_id', 'PRD-1')
      .eq('status', 'available')
      .limit(1)

    if (availableError || !availableItems || availableItems.length === 0) {
      console.log('❌ No available items found for PRD-1')
      return
    }

    const itemToUpdate = availableItems[0]
    console.log(`🔄 Updating product item ${itemToUpdate.id} to preparing...`)

    const { error: updateError } = await supabase
      .from('product_items')
      .update({ status: 'preparing' })
      .eq('id', itemToUpdate.id)

    if (updateError) {
      console.log('❌ Product item update failed:', updateError.message)
      return
    }

    console.log('✅ Product item status updated')

    // Step 4: Verify the complete setup
    console.log('\n🔍 Verifying complete setup...')

    // Check order
    const { data: createdOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)

    console.log('📋 Created order:', createdOrder[0])

    // Check order items
    const { data: createdItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    console.log('📦 Created order items:', createdItems)

    // Check updated product item
    const { data: updatedItem } = await supabase
      .from('product_items')
      .select('*')
      .eq('id', itemToUpdate.id)

    console.log('🏷️ Updated product item:', updatedItem[0])

    // Step 5: Test preparation screen logic
    console.log('\n🎯 Testing preparation screen logic...')
    
    const orderWithItems = {
      ...createdOrder[0],
      items: createdItems
    }

    const shouldAppearInPreparation = createdItems.filter(item => {
      const condition1 = item.approval_status === 'not_required' && item.item_processing_status === 'preparing'
      const condition2 = item.approval_status === 'approved' && item.item_processing_status === 'preparing'
      const condition3 = orderWithItems.status === 'preparing' && item.item_processing_status !== 'ready'
      
      const shouldInclude = condition1 || condition2 || condition3
      
      console.log(`📦 Item ${item.id}: approval=${item.approval_status}, processing=${item.item_processing_status}`)
      console.log(`   Conditions: c1=${condition1}, c2=${condition2}, c3=${condition3} -> include=${shouldInclude}`)
      
      return shouldInclude
    })

    console.log(`✅ ${shouldAppearInPreparation.length} items should appear in preparation screen`)

    return {
      orderId,
      orderData: createdOrder[0],
      itemsData: createdItems,
      updatedItemId: itemToUpdate.id
    }

  } catch (error) {
    console.log('❌ Error in test flow:', error.message)
    return null
  }
}

async function cleanupTestOrder(testData) {
  if (!testData) return

  console.log('\n🧹 Cleaning up test order...')

  try {
    // Restore product item status
    await supabase
      .from('product_items')
      .update({ status: 'available' })
      .eq('id', testData.updatedItemId)

    // Delete order items
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', testData.orderId)

    // Delete order
    await supabase
      .from('orders')
      .delete()
      .eq('id', testData.orderId)

    console.log('✅ Test data cleaned up')

  } catch (error) {
    console.log('❌ Error cleaning up:', error.message)
  }
}

async function main() {
  console.log('🎯 Testing real order flow with detailed logging...')
  
  const testData = await createTestOrderFlow()
  
  if (testData) {
    console.log('\n🎉 Test order created successfully!')
    console.log('📱 Now try the following in your browser:')
    console.log('1. Go to http://localhost:5175')
    console.log('2. Login with: claude.test@gmail.com / test123456')
    console.log('3. Try creating an order and watch the browser console')
    console.log('4. Check if items appear in preparation screen')
    console.log('5. Press any key when done to clean up...')

    // Wait a bit, then clean up
    setTimeout(async () => {
      await cleanupTestOrder(testData)
      console.log('\n✅ Test completed and cleaned up')
    }, 60000) // Clean up after 1 minute
    
  } else {
    console.log('❌ Test order creation failed')
  }
}

main().catch(console.error)