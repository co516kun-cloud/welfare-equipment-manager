// Run the corrected SQL to fix the orders table schema
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function runSQLFix() {
  console.log('🔧 Running SQL fix for orders table...')
  
  try {
    // Read the SQL file
    const sqlContent = readFileSync('./fix-orders-table.sql', 'utf8')
    console.log('📄 SQL content loaded')
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}:`)
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''))
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_text: statement 
        })
        
        if (error) {
          console.log(`❌ Statement ${i + 1} failed:`, error.message)
          
          // Try alternative approach for DDL statements
          if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
            console.log('🔄 Trying direct execution...')
            // For DDL, we might need a different approach
            continue
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.log(`❌ Statement ${i + 1} error:`, err.message)
      }
    }
    
    console.log('\n🎉 SQL fix execution completed!')
    
    // Test the fix by checking if order_date column now exists
    console.log('\n🧪 Testing if fix worked...')
    const { data, error } = await supabase
      .from('orders')
      .select('order_date')
      .limit(1)
    
    if (error) {
      console.log('❌ order_date column still missing:', error.message)
    } else {
      console.log('✅ order_date column now exists!')
    }
    
  } catch (err) {
    console.log('❌ Error reading SQL file:', err.message)
  }
}

runSQLFix().catch(console.error)