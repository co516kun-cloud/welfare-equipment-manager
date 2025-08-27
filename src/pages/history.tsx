import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useState, useEffect } from 'react'
import { supabaseDb } from '../lib/supabase-database'
import type { ItemHistory, ProductItem, Product } from '../types'

export function History() {
  const [histories, setHistories] = useState<ItemHistory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [filters, setFilters] = useState({
    fromStatus: '',
    toStatus: '',
    month: '', // 初期状態では全ての月を表示
    year: '', // 初期状態では全ての年を表示
    itemId: '',
    action: ''
  })
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [selectedHistories, setSelectedHistories] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [itemsPerPage] = useState(isMobile ? 20 : 50)

  // 安全なモバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 履歴ページ用の初回データロード
  useEffect(() => {
    loadProducts()
    loadHistories()
  }, [])

  // フィルターまたはページが変更された時のデータ再読み込み
  useEffect(() => {
    loadHistories()
  }, [filters, currentPage, itemsPerPage])

  const loadProducts = async () => {
    try {
      // 履歴ページでは商品マスタと商品アイテム両方が必要（商品名表示のため）
      const allProducts = await supabaseDb.getProducts()
      const allProductItems = await supabaseDb.getProductItems()
      setProducts(allProducts)
      setProductItems(allProductItems)
      console.log(`✅ Loaded ${allProducts.length} products and ${allProductItems.length} product items for history page`)
    } catch (error) {
      console.error('❌ Error loading product data:', error)
    }
  }

  const loadHistories = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Loading paginated history data...', { 
        page: currentPage, 
        limit: itemsPerPage,
        filters 
      })

      const filterParams = {
        fromStatus: filters.fromStatus || undefined,
        year: filters.year ? parseInt(filters.year.toString()) : undefined,
        month: filters.month ? parseInt(filters.month.toString()) : undefined,
        itemId: filters.itemId || undefined,
        action: filters.action || undefined
      }

      const result = await supabaseDb.getItemHistoriesPaginated(
        currentPage,
        itemsPerPage,
        filterParams
      )
      
      console.log('📊 Loaded paginated data:', {
        histories: result.data.length,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage
      })
      
      setHistories(result.data)
      setTotalCount(result.totalCount)
      setTotalPages(result.totalPages)
      setCurrentPage(result.currentPage)
    } catch (error) {
      console.error('❌ Error loading paginated history data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // フィルター変更時に1ページ目に戻す
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setCurrentPage(1) // フィルター変更時は1ページ目に戻す
  }

  // ページ変更処理
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getActionIcon = (action: string) => {
    if (action.includes('返却')) return '📦'
    if (action.includes('貸与')) return '🏠'
    if (action.includes('消毒')) return '🧽'
    if (action.includes('メンテナンス')) return '🔧'
    if (action.includes('入庫')) return '📥'
    if (action.includes('デモ')) return '🎯'
    if (action.includes('キャンセル')) return '❌'
    return '📋'
  }

  const getProductName = (itemId: string) => {
    // item_idから商品アイテムを見つけて、そのproduct_idから商品名を取得
    const productItem = productItems.find(item => item.id === itemId)
    if (productItem) {
      const product = products.find(p => p.id === productItem.product_id)
      if (product) return product.name
    }
    
    // metadataにproductIdがある場合の処理
    const history = histories.find(h => h.item_id === itemId)
    if (history && history.metadata?.productId) {
      const product = products.find(p => p.id === history.metadata.productId)
      if (product) return product.name
    }
    
    return 'Unknown Product'
  }

  const shouldShowCustomerName = (action: string) => {
    return action.includes('貸与') || 
           action.includes('返却') || 
           action.includes('デモキャンセル') ||
           action.includes('準備完了') ||
           action.includes('配送完了') ||
           action.includes('代理配送') ||
           action.includes('割り当て') ||
           action.includes('キャンセル')
  }

  const getCustomerName = (history: ItemHistory) => {
    if (!shouldShowCustomerName(history.action)) {
      return '-'
    }
    
    
    // 顧客名を取得
    return history.customer_name || 
           (history.location && history.location.includes('様') ? 
             history.location.replace('宅', '').replace('様', '') : null) ||
           '-'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'ready_for_delivery': return 'bg-info text-info-foreground'
      case 'rented': return 'bg-warning text-warning-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-blue-100 text-blue-700'
      case 'maintenance': return 'bg-orange-100 text-orange-700'
      case 'demo_cancelled': return 'bg-purple-100 text-purple-700'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-gray-100 text-gray-700'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'ready_for_delivery': return '配送準備完了'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '清掃中'
      case 'maintenance': return 'メンテナンス中'
      case 'demo_cancelled': return 'デモキャンセル'
      case 'out_of_order': return '故障中'
      case 'unknown': return '状態不明'
      default: return status
    }
  }

  const clearFilters = () => {
    const newFilters = {
      fromStatus: '',
      toStatus: '',
      month: '', // 全ての月を表示
      year: '', // 全ての年を表示
      itemId: '',
      action: ''
    }
    setFilters(newFilters)
    setCurrentPage(1) // フィルタークリア時も1ページ目に戻す
  }

  // 履歴選択関連の関数
  const handleSelectHistory = (historyId: string) => {
    const newSelected = new Set(selectedHistories)
    if (newSelected.has(historyId)) {
      newSelected.delete(historyId)
    } else {
      newSelected.add(historyId)
    }
    setSelectedHistories(newSelected)
  }
  
  const handleSelectAll = () => {
    if (selectedHistories.size === histories.length && histories.length > 0) {
      // 全選択解除
      setSelectedHistories(new Set())
    } else {
      // 全選択（現在のページのみ）
      const allIds = new Set(histories.map(h => h.id))
      setSelectedHistories(allIds)
    }
  }
  
  const handleDeleteSelected = () => {
    if (selectedHistories.size > 0) {
      setShowDeleteDialog(true)
    }
  }
  
  const confirmDeleteHistories = async () => {
    try {
      // 選択された履歴を削除
      for (const historyId of selectedHistories) {
        await supabaseDb.deleteItemHistory(historyId)
      }
      
      // データを再読み込み
      await loadHistories()
      
      // 選択状態をクリア
      setSelectedHistories(new Set())
      setShowDeleteDialog(false)
      
      alert(`${selectedHistories.size}件の履歴を削除しました`)
    } catch (error) {
      console.error('Error deleting histories:', error)
      alert('履歴の削除中にエラーが発生しました')
    }
  }

  const exportData = () => {
    const csvData = [
      ['日時', '商品名', '管理番号', 'アクション', '顧客名', 'ステータス', '実行者', '備考'],
      ...histories.map(h => [
        new Date(h.timestamp).toLocaleString('ja-JP'),
        getProductName(h.item_id),
        h.item_id,
        h.action,
        getCustomerName(h),
        getStatusText(h.to_status),
        h.performed_by,
        h.notes || ''
      ])
    ]

    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `履歴_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ページネーションコンポーネント
  const PaginationControls = () => {
    const maxVisiblePages = 5
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

    return (
      <div className="flex items-center justify-between mt-6 px-4">
        <div className="text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>
              {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} 件 / 全 {totalCount} 件
            </>
          ) : (
            '0 件'
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              前へ
            </Button>
            
            {pages.map(page => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                disabled={isLoading}
                className={`w-10 ${page === currentPage ? 'bg-primary' : ''}`}
              >
                {page}
              </Button>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    )
  }

  // モバイル版UIコンポーネント
  const MobileHistoryUI = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      {/* ヘッダー */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-slate-800">履歴管理</h1>
          <div className="flex items-center space-x-2">
            <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {totalCount}
            </div>
            {isLoading && (
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-600">システム操作履歴</p>
      </div>

      {/* 簡易フィルター */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mobile-month" className="text-xs text-slate-700">月</Label>
            <Select
              id="mobile-month"
              value={filters.month}
              onChange={(e) => handleFilterChange({ ...filters, month: e.target.value })}
              className="text-sm"
            >
              <option value="">全て</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}月</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="mobile-status" className="text-xs text-slate-700">ステータス</Label>
            <Select
              id="mobile-status"
              value={filters.fromStatus}
              onChange={(e) => handleFilterChange({ ...filters, fromStatus: e.target.value })}
              className="text-sm"
            >
              <option value="">全て</option>
              <option value="available">利用可能</option>
              <option value="rented">貸与中</option>
              <option value="returned">返却済み</option>
              <option value="cleaning">消毒済み</option>
              <option value="maintenance">メンテナンス済み</option>
            </Select>
          </div>
        </div>
      </div>

      {/* 履歴一覧（テーブル） */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8 text-slate-600">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>読み込み中...</p>
          </div>
        ) : histories.length === 0 ? (
          <div className="text-center py-8 text-slate-600">
            <div className="text-4xl mb-2">📋</div>
            <p>履歴が見つかりませんでした</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">日時</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">商品</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">実行者</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {histories.map((history, index) => (
                  <tr 
                    key={history.id} 
                    className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <td className="py-2 px-3">
                      <div className="text-xs text-slate-600">
                        {new Date(history.timestamp).toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric'
                        })} {new Date(history.timestamp).toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-xs font-medium text-slate-800 truncate max-w-[100px]">
                        {getProductName(history.item_id)}
                      </div>
                      <div className="text-xs text-slate-500">
                        #{history.item_id}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-xs font-medium text-slate-700 truncate max-w-[60px]">
                        {history.performed_by}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm flex-shrink-0">{getActionIcon(history.action)}</span>
                        <span className={`px-1 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.to_status)} whitespace-nowrap`}>
                          {getStatusText(history.to_status)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* モバイル版ページネーション */}
      <PaginationControls />
    </div>
  )

  // デスクトップ版UIコンポーネント
  const DesktopHistoryUI = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-white">履歴管理</h1>
        <div className="flex space-x-2">
          {selectedHistories.size > 0 && (
            <Button 
              variant="outline" 
              onClick={handleDeleteSelected}
              className="bg-destructive/10 border-destructive/20 hover:bg-destructive/20 text-destructive"
            >
              <span className="mr-2">🗑️</span>
              選択削除 ({selectedHistories.size})
            </Button>
          )}
          <Button variant="outline" onClick={exportData}>
            <span className="mr-2">📊</span>
            CSV出力
          </Button>
          <Button variant="outline" onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}>
            <span className="mr-2">{viewMode === 'list' ? '📅' : '📋'}</span>
            {viewMode === 'list' ? 'タイムライン' : 'リスト'}
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-4">フィルター</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <Label htmlFor="year">年</Label>
            <Select
              value={filters.year}
              onChange={(e) => handleFilterChange({ ...filters, year: e.target.value })}
            >
              <option value="">すべて</option>
              {(() => {
                const currentYear = new Date().getFullYear()
                const years = []
                for (let year = currentYear; year >= currentYear - 5; year--) {
                  years.push(
                    <option key={year} value={year.toString()}>{year}年</option>
                  )
                }
                return years
              })()}
            </Select>
          </div>
          
          <div>
            <Label htmlFor="month">月</Label>
            <Select
              value={filters.month}
              onChange={(e) => handleFilterChange({ ...filters, month: e.target.value })}
            >
              <option value="">すべて</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}月</option>
              ))}
            </Select>
          </div>
          
          <div>
            <Label htmlFor="status">ステータス</Label>
            <Select
              value={filters.fromStatus}
              onChange={(e) => handleFilterChange({ ...filters, fromStatus: e.target.value, toStatus: e.target.value })}
            >
              <option value="">すべて</option>
              <option value="available">利用可能</option>
              <option value="rented">貸与中</option>
              <option value="returned">返却済み</option>
              <option value="cleaning">消毒済み</option>
              <option value="maintenance">メンテナンス済み</option>
              <option value="demo_cancelled">デモキャンセル</option>
              <option value="out_of_order">故障中</option>
              <option value="unknown">不明</option>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="itemId">管理番号</Label>
            <Input
              id="itemId"
              value={filters.itemId}
              onChange={(e) => handleFilterChange({ ...filters, itemId: e.target.value })}
              placeholder="例: WC-001"
            />
          </div>
          
          <div>
            <Label htmlFor="action">アクション</Label>
            <Input
              id="action"
              value={filters.action}
              onChange={(e) => handleFilterChange({ ...filters, action: e.target.value })}
              placeholder="例: 返却"
            />
          </div>
          
          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters} className="w-full">
              クリア
            </Button>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} 件の履歴が見つかりました
          </p>
          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-sm text-muted-foreground">読み込み中...</span>
            </div>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">履歴一覧</h2>
          
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                      <input
                        type="checkbox"
                        checked={selectedHistories.size === histories.length && histories.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[120px]">日時</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[100px]">商品名</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[80px]">管理番号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[100px]">アクション</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[80px]">顧客名</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[80px]">ステータス</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[60px]">実行者</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map((history) => (
                    <tr key={history.id} className="border-b border-border hover:bg-accent/50">
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedHistories.has(history.id)}
                          onChange={() => handleSelectHistory(history.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground min-w-[120px]">
                        {new Date(history.timestamp).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-3 px-4 text-foreground min-w-[100px]">
                        {getProductName(history.item_id)}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground min-w-[80px]">
                        {history.item_id}
                      </td>
                      <td className="py-3 px-4 text-foreground min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getActionIcon(history.action)}</span>
                          <span className="truncate">{history.action}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground min-w-[80px]">
                        <span className="truncate">{getCustomerName(history)}</span>
                      </td>
                      <td className="py-3 px-4 min-w-[80px]">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(history.to_status)}`}>
                          {getStatusText(history.to_status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground min-w-[60px]">
                        <span className="truncate">{history.performed_by}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {histories.map((history) => (
                <div key={history.id} className="bg-white/95 backdrop-blur-xl rounded-xl p-3 shadow-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedHistories.has(history.id)}
                        onChange={() => handleSelectHistory(history.id)}
                        className="w-4 h-4 mt-1"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm">{getActionIcon(history.action)}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* ヘッダー行 */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm truncate">
                            {getProductName(history.item_id)}
                          </h3>
                          <p className="text-xs text-slate-600">
                            #{history.item_id}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                          {new Date(history.timestamp).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      
                      {/* アクション行 */}
                      <div className="mb-2">
                        <p className="text-xs text-slate-700">
                          <span className="font-medium">{history.action}</span>
                          <span className="text-slate-500"> • {history.performed_by}</span>
                        </p>
                        {shouldShowCustomerName(history.action) && (
                          <p className="text-xs text-slate-600 mt-1">
                            顧客: {getCustomerName(history)}
                          </p>
                        )}
                      </div>
                      
                      {/* ステータス変更 */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.from_status)}`}>
                          {getStatusText(history.from_status)}
                        </span>
                        <span className="text-slate-400 text-xs">→</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.to_status)}`}>
                          {getStatusText(history.to_status)}
                        </span>
                      </div>
                      
                      {/* 備考 */}
                      {history.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 mt-2">
                          {history.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {histories.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">履歴が見つかりませんでした</p>
            </div>
          )}
        </div>
        
        {/* デスクトップ版ページネーション */}
        <PaginationControls />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>履歴削除の確認</DialogTitle>
            <DialogDescription>
              選択した {selectedHistories.size} 件の履歴を削除します。
              <br />
              この操作は取り消すことができません。
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={confirmDeleteHistories}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              削除実行
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )

  return (
    <>
      {/* UI分岐 */}
      {isMobile ? <MobileHistoryUI /> : <DesktopHistoryUI />}
      
      {/* 共通ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>履歴削除の確認</DialogTitle>
            <DialogDescription>
              選択した {selectedHistories.size} 件の履歴を削除します。
              <br />
              この操作は取り消すことができません。
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={confirmDeleteHistories}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              削除実行
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}