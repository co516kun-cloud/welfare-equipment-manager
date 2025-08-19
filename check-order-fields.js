// Check if the new order fields exist in Supabase
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkOrderFields() {
  console.log('🔍 Checking if order fields exist...')

  try {
    // Try to get existing orders and see what fields are available
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .limit(1)

    if (error) {
      console.log('❌ Error fetching orders:', error.message)
      return
    }

    if (orders && orders.length > 0) {
      const order = orders[0]
      console.log('📋 Available fields in orders table:')
      Object.keys(order).forEach(field => {
        console.log(`  ✅ ${field}: ${order[field]}`)
      })

      // Check specifically for the fields we need
      const requiredFields = [
        'order_date',
        'required_date', 
        'notes',
        'created_by',
        'needs_approval',
        'approved_by',
        'approved_date',
        'approval_notes'
      ]

      console.log('\n🎯 Required fields status:')
      const missingFields = []
      
      requiredFields.forEach(field => {
        if (field in order) {
          console.log(`  ✅ ${field}: exists`)
        } else {
          console.log(`  ❌ ${field}: missing`)
          missingFields.push(field)
        }
      })

      if (missingFields.length === 0) {
        console.log('\n🎉 All required fields exist!')
        console.log('You can now test the order creation.')
      } else {
        console.log(`\n⚠️ ${missingFields.length} fields are missing.`)
        console.log('Please run the SQL script: add-missing-order-fields.sql')
      }

    } else {
      console.log('📝 No orders found in database')
      console.log('Cannot check field structure')
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

checkOrderFields().catch(console.error)