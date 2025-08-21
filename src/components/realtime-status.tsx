import { useEffect, useState } from 'react'
import { useRealtimeNotificationStore } from '../stores/useRealtimeNotificationStore'

export function RealtimeStatus() {
  const { hasNewChanges, changeCount } = useRealtimeNotificationStore()

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'
    if (hasNewChanges) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (!isOnline) return 'オフライン'
    if (hasNewChanges) return `${changeCount}件の変更`
    return '軽量通知中'
  }

  return (
    <div className="flex items-center space-x-2 text-xs">
      {/* ステータスインジケーター */}
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-muted-foreground">{getStatusText()}</span>
      </div>

      {/* 軽量通知システムの説明 */}
      <span className="text-muted-foreground text-xs">
        Realtime synchronization is temporarily disabled
      </span>
    </div>
  )
}