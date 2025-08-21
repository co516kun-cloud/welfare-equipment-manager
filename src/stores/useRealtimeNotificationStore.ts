import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface RealtimeNotificationState {
  // 通知状態
  hasNewChanges: boolean
  changeCount: number
  lastNotificationTime: string | null
  
  // アクション
  setHasNewChanges: (hasChanges: boolean) => void
  incrementChangeCount: () => void
  clearNotifications: () => void
  initializeRealtimeNotifications: () => void
  cleanup: () => void
}

// リアルタイム通知専用ストア（軽量）
export const useRealtimeNotificationStore = create<RealtimeNotificationState>((set, get) => {
  let notificationChannel: any = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 3

  return {
    // 初期状態
    hasNewChanges: false,
    changeCount: 0,
    lastNotificationTime: null,

    setHasNewChanges: (hasChanges: boolean) => {
      set({ hasNewChanges: hasChanges })
    },

    incrementChangeCount: () => {
      set((state) => ({ 
        changeCount: state.changeCount + 1,
        hasNewChanges: true,
        lastNotificationTime: new Date().toISOString()
      }))
    },

    clearNotifications: () => {
      set({ 
        hasNewChanges: false, 
        changeCount: 0,
        lastNotificationTime: null 
      })
    },

    initializeRealtimeNotifications: () => {
      // 既存のチャンネルがあればクリーンアップ
      if (notificationChannel) {
        notificationChannel.unsubscribe()
      }
      
      // 初期化時に再接続回数をリセット（手動呼び出し時）
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts = 0
        console.log('🔄 Manual reconnection attempt - resetting counter')
      }

      // 軽量通知専用チャンネルを作成
      notificationChannel = supabase
        .channel('lightweight-notifications')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'product_items' 
          }, 
          (payload) => {
            // データは同期しない、通知のみ
            get().incrementChangeCount()
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'orders' 
          }, 
          (payload) => {
            // 発注の変更も通知
            get().incrementChangeCount()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Lightweight notification system connected')
            reconnectAttempts = 0 // リセット成功
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Notification channel error')
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++
              console.log(`🔄 Retrying connection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
              setTimeout(() => {
                get().initializeRealtimeNotifications()
              }, 5000)
            } else {
              console.warn('⚠️ Max reconnection attempts reached. Lightweight notifications disabled.')
            }
          }
        })
    },

    cleanup: () => {
      if (notificationChannel) {
        notificationChannel.unsubscribe()
        notificationChannel = null
      }
    }
  }
})