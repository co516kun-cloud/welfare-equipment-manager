import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key exists:', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey)
  // 一時的にダミー値を使用してアプリが起動するようにする
}

// 環境変数がない場合はダミーのSupabaseクライアントを作成
export const supabase = createClient(
  supabaseUrl || 'https://dummy.supabase.co', 
  supabaseAnonKey || 'dummy-key'
)

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