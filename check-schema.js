// Check current Supabase database schema
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('🔍 Checking current database schema...')
  
  // Check what tables exist
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .neq('table_name', 'schema_migrations')

  if (tableError) {
    console.log('📋 Listing existing tables with simple query...')
    // Try simple table existence check
    const tableChecks = ['users', 'categories', 'products', 'product_items', 'orders', 'order_items']
    for (const tableName of tableChecks) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1)
        if (error) {
          console.log(`❌ Table '${tableName}' does not exist or has error:`, error.message)
        } else {
          console.log(`✅ Table '${tableName}' exists`)
        }
      } catch (err) {
        console.log(`❌ Table '${tableName}' check failed:`, err.message)
      }
    }
  } else {
    console.log('📋 Existing tables:')
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`)
    })
  }

  // Check specific tables and their columns
  console.log('\n🔍 Checking table structures...')
  
  const tablesToCheck = ['orders', 'order_items', 'product_items']
  
  for (const tableName of tablesToCheck) {
    console.log(`\n📋 Checking ${tableName} table structure:`)
    try {
      // Try to get column information
      const { data: columns, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position')

      if (columnError) {
        console.log(`❌ Could not get column info for ${tableName}:`, columnError.message)
        
        // Try to check if table exists by querying it
        try {
          const { data, error } = await supabase.from(tableName).select('*').limit(0)
          if (error) {
            console.log(`❌ Table ${tableName} query failed:`, error.message)
          } else {
            console.log(`✅ Table ${tableName} exists but column info unavailable`)
          }
        } catch (err) {
          console.log(`❌ Table ${tableName} does not exist`)
        }
      } else {
        if (columns && columns.length > 0) {
          console.log(`✅ ${tableName} columns:`)
          columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
          })
        } else {
          console.log(`❌ No columns found for ${tableName}`)
        }
      }
    } catch (err) {
      console.log(`❌ Error checking ${tableName}:`, err.message)
    }
  }
}

checkSchema().catch(console.error)