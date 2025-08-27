import { useState } from 'react'
import { useRealtimeNotificationStore } from '../stores/useRealtimeNotificationStore'
import { useInventoryStore } from '../stores/useInventoryStore'

interface MobileRefreshFabProps {
  className?: string
}

export function MobileRefreshFab({ className = '' }: MobileRefreshFabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { hasNewChanges, changeCount, clearNotifications } = useRealtimeNotificationStore()
  const { loadIncrementalUpdates } = useInventoryStore()

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    
    try {
      // 差分更新を実行
      await loadIncrementalUpdates()
      clearNotifications()
      
      // 成功フィードバック
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`
        fixed top-20 right-4 z-40
        w-12 h-12 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 hover:scale-110 active:scale-95
        ${hasNewChanges 
          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30' 
          : 'bg-white hover:bg-gray-50 text-gray-600 shadow-gray-300/50 border border-gray-200'
        }
        ${isRefreshing ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {/* メインアイコン */}
      <span className={`text-lg ${isRefreshing ? 'animate-spin' : ''}`}>
        {isRefreshing ? '🔄' : '↻'}
      </span>
      
      {/* 通知バッジ */}
      {hasNewChanges && changeCount > 0 && !isRefreshing && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full min-w-[18px] text-center shadow-lg">
          {changeCount > 99 ? '99+' : changeCount}
        </span>
      )}
      
      {/* プルス効果（新しい変更がある場合） */}
      {hasNewChanges && !isRefreshing && (
        <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
      )}
    </button>
  )
}