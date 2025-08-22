import { useState } from 'react'
import { Button } from './ui/button'
import { useRealtimeNotificationStore } from '../stores/useRealtimeNotificationStore'
import { useInventoryStore } from '../stores/useInventoryStore'

interface GlobalRefreshButtonProps {
  className?: string
}

export function GlobalRefreshButton({ className = '' }: GlobalRefreshButtonProps) {
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
      console.log('🔄 Manual refresh completed (incremental)')
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Button
      variant={hasNewChanges ? "default" : "outline"}
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`relative transition-colors ${className} ${
        hasNewChanges 
          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
          : 'hover:bg-accent'
      }`}
    >
      <span className="mr-2">
        {isRefreshing ? '🔄' : '↻'}
      </span>
      更新
      
      {hasNewChanges && changeCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {changeCount > 99 ? '99+' : changeCount}
        </span>
      )}
    </Button>
  )
}