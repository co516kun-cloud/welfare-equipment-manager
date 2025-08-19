import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // デバッグモードかチェック
    const isDebugMode = import.meta.env.VITE_SUPABASE_URL?.includes('dummy')
    
    if (isDebugMode) {
      // デバッグモードではローカルストレージから認証状態を取得
      const getDebugSession = () => {
        try {
          const debugUser = localStorage.getItem('auth_user')
          if (debugUser) {
            const userData = JSON.parse(debugUser)
            console.log('🔧 Debug mode: using local auth user:', userData)
            setUser(userData as User)
          } else {
            setUser(null)
          }
          setLoading(false)
        } catch (error) {
          console.error('Debug auth error:', error)
          setUser(null)
          setLoading(false)
        }
      }
      
      getDebugSession()
      return
    }
    
    // 現在の認証状態をチェック
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        setLoading(false)
      } catch (error) {
        console.error('Auth session error:', error)
        setUser(null)
        setLoading(false)
      }
    }

    getSession()

    // 認証状態の変化を監視
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          console.log('Auth state changed:', _event, session?.user?.email)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('Auth subscription error:', error)
      setLoading(false)
    }
  }, [])

  return { user, loading }
}

// ログイン機能
export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    console.error('Login error:', error)
    throw error
  }
  
  return data
}

// サインアップ機能
export const signUp = async (email: string, password: string, name?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0]
      }
    }
  })
  
  if (error) {
    console.error('Signup error:', error)
    throw error
  }
  
  return data
}

// ログアウト機能
export const logout = async () => {
  const isDebugMode = import.meta.env.VITE_SUPABASE_URL?.includes('dummy')
  
  if (isDebugMode) {
    // デバッグモードではローカルストレージから認証情報を削除
    localStorage.removeItem('auth_user')
    window.location.reload()
    return
  }
  
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Logout error:', error)
    throw error
  }
}