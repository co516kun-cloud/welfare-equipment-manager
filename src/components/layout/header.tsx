import { Button } from '../ui/button'
import { useState, useEffect } from 'react'
import { useAuth, logout } from '../../hooks/useAuth'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { canGoBackInApp } from '../../lib/history-nav'
import { useGoBack } from '../../hooks/useGoBack'
import { useNotificationStore } from '../../stores/useNotificationStore'
import { generateNotifications } from '../../lib/notification-generator'
import { GlobalRefreshButton } from '../global-refresh-button'
import { useInventoryStore } from '../../stores/useInventoryStore'

export function Header() {
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { unreadCount } = useNotificationStore()
  // 戻り先が無ければトップへ。トップは PC ならメニュー、モバイルならマイページ
  const goBack = useGoBack('/')
  
  // 手動更新用の状態
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { forceSync } = useInventoryStore()
  
  // 定期的に通知をチェック（5分ごと）
  useEffect(() => {
    generateNotifications() // 初回実行
    const interval = setInterval(() => {
      generateNotifications()
    }, 5 * 60 * 1000) // 5分
    
    return () => clearInterval(interval)
  }, [])
  
  // 手動更新のハンドラー
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

  const handleLogout = async () => {
    try {
      await logout()
      // ログアウト後は自動的にログイン画面に戻る
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // メニュー画面かどうかをチェック
  //
  // 2026-09-07 に PC のトップ(/)をメニュー画面にしたので、PC ではメニューのURLが
  // / と /menu の2つある。/ を「メニューではない」と扱うと ☰ が出てしまい、押すと
  // 見た目の同じ /menu が履歴に積まれる。戻っても画面が変わらないので
  // 「戻りすぎる」「戻っても戻れない」ように見えていた。
  const isMenuPage = location.pathname === '/menu' || (!isMobile && location.pathname === '/')

  // メニューへ行くときの行き先。PC はトップがメニューなので / を使い、URLを一本化する
  const menuHref = isMobile ? '/menu' : '/'

  // 戻り先がアプリ内にあるか。無いのに「戻る」を出すと押しても何も起きない
  const canGoBack = canGoBackInApp(typeof window !== 'undefined' ? window.history.state : null)

  // モバイルメニューの項目
  const mobileMenuItems = [
    { name: '商品検索', href: '/search', icon: '🔍' },
    { name: '履歴管理', href: '/history', icon: '📈' },
    { name: 'デモ管理', href: '/demo', icon: '🎯' },
    { name: '預かり物', href: '/deposits', icon: '📦' },
  ]

  // メニュー項目をタップした時の処理
  const handleMenuItemClick = (href: string) => {
    setShowMobileMenu(false)
    navigate(href)
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // モバイルメニューを閉じる（背景タップ時）
  const closeMobileMenu = () => {
    setShowMobileMenu(false)
  }

  // ドロワーメニューをbodyに追加（ポータル風）- モバイルでのみ適用
  useEffect(() => {
    if (isMobile && showMobileMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    // クリーンアップ
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showMobileMenu, isMobile])

  if (isMobile) {
    // モバイル用ヘッダー
    return (
      <header className="bg-gradient-to-r from-slate-900/95 via-cyan-900/90 to-indigo-900/95 backdrop-blur-xl border-b border-cyan-400/40 sticky top-0 z-50 shadow-lg">
        <div className="flex h-14 items-center px-4">
          {/* メニューボタンまたは戻るボタン */}
          <div className="flex items-center mr-3">
            {isMenuPage ? (
              // 以前は行き先が /mypage 固定で、どこから来てもマイページへ飛んでいた
              canGoBack ? (
                <Button variant="ghost" size="sm" className="p-2 text-white hover:bg-white/10" onClick={goBack}>
                  <span className="text-xl">←</span>
                </Button>
              ) : (
                <div className="w-9" aria-hidden="true" />
              )
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2 text-white hover:bg-white/10"
                onClick={() => setShowMobileMenu(true)}
              >
                <span className="text-xl">☰</span>
              </Button>
            )}
          </div>
          
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">福</span>
              </div>
              <h1 className="text-lg font-semibold text-white">福祉用具管理</h1>
            </div>
          </div>
          
          {/* 手動更新ボタン */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white p-2 relative hover:bg-white/10 mr-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <span className={`text-lg ${isRefreshing ? 'animate-spin' : ''}`}>
              {isRefreshing ? '🔄' : '↻'}
            </span>
          </Button>
          
          {/* 通知ボタン */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white p-2 relative hover:bg-white/10"
            onClick={() => navigate('/notifications')}
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold shadow-md">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </div>
        
        {/* モバイルドロワーメニュー */}
        {showMobileMenu && (
          <div 
            className="fixed inset-0"
            style={{ 
              zIndex: 99999,
              position: 'fixed !important',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          >
            {/* 背景オーバーレイ */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={closeMobileMenu}
              style={{ 
                zIndex: 99998,
                position: 'absolute !important',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            />
            
            {/* ドロワー */}
            <div 
              className="absolute top-0 left-0 h-full w-80 bg-white shadow-2xl overflow-hidden"
              style={{ 
                zIndex: 99999,
                position: 'absolute !important',
                top: 0,
                left: 0,
                height: '100vh',
                width: '320px',
                backgroundColor: 'white !important'
              }}
            >
              <div className="h-full flex flex-col bg-white">
                {/* ドロワーヘッダー */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                        <span className="text-white font-bold">福</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">メニュー</h2>
                        <p className="text-sm text-slate-300">機能を選択してください</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={closeMobileMenu}
                      className="p-2 hover:bg-white/10 text-white"
                    >
                      <span className="text-xl">×</span>
                    </Button>
                  </div>
                </div>
                
                {/* メニュー項目 */}
                <div className="flex-1 p-6 bg-white overflow-y-auto">
                  <div className="space-y-4">
                    {mobileMenuItems.map((item) => (
                      <button
                        key={item.href}
                        onClick={() => handleMenuItemClick(item.href)}
                        className="w-full flex items-center space-x-4 p-4 rounded-xl bg-gray-50 hover:bg-blue-50 hover:shadow-md transition-all duration-200 text-left group border border-gray-100 hover:border-blue-200"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                          <span className="text-xl text-white">{item.icon}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{item.name}</h3>
                          <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
                            {item.name === '商品検索' && '商品の詳細検索'}
                            {item.name === '履歴管理' && '取引履歴・分析'}
                            {item.name === 'デモ管理' && 'デモ商品管理'}
                            {item.name === '預かり物' && '預かり物管理'}
                          </p>
                        </div>
                        <div className="ml-auto opacity-40 group-hover:opacity-100 transition-opacity">
                          <span className="text-gray-400 group-hover:text-blue-500 text-lg">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* フッター */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">福祉用具管理システム v2.0</p>
                    <p className="text-xs text-gray-400 mt-1">Powered by Modern Web Technology</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
    )
  }

  // デスクトップ用ヘッダー（メニューボタン付き）
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6">
        {/* メニューボタンまたは戻るボタン */}
        <div className="flex items-center mr-4">
          {isMenuPage ? (
            // 以前は行き先が /mypage 固定。PC はトップがメニューなので、
            // メニューで「戻る」を押すとマイページに飛ぶのが「変なとこへ飛ぶ」の正体だった
            canGoBack ? (
              <Button variant="ghost" size="sm" className="p-2" onClick={goBack}>
                <span className="text-xl">←</span>
                <span className="ml-2 text-sm">戻る</span>
              </Button>
            ) : (
              <div className="w-[104px]" aria-hidden="true" />
            )
          ) : (
            <Link to={menuHref}>
              <Button variant="ghost" size="sm" className="p-2">
                <span className="text-xl">☰</span>
                <span className="ml-2 text-sm">メニュー</span>
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center space-x-4 flex-1">
          <h1 className="text-lg font-semibold text-foreground">福祉用具管理システム</h1>
        </div>
        <div className="flex items-center space-x-4">
          <GlobalRefreshButton />
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-warning"
            onClick={() => navigate('/notifications')}
          >
            <span className="mr-2">🔔</span>
            通知 
            {unreadCount > 0 && (
              <span className="ml-1 bg-warning text-warning-foreground px-1.5 py-0.5 rounded-full text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          {user && (
            <>
              <span className="text-sm text-muted-foreground">
                {user.user_metadata?.name || user.email?.split('@')[0] || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                ログアウト
              </Button>
            </>
          )}
          {!user && !loading && (
            <Button variant="outline" size="sm">
              ログイン
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}