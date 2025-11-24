import { useState } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'

interface MobileRefreshFabProps {
  className?: string
}

export function MobileRefreshFab({ className = '' }: MobileRefreshFabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { forceSync } = useInventoryStore()

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    
    try {
      // 手動更新を実行
      await forceSync()
      
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
        bg-white hover:bg-gray-50 text-gray-600 shadow-gray-300/50 border border-gray-200
        ${isRefreshing ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {/* メインアイコン */}
      <span className={`text-lg ${isRefreshing ? 'animate-spin' : ''}`}>
        {isRefreshing ? '🔄' : '↻'}
      </span>
      
    </button>
  )
}