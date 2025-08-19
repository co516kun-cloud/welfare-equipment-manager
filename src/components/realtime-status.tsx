import { useEffect, useState } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'

export function RealtimeStatus() {
  const { 
    isRealtimeEnabled, 
    lastSyncTime, 
    enableRealtime, 
    disableRealtime, 
    forceSync 
  } = useInventoryStore()

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

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return '未同期'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}秒前`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分前`
    } else {
      return date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500'
    if (!isRealtimeEnabled) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (!isOnline) return 'オフライン'
    if (!isRealtimeEnabled) return '同期停止'
    return 'リアルタイム同期中'
  }

  return (
    <div className="flex items-center space-x-2 text-xs">
      {/* ステータスインジケーター */}
      <div className="flex items-center space-x-1">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-muted-foreground">{getStatusText()}</span>
      </div>

      {/* 最終同期時刻 */}
      {isRealtimeEnabled && lastSyncTime && (
        <span className="text-muted-foreground">
          最終同期: {formatLastSync(lastSyncTime)}
        </span>
      )}

      {/* コントロールボタン */}
      <div className="flex space-x-1">
        {isRealtimeEnabled ? (
          <>
            <button
              onClick={forceSync}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              title="手動同期"
            >
              🔄
            </button>
            <button
              onClick={disableRealtime}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
              title="同期停止"
            >
              ⏸️
            </button>
          </>
        ) : (
          <button
            onClick={enableRealtime}
            className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded"
            title="同期開始"
            disabled={!isOnline}
          >
            ▶️
          </button>
        )}
      </div>
    </div>
  )
}