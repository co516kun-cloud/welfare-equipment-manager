// Add missing columns to orders table using direct SQL
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to orders table...')
  
  // Since we can't execute DDL statements directly through the Supabase client,
  // let's verify what we need and create a workaround
  
  console.log('✅ Step 1: The missing columns need to be added manually via Supabase dashboard')
  console.log('🔗 Please go to: https://libnvrjldpeyftkmnsqx.supabase.co/project/libnvrjldpeyftkmnsqx/editor')
  console.log('\n📋 SQL commands to run in Supabase SQL Editor:')
  
  const sqlCommands = [
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS required_date DATE;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by TEXT;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT FALSE;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by TEXT;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_date DATE;',
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_notes TEXT;'
  ]
  
  sqlCommands.forEach((cmd, index) => {
    console.log(`${index + 1}. ${cmd}`)
  })
  
  console.log('\n⚠️  Please run these commands in the Supabase SQL Editor, then press Enter to continue...')
  
  // Wait for user input (simulated)
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  console.log('\n🧪 Testing if columns were added...')
  
  // Test each column
  const columnsToTest = [
    'order_date',
    'required_date', 
    'notes',
    'created_by',
    'needs_approval',
    'approved_by',
    'approved_date',
    'approval_notes'
  ]
  
  for (const column of columnsToTest) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(column)
        .limit(1)
      
      if (error) {
        console.log(`❌ Column '${column}' missing: ${error.message}`)
      } else {
        console.log(`✅ Column '${column}' exists`)
      }
    } catch (err) {
      console.log(`❌ Column '${column}' test failed: ${err.message}`)
    }
  }
  
  // If all columns exist, try to insert a test order
  console.log('\n🧪 Attempting to create a test order...')
  try {
    const testOrder = {
      id: `TEST-${Date.now()}`,
      customer_name: 'テスト顧客',
      status: 'pending',
      order_date: new Date().toISOString().split('T')[0],
      required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assigned_to: 'USER-1',
      carried_by: 'USER-2',
      notes: 'テスト発注',
      created_by: 'test@example.com',
      needs_approval: false
    }
    
    const { data, error } = await supabase
      .from('orders')
      .insert([testOrder])
      .select()
    
    if (error) {
      console.log('❌ Test order creation failed:', error.message)
    } else {
      console.log('✅ Test order created successfully:', data)
      
      // Clean up test order
      await supabase.from('orders').delete().eq('id', testOrder.id)
      console.log('🧹 Test order cleaned up')
    }
  } catch (err) {
    console.log('❌ Test order error:', err.message)
  }
}

addMissingColumns().catch(console.error)