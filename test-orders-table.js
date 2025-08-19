// Test orders table structure by attempting queries
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOrdersTable() {
  console.log('🧪 Testing orders table structure...')

  // Test if the table has any data first
  try {
    const { data: allOrders, error: selectError } = await supabase
      .from('orders')
      .select('*')
      .limit(5)

    if (selectError) {
      console.log('❌ Error selecting from orders:', selectError.message)
      return
    }

    console.log('📊 Current orders data:')
    console.log(allOrders)

    if (allOrders && allOrders.length > 0) {
      console.log('\n📋 Available columns in orders table (from existing data):')
      const firstOrder = allOrders[0]
      Object.keys(firstOrder).forEach(column => {
        console.log(`  - ${column}: ${typeof firstOrder[column]} (${firstOrder[column]})`)
      })
    } else {
      console.log('📝 No data in orders table, testing column existence...')
      
      // Test specific columns that caused the error
      const columnsToTest = [
        'id',
        'customer_name', 
        'order_date',  // This was causing the error
        'created_at',
        'status',
        'required_date',
        'assigned_to',
        'carried_by'
      ]
      
      for (const column of columnsToTest) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select(column)
            .limit(1)
          
          if (error) {
            console.log(`❌ Column '${column}' does not exist or has error: ${error.message}`)
          } else {
            console.log(`✅ Column '${column}' exists`)
          }
        } catch (err) {
          console.log(`❌ Column '${column}' test failed: ${err.message}`)
        }
      }
    }

  } catch (err) {
    console.log('❌ General error:', err.message)
  }

  // Test order_items table too
  console.log('\n🧪 Testing order_items table structure...')
  try {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .limit(5)

    if (orderItemsError) {
      console.log('❌ Error selecting from order_items:', orderItemsError.message)
    } else {
      console.log('📊 Current order_items data:')
      console.log(orderItems)
      
      if (orderItems && orderItems.length > 0) {
        console.log('\n📋 Available columns in order_items table:')
        const firstItem = orderItems[0]
        Object.keys(firstItem).forEach(column => {
          console.log(`  - ${column}: ${typeof firstItem[column]}`)
        })
      }
    }
  } catch (err) {
    console.log('❌ order_items error:', err.message)
  }
}

testOrdersTable().catch(console.error)