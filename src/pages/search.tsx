import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabaseDb } from '../lib/supabase-database'

export function Search() {
  const { products, items, orders, categories, loadData, users, isDataInitialized } = useInventoryStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return '管理者'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || 'ユーザー'
  }
  
  const currentUser = getCurrentUserName()
  
  // 検索フィルター
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',           // フリーワード検索（商品名、管理番号など）
    categoryId: '',        // カテゴリ
    status: '',           // ステータス
    customerName: '',     // 顧客名
    location: '',         // 保管場所
    dateFrom: '',         // 期間（開始）
    dateTo: '',           // 期間（終了）
    assignedTo: '',       // 担当者
  })
  
  // 検索結果
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  // 表示モード
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
  
  
  useEffect(() => {
    // データが初期化されていない場合、または基本データが空の場合のみ再読み込み
    if (!isDataInitialized && products.length === 0) {
      console.log('🔄 Search page: Data not initialized, loading basic data...')
      loadData()
    }
  }, [products.length, isDataInitialized, loadData])
  
  // 検索実行
  const handleSearch = async () => {
    setIsSearching(true)
    setHasSearched(true)
    
    try {
      let results: any[] = []
      
      // 商品アイテムを検索
      const filteredItems = items.filter(item => {
        // キーワード検索
        if (searchFilters.keyword) {
          const keyword = searchFilters.keyword.toLowerCase()
          const product = products.find(p => p.id === item.product_id)
          
          const matchKeyword = 
            item.id.toLowerCase().includes(keyword) ||
            item.qr_code?.toLowerCase().includes(keyword) ||
            product?.name.toLowerCase().includes(keyword) ||
            product?.manufacturer.toLowerCase().includes(keyword) ||
            product?.model.toLowerCase().includes(keyword) ||
            item.customer_name?.toLowerCase().includes(keyword) ||
            item.location?.toLowerCase().includes(keyword)
          
          if (!matchKeyword) return false
        }
        
        // カテゴリフィルター
        if (searchFilters.categoryId) {
          const product = products.find(p => p.id === item.product_id)
          if (product?.category_id !== searchFilters.categoryId) return false
        }
        
        // ステータスフィルター
        if (searchFilters.status && item.status !== searchFilters.status) {
          return false
        }
        
        // 顧客名フィルター
        if (searchFilters.customerName && 
            !item.customer_name?.toLowerCase().includes(searchFilters.customerName.toLowerCase())) {
          return false
        }
        
        // 保管場所フィルター
        if (searchFilters.location && 
            !item.location?.toLowerCase().includes(searchFilters.location.toLowerCase())) {
          return false
        }
        
        // 日付フィルター（貸与開始日）
        if ((searchFilters.dateFrom || searchFilters.dateTo) && item.loan_start_date) {
          const loanDate = new Date(item.loan_start_date)
          if (searchFilters.dateFrom && loanDate < new Date(searchFilters.dateFrom)) return false
          if (searchFilters.dateTo && loanDate > new Date(searchFilters.dateTo)) return false
        }
        
        return true
      })
      
      // 商品情報を追加して結果を整形
      results = filteredItems.map(item => {
        const product = products.find(p => p.id === item.product_id)
        const category = categories.find(c => c.id === product?.category_id)
        
        // 関連する発注情報を検索
        let orderInfo = null
        for (const order of orders) {
          const orderItem = order.items.find(oi => 
            oi.assigned_item_ids?.includes(item.id)
          )
          if (orderItem) {
            orderInfo = {
              orderId: order.id,
              assignedTo: order.assigned_to,
              carriedBy: order.carried_by,
              orderDate: order.order_date,
              requiredDate: order.required_date,
            }
            break
          }
        }
        
        return {
          ...item,
          product: product,
          category: category,
          orderInfo: orderInfo
        }
      })
      
      // 担当者フィルター（発注情報がある場合）
      if (searchFilters.assignedTo) {
        results = results.filter(result => 
          result.orderInfo?.assignedTo?.toLowerCase().includes(searchFilters.assignedTo.toLowerCase()) ||
          result.orderInfo?.carriedBy?.toLowerCase().includes(searchFilters.assignedTo.toLowerCase())
        )
      }
      
      setSearchResults(results)
    } catch (error) {
      console.error('検索エラー:', error)
      alert('検索中にエラーが発生しました')
    } finally {
      setIsSearching(false)
    }
  }
  
  // フィルターリセット
  const resetFilters = () => {
    setSearchFilters({
      keyword: '',
      categoryId: '',
      status: '',
      customerName: '',
      location: '',
      dateFrom: '',
      dateTo: '',
      assignedTo: '',
    })
    setSearchResults([])
    setHasSearched(false)
  }
  
  // ダイアログ状態
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [statusForm, setStatusForm] = useState({
    status: '',
    reason: '',
    notes: ''
  })
  const [editForm, setEditForm] = useState({
    condition: '',
    location: '',
    customerName: '',
    loanStartDate: '',
    notes: ''
  })
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    requiredDate: new Date().toISOString().split('T')[0]
  })
  const [orderError, setOrderError] = useState('')
  
  // ステータス変更ダイアログを開く
  const handleStatusChange = (item: any) => {
    setSelectedItem(item)
    setStatusForm({
      status: item.status,
      reason: '',
      notes: ''
    })
    setShowStatusDialog(true)
  }
  
  // 編集ダイアログを開く
  const handleEdit = (item: any) => {
    setSelectedItem(item)
    setEditForm({
      condition: item.condition,
      location: item.location,
      customerName: item.customer_name || '',
      loanStartDate: item.loan_start_date || '',
      notes: item.notes || ''
    })
    setShowEditDialog(true)
  }
  
  // 発注ダイアログを開く
  const handleOrder = (item: any) => {
    setSelectedItem(item)
    setOrderForm({
      customerName: '',
      requiredDate: new Date().toISOString().split('T')[0]
    })
    setOrderError('')
    setShowOrderDialog(true)
  }
  
  // ステータス変更を実行
  const handleStatusSubmit = async () => {
    if (!selectedItem) return
    
    try {
      const updatedItem = {
        id: selectedItem.id,
        qr_code: selectedItem.qr_code,
        product_id: selectedItem.product_id,
        status: statusForm.status,
        condition: selectedItem.condition,
        location: selectedItem.location,
        customer_name: selectedItem.customer_name,
        loan_start_date: selectedItem.loan_start_date,
        notes: selectedItem.notes
      }
      
      await supabaseDb.saveProductItem(updatedItem)
      
      // 履歴を記録
      await supabaseDb.createItemHistory(
        selectedItem.id,
        'ステータス変更',
        selectedItem.status,
        statusForm.status,
        currentUser,
        {
          location: selectedItem.location,
          condition: selectedItem.condition,
          notes: statusForm.notes,
          metadata: {
            reason: statusForm.reason,
            changeMethod: 'search_page'
          }
        }
      )
      
      setShowStatusDialog(false)
      setSelectedItem(null)
      
      // 検索結果を再実行して更新
      await handleSearch()
      alert(`${selectedItem.id} のステータスを ${getStatusText(statusForm.status)} に変更しました`)
    } catch (error) {
      console.error('ステータス変更エラー:', error)
      alert('ステータス変更中にエラーが発生しました')
    }
  }
  
  // 編集を実行
  const handleEditSubmit = async () => {
    if (!selectedItem) return
    
    try {
      const updatedItem = {
        id: selectedItem.id,
        qr_code: selectedItem.qr_code,
        product_id: selectedItem.product_id,
        status: selectedItem.status,
        condition: editForm.condition,
        location: selectedItem.status === 'available' ? editForm.location : selectedItem.location,
        customer_name: editForm.customerName || undefined,
        loan_start_date: editForm.loanStartDate || undefined,
        notes: editForm.notes
      }
      
      await supabaseDb.saveProductItem(updatedItem)
      
      // 履歴を記録
      await supabaseDb.createItemHistory(
        selectedItem.id,
        '商品情報更新',
        selectedItem.status,
        selectedItem.status,
        currentUser,
        {
          location: selectedItem.status === 'available' ? editForm.location : selectedItem.location,
          condition: editForm.condition,
          notes: editForm.notes,
          customerName: editForm.customerName,
          metadata: {
            updateType: 'product_info_update',
            previousLocation: selectedItem.location,
            previousCondition: selectedItem.condition,
            previousCustomerName: selectedItem.customer_name
          }
        }
      )
      
      setShowEditDialog(false)
      setSelectedItem(null)
      
      // 検索結果を再実行して更新
      await handleSearch()
      alert(`${selectedItem.id} の情報を更新しました`)
    } catch (error) {
      console.error('編集エラー:', error)
      alert('編集中にエラーが発生しました')
    }
  }
  
  // 発注を実行
  const handleOrderSubmit = async () => {
    if (!selectedItem) return
    
    try {
      setOrderError('')
      
      // バリデーション
      if (!orderForm.customerName.trim()) {
        setOrderError('顧客名を入力してください')
        return
      }
      
      if (!orderForm.requiredDate) {
        setOrderError('希望日を選択してください')
        return
      }
      
      // 選択された日付が過去でないかチェック
      const selectedDate = new Date(orderForm.requiredDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        setOrderError('希望日は今日以降を選択してください')
        return
      }
      
      const product = products.find(p => p.id === selectedItem.product_id)
      if (!product) {
        setOrderError('商品情報が見つかりません')
        return
      }
      
      // 発注アイテムを作成（管理番号を事前に割り当て）
      const orderItem = {
        id: `OI-${Date.now()}`,
        product_id: product.id,
        quantity: 1,
        assigned_item_ids: [selectedItem.id],
        notes: `管理番号: ${selectedItem.id}`,
        item_status: null,
        needs_approval: false,
        approval_status: 'not_required' as const,
        item_processing_status: 'waiting' as const
      }

      // 発注を作成
      const newOrder = {
        id: `ORD-${Date.now()}`,
        customer_name: orderForm.customerName.trim(),
        assigned_to: currentUser,
        carried_by: currentUser,
        status: 'approved' as const,
        order_date: new Date().toISOString().split('T')[0],
        required_date: orderForm.requiredDate,
        notes: `管理番号指定発注: ${selectedItem.id}`,
        created_by: currentUser,
        needs_approval: false,
        created_at: new Date().toISOString(),
        items: [orderItem]
      }
      
      await supabaseDb.saveOrder(newOrder)
      
      // 商品ステータスを「予約済み」に変更（不要なプロパティを除外）
      const updatedItem = {
        id: selectedItem.id,
        qr_code: selectedItem.qr_code,
        product_id: selectedItem.product_id,
        status: 'reserved' as const,
        condition: selectedItem.condition,
        location: selectedItem.location,
        customer_name: orderForm.customerName.trim(),
        loan_start_date: selectedItem.loan_start_date,
        notes: selectedItem.notes
      }
      
      await supabaseDb.saveProductItem(updatedItem)
      
      // 履歴を記録
      await supabaseDb.createItemHistory(
        selectedItem.id,
        '管理番号指定発注（予約）',
        selectedItem.status,
        'reserved',
        currentUser,
        {
          location: selectedItem.location,
          condition: selectedItem.condition,
          customerName: orderForm.customerName.trim(),
          metadata: {
            orderId: newOrder.id,
            orderDate: new Date().toISOString(),
            requiredDate: orderForm.requiredDate,
            changeMethod: 'search_page_order'
          }
        }
      )
      
      // 成功メッセージ
      alert(`管理番号 ${selectedItem.id} の発注が完了しました\n発注ID: ${newOrder.id}`)
      
      // ダイアログを閉じて検索結果を更新
      setShowOrderDialog(false)
      setSelectedItem(null)
      await handleSearch()
      
    } catch (error) {
      console.error('発注エラー:', error)
      setOrderError(`発注処理中にエラーが発生しました: ${error.message}`)
    }
  }
  
  // ステータスの色を取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'reserved': return 'bg-warning text-warning-foreground'
      case 'ready_for_delivery': return 'bg-info text-info-foreground'
      case 'rented': return 'bg-primary text-primary-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }
  
  // ステータスのテキストを取得
  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'reserved': return '予約済み'
      case 'ready_for_delivery': return '配送準備完了'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '清掃中'
      case 'maintenance': return 'メンテナンス中'
      case 'out_of_order': return '故障中'
      default: return status
    }
  }

  // コンディションの色を取得
  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-success text-success-foreground'
      case 'good': return 'bg-info text-info-foreground'
      case 'fair': return 'bg-warning text-warning-foreground'
      case 'needs_repair': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-muted text-muted-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  // コンディションのテキストを取得
  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'excellent': return '優良'
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'needs_repair': return '要修理'
      case 'unknown': return '不明'
      default: return condition
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-white">🔍 商品検索</h1>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              リスト表示
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('card')}
            >
              カード表示
            </Button>
          </div>
        </div>
        
        {/* 検索フィルター */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">検索条件</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* フリーワード検索 */}
            <div className="md:col-span-2 lg:col-span-3">
              <Label htmlFor="keyword">フリーワード検索</Label>
              <Input
                id="keyword"
                value={searchFilters.keyword}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, keyword: e.target.value }))}
                placeholder="商品名、管理番号、QRコード、メーカー、型番など"
                className="mt-1"
              />
            </div>
            
            {/* カテゴリ */}
            <div>
              <Label htmlFor="category">カテゴリ</Label>
              <Select
                id="category"
                value={searchFilters.categoryId}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, categoryId: e.target.value }))}
                className="mt-1"
              >
                <option value="">すべて</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </Select>
            </div>
            
            {/* ステータス */}
            <div>
              <Label htmlFor="status">ステータス</Label>
              <Select
                id="status"
                value={searchFilters.status}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, status: e.target.value }))}
                className="mt-1"
              >
                <option value="">すべて</option>
                <option value="available">利用可能</option>
                <option value="reserved">予約済み</option>
                <option value="ready_for_delivery">配送準備完了</option>
                <option value="rented">貸与中</option>
                <option value="returned">返却済み</option>
                <option value="cleaning">清掃中</option>
                <option value="maintenance">メンテナンス中</option>
                <option value="out_of_order">故障中</option>
              </Select>
            </div>
            
            {/* 顧客名 */}
            <div>
              <Label htmlFor="customer">顧客名</Label>
              <Input
                id="customer"
                value={searchFilters.customerName}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="顧客名で検索"
                className="mt-1"
              />
            </div>
            
            {/* 保管場所 */}
            <div>
              <Label htmlFor="location">保管場所</Label>
              <Input
                id="location"
                value={searchFilters.location}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                placeholder="保管場所で検索"
                className="mt-1"
              />
            </div>
            
            {/* 担当者 */}
            <div>
              <Label htmlFor="assignedTo">担当者/持出者</Label>
              <Input
                id="assignedTo"
                value={searchFilters.assignedTo}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="担当者名で検索"
                className="mt-1"
              />
            </div>
            
            {/* 期間 */}
            <div className="lg:col-span-3">
              <Label>貸与期間</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                <Input
                  type="date"
                  value={searchFilters.dateFrom}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  placeholder="開始日"
                />
                <Input
                  type="date"
                  value={searchFilters.dateTo}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  placeholder="終了日"
                />
              </div>
            </div>
          </div>
          
          {/* 検索ボタン */}
          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={resetFilters}
            >
              条件をクリア
            </Button>
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-primary hover:bg-primary/90"
            >
              {isSearching ? '検索中...' : '検索'}
            </Button>
          </div>
        </div>
        
        {/* 検索結果 */}
        {hasSearched && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                検索結果 ({searchResults.length}件)
              </h2>
            </div>
            
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">検索条件に一致する商品が見つかりませんでした</p>
              </div>
            ) : viewMode === 'list' ? (
              /* リスト表示 */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">管理番号</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">商品名</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">カテゴリ</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">ステータス</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">コンディション</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">顧客名/保管場所</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-accent/50">
                        <td className="py-3 px-4 text-foreground font-medium">{item.id}</td>
                        <td className="py-3 px-4 text-foreground">
                          {item.product?.name || 'Unknown'}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {item.product?.manufacturer} {item.product?.model}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground">
                          {item.category?.icon} {item.category?.name}
                        </td>
                        <td className="py-3 px-4">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(item)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer ${getStatusColor(item.status)}`}
                            title="クリックしてステータスを変更"
                          >
                            {getStatusText(item.status)}
                          </Button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getConditionColor(item.condition)}`}>
                            {getConditionText(item.condition)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground">
                          {item.status === 'rented' ? (item.customer_name || '顧客名未設定') : (item.location || '-')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(
                                `/item/${item.id}`,
                                { 
                                  state: { 
                                    from: '/search',
                                    searchFilters: searchFilters,
                                    searchResults: searchResults
                                  } 
                                }
                              )}
                              className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            >
                              詳細
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                            >
                              編集
                            </Button>
                            {item.status === 'available' && (
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleOrder(item)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                発注
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* カード表示 */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-background/50 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {item.product?.name || 'Unknown'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.id}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusText(item.status)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">カテゴリ:</span>
                        <span className="text-foreground">
                          {item.category?.icon} {item.category?.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">メーカー:</span>
                        <span className="text-foreground">
                          {item.product?.manufacturer}
                        </span>
                      </div>
                      {item.customer_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">顧客:</span>
                          <span className="text-foreground">
                            {item.customer_name}様
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">保管場所:</span>
                        <span className="text-foreground">
                          {item.location || '-'}
                        </span>
                      </div>
                      {item.orderInfo && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            担当: {item.orderInfo.assignedTo} / 持出: {item.orderInfo.carriedBy}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* アクションボタン */}
                    <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-border">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(item)}
                        className={`px-3 py-1 rounded-full text-xs font-medium text-center hover:opacity-80 transition-opacity cursor-pointer ${getStatusColor(item.status)}`}
                        title="クリックしてステータスを変更"
                      >
                        {getStatusText(item.status)}
                      </Button>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(
                            `/item/${item.id}`,
                            { 
                              state: { 
                                from: '/search',
                                searchFilters: searchFilters,
                                searchResults: searchResults
                              } 
                            }
                          )}
                          className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          詳細
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        >
                          編集
                        </Button>
                      </div>
                      {item.status === 'available' && (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleOrder(item)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                        >
                          発注
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* ステータス変更ダイアログ */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ステータス変更</DialogTitle>
              <DialogDescription>
                {selectedItem && (
                  <>
                    <strong>{selectedItem.id}</strong> のステータスを変更します
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">新しいステータス</Label>
                <Select
                  id="status"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">ステータスを選択</option>
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
                <Label htmlFor="reason">変更理由</Label>
                <Input
                  id="reason"
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="変更理由を入力してください"
                />
              </div>
              
              <div>
                <Label htmlFor="statusNotes">メモ</Label>
                <Input
                  id="statusNotes"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="追加のメモがあれば入力"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                  キャンセル
                </Button>
                <Button 
                  onClick={handleStatusSubmit}
                  disabled={!statusForm.status}
                >
                  変更実行
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* 編集ダイアログ */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>商品情報編集</DialogTitle>
              <DialogDescription>
                {selectedItem && `${selectedItem.id} の情報を編集します`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="condition">コンディション</Label>
                <Select
                  id="condition"
                  value={editForm.condition}
                  onChange={(e) => setEditForm(prev => ({ ...prev, condition: e.target.value }))}
                  className="mt-1"
                >
                  <option value="excellent">優良</option>
                  <option value="good">良好</option>
                  <option value="fair">普通</option>
                  <option value="needs_repair">要修理</option>
                  <option value="unknown">不明</option>
                </Select>
              </div>
              
              {selectedItem?.status === 'available' && (
                <div>
                  <Label htmlFor="location">保管場所</Label>
                  <Input
                    id="location"
                    value={editForm.location}
                    onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="保管場所を入力"
                    className="mt-1"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="customerName">顧客名</Label>
                <Input
                  id="customerName"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="顧客名を入力"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="loanStartDate">貸与開始日</Label>
                <Input
                  id="loanStartDate"
                  type="date"
                  value={editForm.loanStartDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, loanStartDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="editNotes">備考</Label>
                <Input
                  id="editNotes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="備考を入力"
                  className="mt-1"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleEditSubmit}>
                  変更実行
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* 発注ダイアログ */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>管理番号指定発注</DialogTitle>
              <DialogDescription>
                {selectedItem && `${selectedItem.id} を発注します`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {orderError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive">{orderError}</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="customerName">顧客名 <span className="text-destructive">*</span></Label>
                <Input
                  id="customerName"
                  value={orderForm.customerName}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="顧客名を入力してください"
                />
              </div>
              
              <div>
                <Label htmlFor="requiredDate">希望日 <span className="text-destructive">*</span></Label>
                <Input
                  id="requiredDate"
                  type="date"
                  value={orderForm.requiredDate}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, requiredDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
                  キャンセル
                </Button>
                <Button 
                  onClick={handleOrderSubmit}
                  disabled={!orderForm.customerName.trim() || !orderForm.requiredDate}
                  className="bg-primary hover:bg-primary/90"
                >
                  発注実行
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}