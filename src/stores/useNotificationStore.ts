import { create } from 'zustand'

export type NotificationType = 'preparation' | 'status_anomaly' | 'system' | 'info'
export type NotificationPriority = 'high' | 'medium' | 'low'

export interface Notification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  getUnreadCount: () => number
  checkAndGenerateNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    }
    
    set(state => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }))
  },
  
  markAsRead: (id) => {
    set(state => {
      const notifications = state.notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      )
      const unreadCount = notifications.filter(n => !n.read).length
      return { notifications, unreadCount }
    })
  },
  
  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0
    }))
  },
  
  removeNotification: (id) => {
    set(state => {
      const notification = state.notifications.find(n => n.id === id)
      const notifications = state.notifications.filter(n => n.id !== id)
      const unreadCount = notification && !notification.read 
        ? state.unreadCount - 1 
        : state.unreadCount
      return { notifications, unreadCount }
    })
  },
  
  clearAll: () => {
    set({ notifications: [], unreadCount: 0 })
  },
  
  getUnreadCount: () => {
    return get().notifications.filter(n => !n.read).length
  },
  
  checkAndGenerateNotifications: () => {
    // この関数は定期的に呼び出されて通知を生成します
    // 実装は各ストアのデータを参照して行います
    console.log('Checking for new notifications...')
  }
}))