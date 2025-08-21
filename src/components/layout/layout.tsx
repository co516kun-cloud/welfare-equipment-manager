import { Outlet } from 'react-router-dom'
import { Header } from './header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ApprovalBanner } from './approval-banner'
import { MobileRefreshFab } from '../mobile-refresh-fab'
import { useState, useEffect } from 'react'
import { useInventoryStore } from '../../stores/useInventoryStore'
// Database initialization is now handled by the useInventoryStore

export function Layout() {
  const [isMobile, setIsMobile] = useState(false)
  const { loadData } = useInventoryStore()

  useEffect(() => {
    const checkMobile = () => {
      try {
        const newIsMobile = window.innerWidth < 768
        if (newIsMobile !== isMobile) {
          console.log('Display mode changed:', newIsMobile ? 'Mobile' : 'Desktop')
          setIsMobile(newIsMobile)
          // 表示モードが変わったときにデータを再読み込み（デバウンス付き）
          setTimeout(() => {
            console.log('Reloading data due to display mode change...')
            loadData()
          }, 500) // 500msに延長してスクロールへの影響を最小化
        }
      } catch (error) {
        console.error('Error checking mobile:', error)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [isMobile]) // loadData依存関係も削除

  useEffect(() => {
    // データベースの初期化とデータの読み込みを一元化
    console.log('Initializing database and loading data...')
    // Sample data initialization is now handled by Supabase
    loadData()
    console.log('Database initialized and data loaded')
  }, [loadData])

  // デバッグ用：強制的にデータを再読み込みする
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        console.log('Force reloading data...')
        // Sample data initialization is now handled by Supabase
        loadData()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loadData])

  if (isMobile) {
    // モバイル専用レイアウト
    return (
      <div className="flex flex-col h-screen bg-background">
        <ApprovalBanner />
        <Header />
        <main className="flex-1 overflow-auto pb-16">
          <Outlet />
        </main>
        <MobileBottomNav />
        {isMobile && <MobileRefreshFab />}
      </div>
    )
  }

  // デスクトップレイアウト（サイドバーなし）
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}