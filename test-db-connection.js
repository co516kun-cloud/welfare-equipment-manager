// Test Supabase database connection and create sample data
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://libnvrjldpeyftkmnsqx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYm52cmpsZHBleWZ0a21uc3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTk4OTgsImV4cCI6MjA2ODM5NTg5OH0.PdWj9V_znYLRzzT4T8uYOQaqPdVPwZIRq_I4_8-8oIY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('🔗 Testing Supabase connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('categories').select('count')
    if (error) {
      console.error('❌ Connection failed:', error)
      return false
    }
    console.log('✅ Connection successful')
    return true
  } catch (err) {
    console.error('❌ Connection error:', err)
    return false
  }
}

async function createSampleData() {
  console.log('📦 Creating sample data...')
  
  try {
    // Insert categories
    const categories = [
      { id: 'CAT-1', name: '車椅子', description: '手動・電動車椅子各種', icon: '♿' },
      { id: 'CAT-2', name: 'ベッド', description: '介護用ベッド・マットレス', icon: '🛏️' },
      { id: 'CAT-3', name: '歩行器', description: '歩行補助具', icon: '🚶' }
    ]
    
    const { error: catError } = await supabase
      .from('categories')
      .upsert(categories)
    
    if (catError) {
      console.error('❌ Error creating categories:', catError)
      return false
    }
    console.log('✅ Categories created')
    
    // Insert products
    const products = [
      { id: 'PRD-1', name: '標準車椅子', category_id: 'CAT-1', description: '軽量アルミフレーム車椅子', manufacturer: 'メーカーA', model: 'Model-X1' },
      { id: 'PRD-2', name: '電動ベッド', category_id: 'CAT-2', description: '3モーター電動ベッド', manufacturer: 'メーカーB', model: 'Model-Y2' },
      { id: 'PRD-3', name: '四輪歩行器', category_id: 'CAT-3', description: 'ブレーキ付き四輪歩行器', manufacturer: 'メーカーC', model: 'Model-Z3' }
    ]
    
    const { error: prodError } = await supabase
      .from('products')
      .upsert(products)
    
    if (prodError) {
      console.error('❌ Error creating products:', prodError)
      return false
    }
    console.log('✅ Products created')
    
    // Insert product items
    const productItems = [
      { id: 'WC-001', product_id: 'PRD-1', status: 'available', condition: 'excellent', location: '倉庫A-1', qr_code: 'WC-001' },
      { id: 'WC-002', product_id: 'PRD-1', status: 'available', condition: 'good', location: '倉庫A-2', qr_code: 'WC-002' },
      { id: 'BED-001', product_id: 'PRD-2', status: 'available', condition: 'excellent', location: '倉庫B-1', qr_code: 'BED-001' },
      { id: 'WK-001', product_id: 'PRD-3', status: 'available', condition: 'good', location: '倉庫C-1', qr_code: 'WK-001' }
    ]
    
    const { error: itemError } = await supabase
      .from('product_items')
      .upsert(productItems)
    
    if (itemError) {
      console.error('❌ Error creating product items:', itemError)
      return false
    }
    console.log('✅ Product items created')
    
    // Insert users
    const users = [
      { id: 'USER-1', name: '田中太郎', email: 'tanaka@example.com', role: 'staff', department: '営業部' },
      { id: 'USER-2', name: '佐藤花子', email: 'sato@example.com', role: 'manager', department: '管理部' },
      { id: 'USER-3', name: '鈴木次郎', email: 'suzuki@example.com', role: 'staff', department: '配送部' }
    ]
    
    const { error: userError } = await supabase
      .from('users')
      .upsert(users)
    
    if (userError) {
      console.error('❌ Error creating users:', userError)
      return false
    }
    console.log('✅ Users created')
    
    return true
  } catch (err) {
    console.error('❌ Error creating sample data:', err)
    return false
  }
}

async function main() {
  const connected = await testConnection()
  if (connected) {
    await createSampleData()
    console.log('🎉 Setup complete!')
  }
}

main()