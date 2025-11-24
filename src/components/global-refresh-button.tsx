import { useState } from 'react'
import { Button } from './ui/button'
import { useInventoryStore } from '../stores/useInventoryStore'

interface GlobalRefreshButtonProps {
  className?: string
}

export function GlobalRefreshButton({ className = '' }: GlobalRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { forceSync } = useInventoryStore()

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    
    try {
      // 手動更新を実行
      await forceSync()
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`relative transition-colors ${className} hover:bg-accent`}
    >
      <span className="mr-2">
        {isRefreshing ? '🔄' : '↻'}
      </span>
      更新
      
    </Button>
  )
}