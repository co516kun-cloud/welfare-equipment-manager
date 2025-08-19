import { createClient } from '@supabase/supabase-js'

// 環境変数を直接読み込み
const supabaseUrl = 'https://xbltuzyazsafxbacrzfs.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHR1enlhenNhZnhiYWNyemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjU5NjMsImV4cCI6MjA2ODkwMTk2M30.RwlAsXQ_sj9k9-5Zxs3aP0pC3seKOVe-NVVi-ioSykw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('🔄 Supabase接続テスト開始...')
  console.log('URL:', supabaseUrl)
  console.log('Key:', supabaseKey.substring(0, 20) + '...')

  try {
    // 1. 基本的な接続テスト
    console.log('\n1. 基本接続テスト...')
    const { data, error } = await supabase.from('categories').select('count')
    
    if (error) {
      console.error('❌ 接続エラー:', error.message)
      console.error('エラーコード:', error.code)
      console.error('詳細:', error.details)
      
      if (error.code === '42P01') {
        console.log('\n⚠️  テーブルが存在しません。SQLスクリプトを実行してください。')
      }
    } else {
      console.log('✅ 接続成功')
      console.log('categories テーブル:', data)
    }

    // 2. テーブル一覧の取得
    console.log('\n2. テーブル一覧の確認...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      console.error('❌ テーブル一覧取得エラー:', tablesError.message)
    } else {
      console.log('✅ 存在するテーブル:')
      tables.forEach(table => console.log(`  - ${table.table_name}`))
    }

    // 3. 各テーブルの存在確認
    console.log('\n3. 必要なテーブルの存在確認...')
    const requiredTables = ['categories', 'products', 'product_items', 'users', 'orders', 'order_items']
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1)
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`)
        } else {
          console.log(`✅ ${tableName}: OK (${Array.isArray(data) ? data.length : 0} rows visible)`)
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`)
      }
    }

  } catch (error) {
    console.error('❌ 予期しないエラー:', error)
  }
}

testConnection()