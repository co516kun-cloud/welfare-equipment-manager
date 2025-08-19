import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/layout'
import { Login } from './pages/login'
import { useAuth } from './hooks/useAuth'
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
// import { CSVImport } from './pages/csv-import'
// import { Import } from './pages/import' // Disabled due to installation issues

function App() {
  // Supabase環境変数をチェック
  const hasSupabaseConfig = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  
  // フックを条件分岐の前に呼ぶ（Hooks順序の問題を解決）
  const authResult = hasSupabaseConfig ? useAuth() : { user: null, loading: false }
  const { user, loading } = authResult
  
  // 環境変数がない場合はデバッグモードで起動
  if (!hasSupabaseConfig) {
    console.warn('Supabase環境変数が設定されていません。デバッグモードで起動します。')
    return <DebugApp />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 認証を一時的にバイパス（本番テスト用）
  // if (!user) {
  //   return <Login />
  // }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MyPage />} />
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
          {/* <Route path="csv-import" element={<CSVImport />} />
          <Route path="import" element={<Import />} /> Disabled due to installation issues */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
