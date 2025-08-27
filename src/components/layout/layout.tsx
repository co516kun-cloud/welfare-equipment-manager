import { Outlet } from 'react-router-dom'
import { Header } from './header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ApprovalBanner } from './approval-banner'
import { useState, useEffect } from 'react'

export function Layout() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      try {
        const newIsMobile = window.innerWidth < 768
        if (newIsMobile !== isMobile) {
          setIsMobile(newIsMobile)
          // 表示モード変更時のデータ再読み込みは削除（不要）
        }
      } catch (error) {
        console.error('Error checking mobile:', error)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [isMobile])

  // 初期化とF5での再読み込みは削除（App.tsxで管理）
  // 手動更新は更新ボタンで行う

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