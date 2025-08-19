import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xbltuzyazsafxbacrzfs.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHR1enlhenNhZnhiYWNyemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjU5NjMsImV4cCI6MjA2ODkwMTk2M30.RwlAsXQ_sj9k9-5Zxs3aP0pC3seKOVe-NVVi-ioSykw'

console.log('🔧 Headers error debugging - Checking environment variables:')
console.log('URL:', supabaseUrl)
console.log('Key length:', supabaseAnonKey?.length)
console.log('URL contains invalid chars:', /[^\w\-.:\/]/.test(supabaseUrl))
console.log('Key contains invalid chars:', /[^\w\-.]/.test(supabaseAnonKey))

// ヘッダー値の検証
const cleanUrl = supabaseUrl?.trim()
const cleanKey = supabaseAnonKey?.trim()

console.log('🔍 Clean values validation:')
console.log('Clean URL length:', cleanUrl?.length)
console.log('Clean Key length:', cleanKey?.length)
console.log('URLs match:', supabaseUrl === cleanUrl)
console.log('Keys match:', supabaseAnonKey === cleanKey)

// より安全なクライアント作成でHeaders エラーを回避
let supabaseClient: any

try {
  console.log('🚀 Creating Supabase client...')
  
  // 環境変数をクリーンアップ
  const safeUrl = cleanUrl || 'https://dummy.supabase.co'
  const safeKey = cleanKey || 'dummy_key'
  
  console.log('🔧 Using values:', {
    url: safeUrl,
    keyLength: safeKey.length,
    isDummy: safeUrl.includes('dummy') || safeKey.includes('dummy')
  })
  
  supabaseClient = createClient(
    safeUrl,
    safeKey,
    {
      auth: {
        persistSession: false // セッション永続化を無効化
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: {
          'X-Client-Info': 'welfare-equipment-manager'
        }
      }
    }
  )
  
  console.log('✅ Supabase client created successfully')
} catch (error) {
  console.error('❌ Error creating Supabase client:', error)
  
  // フォールバック: 最小設定でクライアントを作成
  supabaseClient = createClient(
    'https://dummy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDk0MjYyNzAsImV4cCI6MTk2NTAwMjI3MH0.dummy',
    {
      auth: { persistSession: false }
    }
  )
  console.log('🔄 Using fallback dummy client')
}

export const supabase = supabaseClient

// Database types
export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category_id: string | null
          description: string | null
          manufacturer: string | null
          model: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          category_id?: string | null
          description?: string | null
          manufacturer?: string | null
          model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category_id?: string | null
          description?: string | null
          manufacturer?: string | null
          model?: string | null
          created_at?: string
        }
      }
      product_items: {
        Row: {
          id: string
          product_id: string | null
          status: string
          condition: string
          location: string | null
          qr_code: string | null
          customer_name: string | null
          loan_start_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id: string
          product_id?: string | null
          status: string
          condition: string
          location?: string | null
          qr_code?: string | null
          customer_name?: string | null
          loan_start_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          status?: string
          condition?: string
          location?: string | null
          qr_code?: string | null
          customer_name?: string | null
          loan_start_date?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          name: string
          email: string
          role: string
          department: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role: string
          department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: string
          department?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_name: string
          assigned_to: string | null
          carried_by: string | null
          status: string
          order_date: string
          required_date: string
          notes: string | null
          created_by: string | null
          needs_approval: boolean | null
          approved_by: string | null
          approved_date: string | null
          approval_notes: string | null
          created_at: string
        }
        Insert: {
          id: string
          customer_name: string
          assigned_to?: string | null
          carried_by?: string | null
          status: string
          order_date: string
          required_date: string
          notes?: string | null
          created_by?: string | null
          needs_approval?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          approval_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_name?: string
          assigned_to?: string | null
          carried_by?: string | null
          status?: string
          order_date?: string
          required_date?: string
          notes?: string | null
          created_by?: string | null
          needs_approval?: boolean | null
          approved_by?: string | null
          approved_date?: string | null
          approval_notes?: string | null
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          assigned_item_ids: string[] | null
          notes: string | null
          item_status: string | null
          needs_approval: boolean | null
          approval_status: string
          approved_by: string | null
          approved_date: string | null
          approval_notes: string | null
          item_processing_status: string
          created_at: string
        }
        Insert: {
          id: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          assigned_item_ids?: string[] | null
          notes?: string | null
          item_status?: string | null
          needs_approval?: boolean | null
          approval_status: string
          approved_by?: string | null
          approved_date?: string | null
          approval_notes?: string | null
          item_processing_status: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          assigned_item_ids?: string[] | null
          notes?: string | null
          item_status?: string | null
          needs_approval?: boolean | null
          approval_status?: string
          approved_by?: string | null
          approved_date?: string | null
          approval_notes?: string | null
          item_processing_status?: string
          created_at?: string
        }
      }
    }
  }
}