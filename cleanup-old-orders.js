// Clean up old incomplete orders
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupOldOrders() {
  console.log('🧹 Cleaning up old incomplete orders...')

  try {
    // Get orders that have no order_items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')

    if (ordersError) {
      console.log('❌ Error fetching orders:', ordersError.message)
      return
    }

    console.log(`📋 Found ${orders.length} orders`)

    // Check which orders have no items
    for (const order of orders) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)

      if (itemsError) {
        console.log(`❌ Error checking items for order ${order.id}:`, itemsError.message)
        continue
      }

      if (items.length === 0) {
        console.log(`🗑️ Order ${order.id} has no items, deleting...`)
        
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', order.id)

        if (deleteError) {
          console.log(`❌ Failed to delete order ${order.id}:`, deleteError.message)
        } else {
          console.log(`✅ Deleted incomplete order ${order.id}`)
        }
      } else {
        console.log(`✅ Order ${order.id} has ${items.length} items, keeping`)
      }
    }

    // Reset all product items to available status (for testing)
    console.log('\n🔄 Resetting all product items to available status...')
    const { error: resetError } = await supabase
      .from('product_items')
      .update({ status: 'available' })
      .neq('status', 'available') // Only update items that are not already available

    if (resetError) {
      console.log('❌ Error resetting product statuses:', resetError.message)
    } else {
      console.log('✅ All product items reset to available')
    }

    console.log('\n🎉 Cleanup completed!')

  } catch (error) {
    console.log('❌ Error during cleanup:', error.message)
  }
}

cleanupOldOrders().catch(console.error)