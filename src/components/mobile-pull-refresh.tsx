import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'

interface MobilePullRefreshProps {
  children: ReactNode
  className?: string
}

export function MobilePullRefresh({ children, className = '' }: MobilePullRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [startY, setStartY] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const { forceSync } = useInventoryStore()

  const PULL_THRESHOLD = 80 // プルリフレッシュが発動する距離
  const MAX_PULL_DISTANCE = 120 // 最大プル距離

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!containerRef.current) return
    
    const scrollTop = containerRef.current.scrollTop
    if (scrollTop <= 0) {
      setStartY(e.touches[0].clientY)
      setIsPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || !containerRef.current || isRefreshing) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - startY

    if (deltaY > 0) {
      e.preventDefault()
      const distance = Math.min(deltaY * 0.5, MAX_PULL_DISTANCE)
      setPullDistance(distance)
    }
  }, [isPulling, startY, isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || isRefreshing) return

    setIsPulling(false)

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true)
      
      try {
        // 手動更新を実行
        await forceSync()
        
        // 成功フィードバック
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Error refreshing data:', error)
      } finally {
        setIsRefreshing(false)
      }
    }

    setPullDistance(0)
  }, [isPulling, pullDistance, isRefreshing, forceSync])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const getRefreshIndicatorStyle = () => {
    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
    const opacity = Math.min(pullDistance / 30, 1)
    
    return {
      transform: `translateY(${Math.min(pullDistance, MAX_PULL_DISTANCE)}px)`,
      opacity: opacity
    }
  }

  const getIconRotation = () => {
    if (isRefreshing) return 'animate-spin'
    const rotation = (pullDistance / PULL_THRESHOLD) * 180
    return `rotate-${Math.min(rotation, 180)}`
  }

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ height: '100%' }}
    >
      {/* プルリフレッシュインジケーター */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center py-4 z-10"
        style={{
          ...getRefreshIndicatorStyle(),
          transform: `translateY(${pullDistance - 60}px)`
        }}
      >
        <div className="bg-white/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-gray-200 flex items-center space-x-2">
          <div className={`text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`}>
            {isRefreshing ? '🔄' : pullDistance >= PULL_THRESHOLD ? '↻' : '↓'}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {isRefreshing 
              ? '更新中...' 
              : pullDistance >= PULL_THRESHOLD 
                ? '離して更新' 
                : '下にプル'}
          </span>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div 
        style={{ 
          transform: `translateY(${Math.min(pullDistance * 0.3, MAX_PULL_DISTANCE * 0.3)}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
}