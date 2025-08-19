import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from '../layout/layout'
import { Scan } from '../../pages/scan'
import { Inventory } from '../../pages/inventory'
import { Orders } from '../../pages/orders'
import { Preparation } from '../../pages/preparation'
import { History } from '../../pages/history'
import { ItemDetail } from '../../pages/item-detail'
import { MyPage } from '../../pages/mypage'
import { Approval } from '../../pages/approval'
import { AIFeatures } from '../../pages/ai-features-simple'
import { Menu } from '../../pages/menu'
import { Demo } from '../../pages/demo'
import { Deposits } from '../../pages/deposits'
import { ManualImport } from '../../pages/manual-import'

export function DebugApp() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 bg-warning text-warning-foreground mb-4">
        ⚠️ デバッグモード: Supabase設定が正しくないため認証を無効化しています
      </div>
      <Router>
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
            <Route path="manual-import" element={<ManualImport />} />
          </Route>
        </Routes>
      </Router>
    </div>
  )
}