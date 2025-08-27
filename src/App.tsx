import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Layout } from './components/layout/layout'
import { Login } from './pages/login'
import { useAuth } from './hooks/useAuth'
import { useInventoryStore } from './stores/useInventoryStore'
import { useRealtimeNotificationStore } from './stores/useRealtimeNotificationStore'
import { DebugApp } from './components/debug/debug-app'
import { Scan } from './pages/scan'
import { Inventory } from './pages/inventory'
import { Orders } from './pages/orders'
import { Preparation } from './pages/preparation'
import { History } from './pages/history'
import { ItemDetail } from './pages/item-detail'
import { MyPage } from './pages/mypage'
import { Approval } from './pages/approval'
import { AIFeatures } from './pages/ai-features-simple'
import { Menu } from './pages/menu'
import { Demo } from './pages/demo'
import { Deposits } from './pages/deposits'
import { ManualImport } from './pages/manual-import'
import { Search } from './pages/search'
import { StockAlert } from './pages/stock-alert'
import { DataImport } from './pages/data-import'
import Notifications from './pages/notifications'
// import { CSVImport } from './pages/csv-import'
// import { Import } from './pages/import' // Disabled due to installation issues

function App() {
  // Supabase環境変数をチェック
  const hasSupabaseConfig = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  
  // フックを条件分岐の前に呼ぶ（Hooks順序の問題を解決）
  const authResult = useAuth()
  const { user, loading } = hasSupabaseConfig ? authResult : { user: null, loading: false }
  
  // データ初期化のための状態
  const [dataInitialized, setDataInitialized] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  
  // ストアの関数を取得
  const { loadInitialData } = useInventoryStore()
  const { initializeRealtimeNotifications, cleanup } = useRealtimeNotificationStore()
  
  // 認証完了後にデータを初期化
  useEffect(() => {
    const initializeApp = async () => {
      // 認証されているユーザーがいて、まだデータ初期化が完了していない場合のみ実行
      if (user && hasSupabaseConfig && !dataInitialized && !dataLoading) {
        setDataLoading(true)
        
        try {
          // シンプルな一括読み込み（カテゴリー分けなし）
          await loadInitialData()
          
          // リアルタイム通知システムを初期化（データ同期はしない軽量版）
          initializeRealtimeNotifications()
          
          setDataInitialized(true)
          
        } catch (error) {
          console.error('❌ App initialization failed:', error)
          // TODO: エラー時のフォールバック処理
        } finally {
          setDataLoading(false)
        }
      }
    }
    
    initializeApp()
  }, [user, hasSupabaseConfig, dataInitialized, dataLoading, loadInitialData, initializeRealtimeNotifications])

  // クリーンアップ処理
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])
  
  // 環境変数がない場合はデバッグモードで起動
  if (!hasSupabaseConfig) {
    console.warn('Supabase環境変数が設定されていません。デバッグモードで起動します。')
    return <DebugApp />
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground font-medium">
            {loading ? '認証確認中...' : '商品データを読み込んでいます...'}
          </p>
          {dataLoading && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                初回読み込みには少し時間がかかります
              </p>
              <p className="text-xs text-muted-foreground">
                約2000件のデータを準備しています
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 認証チェック
  if (!user) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Menu />} />
          <Route path="scan" element={<Scan />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="orders" element={<Orders />} />
          <Route path="preparation" element={<Preparation />} />
          <Route path="history" element={<History />} />
          <Route path="item/:itemId" element={<ItemDetail />} />
          <Route path="approval" element={<Approval />} />
          <Route path="mypage" element={<MyPage />} />
          <Route path="ai-features" element={<AIFeatures />} />
          <Route path="menu" element={<Menu />} />
          <Route path="demo" element={<Demo />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="search" element={<Search />} />
          <Route path="stock-alert" element={<StockAlert />} />
          <Route path="data-import" element={<DataImport />} />
          <Route path="manual-import" element={<ManualImport />} />
          <Route path="notifications" element={<Notifications />} />
          {/* <Route path="csv-import" element={<CSVImport />} />
          <Route path="import" element={<Import />} /> Disabled due to installation issues */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
