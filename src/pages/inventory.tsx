import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { NewItemDialog } from '../components/new-item-dialog'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabaseDb } from '../lib/supabase-database'
import type { ProductItem } from '../types'

export function Inventory() {
  const {
    categories,
    products,
    items,
    users,
    viewMode,
    selectedCategory,
    selectedProduct,
    setViewMode,
    setSelectedCategory,
    setSelectedProduct,
    getInventorySummary,
    getReservations,
    resetUIState,
    updateItemStatus,
  } = useInventoryStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState('all')
  const [showManagementNumbers, setShowManagementNumbers] = useState(false)
  const [selectedProductItems, setSelectedProductItems] = useState<ProductItem[]>([])


  // ステータスラベル取得関数
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'rented': return '貸出中'
      case 'maintenance': return 'メンテナンス'
      case 'unavailable': return '利用不可'
      default: return status
    }
  }

  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return '管理者'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || '管理者'
  }
  
  const currentUser = getCurrentUserName()
  
  // ステータスフィルタ用の状態（常に利用可能のみ表示）
  const [statusFilter, setStatusFilter] = useState('available')
  
  // ダイアログ状態
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showNewItemDialog, setShowNewItemDialog] = useState(false)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ProductItem | null>(null)
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
  
  
  // 発注フォーム
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    requiredDate: ''
  })
  const [orderError, setOrderError] = useState('')
  
  // 初回データロードはApp.tsxで処理されるため、ここでは不要
  // useEffect(() => {
  //   loadData()
  // }, [])

  // モバイル検出とPC版でのUI状態リセット
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768
      setIsMobile(isMobileView)
      
      // PC版の場合、UI状態をリセット
      if (!isMobileView) {
        resetUIState()
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [resetUIState])

  // 検索結果からの遷移時の処理
  useEffect(() => {
    if (location.state) {
      const { viewMode: stateViewMode, selectedProduct: stateProduct, selectedCategory: stateCategory } = location.state as any
      
      if (stateViewMode) {
        setViewMode(stateViewMode)
      }
      if (stateProduct) {
        setSelectedProduct(stateProduct)
      }
      if (stateCategory) {
        setSelectedCategory(stateCategory)
      }
      
      // stateをクリア（再読み込み時に残らないように）
      window.history.replaceState({}, document.title)
    }
  }, [location.state, setViewMode, setSelectedProduct, setSelectedCategory])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'reserved': return 'bg-orange-500 text-white'
      case 'rented': return 'bg-primary text-primary-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'demo_cancelled': return 'bg-info text-info-foreground'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-muted text-muted-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'reserved': return '予約済み'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '消毒済み'
      case 'maintenance': return 'メンテナンス済み'
      case 'demo_cancelled': return 'デモキャンセル'
      case 'out_of_order': return '故障中'
      case 'unknown': return '不明'
      default: return status
    }
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'bg-success text-success-foreground'
      case 'fair': return 'bg-info text-info-foreground'
      case 'caution': return 'bg-orange-500 text-white'
      case 'needs_repair': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-muted text-muted-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'caution': return '注意'
      case 'needs_repair': return '要修理'
      case 'unknown': return '不明'
      default: return condition
    }
  }

  // Filter data based on current view and status filter
  const filteredCategories = (() => {
    const categoryOrder = [
      '特殊寝台',
      'マットレス',
      '特殊寝台付属品',
      '車いす',
      '歩行器',
      '杖',
      '手すり',
      '手すり付属品',
      'スロープ'
    ]
    
    return categories.sort((a, b) => {
      const orderA = categoryOrder.indexOf(a.name)
      const orderB = categoryOrder.indexOf(b.name)
      
      // カスタム順序にある場合はその順序で
      if (orderA !== -1 && orderB !== -1) {
        return orderA - orderB
      }
      // カスタム順序にない場合は名前でソート
      if (orderA === -1 && orderB === -1) {
        return a.name.localeCompare(b.name)
      }
      // カスタム順序にあるものを優先
      return orderA !== -1 ? -1 : 1
    })
  })()
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products
  
  // 利用可能な商品のみを表示
  const statusFilteredItems = items.filter(i => i.status === 'available')
  
  const filteredItems = selectedProduct
    ? statusFilteredItems.filter(i => i.product_id === selectedProduct)
    : selectedCategory
    ? statusFilteredItems.filter(i => {
        const product = products.find(p => p.id === i.product_id)
        return product?.category_id === selectedCategory
      })
    : statusFilteredItems


  // ハンドラー関数
  const handleStatusChange = (item: ProductItem) => {
    setSelectedItem(item)
    setStatusForm({
      status: item.status,
      reason: '',
      notes: ''
    })
    setShowStatusDialog(true)
  }

  const handleEdit = (item: ProductItem) => {
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

  const handleOrder = (item: ProductItem) => {
    setSelectedItem(item)
    setOrderForm({
      customerName: '',
      requiredDate: new Date().toISOString().split('T')[0] // 今日の日付を初期値に設定
    })
    setOrderError('')
    setShowOrderDialog(true)
  }

  const handleStatusSubmit = async () => {
    if (!selectedItem) return

    const updatedItem: ProductItem = {
      ...selectedItem,
      status: statusForm.status as ProductItem['status']
    }

    // 楽観的更新でステータスを即座に反映
    await updateItemStatus(selectedItem.id, updatedItem.status)
    
    // ステータス以外の属性も更新が必要な場合は追加で保存
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
          changeMethod: 'manual_admin'
        }
      }
    )

    setShowStatusDialog(false)
    setSelectedItem(null)
    alert(`${selectedItem.id} のステータスを ${getStatusText(statusForm.status)} に変更しました`)
  }

  const handleEditSubmit = async () => {
    if (!selectedItem) return

    const updatedItem: ProductItem = {
      ...selectedItem,
      condition: editForm.condition as ProductItem['condition'],
      // 利用可能な場合のみlocationを更新
      location: selectedItem.status === 'available' ? editForm.location : selectedItem.location,
      customer_name: editForm.customerName || undefined,
      loan_start_date: editForm.loanStartDate || undefined,
      notes: editForm.notes
    }

    // 楽観的更新でステータスを即座に反映
    await updateItemStatus(selectedItem.id, updatedItem.status)
    
    // ステータス以外の属性も更新が必要な場合は追加で保存
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
    alert(`${selectedItem.id} の情報を更新しました`)
  }


  // 管理番号指定発注処理
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
        item_status: null, // item_statusは使用しない
        needs_approval: false,
        approval_status: 'not_required' as const,
        item_processing_status: 'waiting' as const // 準備は必要
      }

      // 発注を作成（アイテムを含む）
      const newOrder = {
        id: `ORD-${Date.now()}`,
        customer_name: orderForm.customerName.trim(),
        assigned_to: currentUser,
        carried_by: currentUser,
        status: 'approved' as const, // 承認はスキップするが準備は必要
        order_date: new Date().toISOString().split('T')[0],
        required_date: orderForm.requiredDate,
        notes: `管理番号指定発注: ${selectedItem.id}`,
        created_by: currentUser,
        needs_approval: false,
        created_at: new Date().toISOString(),
        items: [orderItem] // アイテムを配列に含める
      }
      
      await supabaseDb.saveOrder(newOrder)
      
      // 商品ステータスを「予約済み」に変更
      const updatedItem = {
        ...selectedItem,
        status: 'reserved' as const, // 予約済みに変更
        customer_name: orderForm.customerName.trim() // 顧客名も設定
      }
      
      // 楽観的更新でステータスを即座に反映
    await updateItemStatus(selectedItem.id, updatedItem.status)
    
    // ステータス以外の属性も更新が必要な場合は追加で保存
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
          notes: `発注ID: ${newOrder.id} (予約済み)`,
          metadata: {
            orderId: newOrder.id,
            orderItemId: orderItem.id,
            orderType: 'specific_item_order',
            requiredDate: orderForm.requiredDate
          }
        }
      )
      
      // 成功メッセージ
      alert(`管理番号 ${selectedItem.id} の発注が完了しました\n発注ID: ${newOrder.id}`)
      
      // ダイアログを閉じる
      setShowOrderDialog(false)
      setSelectedItem(null)
      
      // ストアを更新して新しい発注を反映
      const { loadIncrementalUpdates } = useInventoryStore.getState()
      await loadIncrementalUpdates()
      
    } catch (error) {
      console.error('Order error:', error)
      setOrderError(`発注エラー: ${error.message}`)
    }
  }

  const renderCategoryView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredCategories.map((category) => {
        return (
          <div
            key={category.id}
            className="bg-card rounded-lg border border-border p-6 hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => {
              setSelectedCategory(category.id)
              setViewMode('product')
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{category.icon}</span>
                <div>
                  <h3 className="font-semibold text-foreground">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderProductView = () => {
    const inventorySummary = getInventorySummary()
    const reservations = getReservations()
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => {
          const productItems = statusFilteredItems.filter(i => i.product_id === product.id)
          const summary = inventorySummary.find(s => s.productId === product.id)
          const reservation = reservations.get(product.id)
          const totalCount = productItems.length

        return (
          <div
            key={product.id}
            className="bg-card rounded-lg border border-border p-6 hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => {
              setSelectedProduct(product.id)
              setViewMode('item')
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
                <p className="text-xs text-muted-foreground">{product.manufacturer} - {product.model}</p>
              </div>
            </div>
            <div className="space-y-1">
              {summary && (
                <div className="text-sm">
                  <span className="text-muted-foreground">在庫数:</span>
                  <span className={`font-bold ml-1 ${summary.availableStock > 0 ? 'text-success' : 'text-destructive'}`}>
                    {summary.availableStock}台
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
    )
  }

  const renderItemView = () => (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">管理番号</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">商品名</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">ステータス</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">状態</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">場所/顧客</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">状態メモ</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">QRコード</th>
                <th className="text-left py-4 px-6 font-medium text-muted-foreground whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const product = products.find(p => p.id === item.product_id)
                // ステータスに応じて表示内容を決定
                const getLocationDisplay = () => {
                  if (item.status === 'rented') {
                    return item.customer_name || '顧客名未設定'
                  } else if (item.status === 'available') {
                    return item.location
                  } else {
                    return '-'
                  }
                }
                
                return (
                  <tr key={item.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-foreground">{item.id}</td>
                    <td className="py-4 px-6 text-foreground">{product?.name}</td>
                    <td className="py-4 px-6">
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
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getConditionColor(item.condition)}`}>
                        {getConditionText(item.condition)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-foreground">{getLocationDisplay()}</td>
                    <td className="py-4 px-6 text-foreground text-sm max-w-48">
                      {item.condition_notes ? (
                        <span className="truncate block" title={item.condition_notes}>
                          {item.condition_notes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-foreground font-mono text-sm">{item.qr_code}</td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <Link to={`/item/${item.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          >
                            詳細
                          </Button>
                        </Link>
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {filteredItems.map((item) => {
          const product = products.find(p => p.id === item.product_id)
          // ステータスに応じて表示内容を決定
          const getLocationDisplay = () => {
            if (item.status === 'rented') {
              return item.customer_name || '顧客名未設定'
            } else if (item.status === 'available') {
              return item.location
            } else {
              return '-'
            }
          }
          
          return (
            <div key={item.id} className="bg-card/50 rounded-xl border border-border p-6 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{item.id}</h3>
                  <p className="text-foreground mt-1">{product?.name}</p>
                </div>
                <div className="flex flex-col space-y-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange(item)}
                    className={`px-3 py-1 rounded-full text-xs font-medium text-center hover:opacity-80 transition-opacity cursor-pointer ${getStatusColor(item.status)}`}
                    title="クリックしてステータスを変更"
                  >
                    {getStatusText(item.status)}
                  </Button>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium text-center ${getConditionColor(item.condition)}`}>
                    {getConditionText(item.condition)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.status === 'rented' ? '顧客:' : 
                       item.status === 'available' ? '場所:' : '場所:'}
                    </span>
                    <span className="text-sm text-foreground">{getLocationDisplay()}</span>
                  </div>
                  {item.condition_notes && (
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-muted-foreground">状態メモ:</span>
                      <span className="text-sm text-foreground">{item.condition_notes}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">QRコード:</span>
                    <span className="text-sm text-foreground font-mono">{item.qr_code}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                <Link to={`/item/${item.id}`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    詳細
                  </Button>
                </Link>
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
            </div>
          )
        })}
      </div>
    </div>
  )


  // モバイル版UIコンポーネント
  const MobileInventoryUI = () => {
    // カテゴリーでフィルタリングされた商品を取得
    const filteredProducts = mobileCategoryFilter === 'all' 
      ? products
      : products.filter(product => product.category_id === mobileCategoryFilter)
    
    // 商品ごとに利用可能なアイテム数をカウント
    const groupedItems = filteredProducts.reduce((acc, product) => {
      const availableItems = items.filter(item => 
        item.product_id === product.id && item.status === 'available'
      )
      acc[product.id] = availableItems
      return acc
    }, {} as Record<string, ProductItem[]>)
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
        {/* ヘッダー */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-800">在庫一覧</h1>
            <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {filteredProducts.length} 種類
            </div>
          </div>
          
          {/* カテゴリーフィルター */}
          <div className="flex overflow-x-auto space-x-2 pb-2 -mx-2 px-2">
            <Button
              onClick={() => setMobileCategoryFilter('all')}
              variant={mobileCategoryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="flex-shrink-0 text-xs"
            >
              すべて
            </Button>
            {filteredCategories.map(category => (
              <Button
                key={category.id}
                onClick={() => setMobileCategoryFilter(category.id)}
                variant={mobileCategoryFilter === category.id ? 'default' : 'outline'}
                size="sm"
                className="flex-shrink-0 text-xs"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* 商品リスト */}
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([productId, items]) => {
            const product = products.find(p => p.id === productId)
            if (!product) return null
            
            const hasStock = items.length > 0
            
            return (
              <div 
                key={productId}
                className={`bg-white/95 backdrop-blur-xl rounded-xl p-4 shadow-lg ${
                  hasStock ? 'cursor-pointer' : 'cursor-default opacity-60'
                }`}
                onClick={() => {
                  if (hasStock) {
                    setSelectedProductItems(items)
                    setShowManagementNumbers(true)
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className={`font-bold text-sm mb-1 ${hasStock ? 'text-slate-800' : 'text-slate-500'}`}>
                      {product.name}
                    </h3>
                    <p className={`text-xs ${hasStock ? 'text-slate-600' : 'text-slate-400'}`}>
                      {product.manufacturer} - {product.model}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full ${
                    hasStock 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className="text-sm font-bold">{items.length}</span>
                    <span className="text-xs ml-1">台</span>
                  </div>
                </div>
                
                {/* 管理番号リスト */}
                {hasStock ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {items.slice(0, 4).map(item => (
                      <div 
                        key={item.id}
                        className="bg-slate-50 rounded-lg px-3 py-2 text-xs font-mono text-slate-700"
                      >
                        {item.id}
                      </div>
                    ))}
                    {items.length > 4 && (
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 text-center col-span-2">
                        他 {items.length - 4} 台
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-center py-4">
                    <div className="text-slate-400 text-sm">在庫なし</div>
                  </div>
                )}
              </div>
            )
          })}
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-white/60">
              <div className="text-4xl mb-2">📦</div>
              <p>商品がありません</p>
            </div>
          )}
        </div>
        
        {/* 管理番号一覧モーダル */}
        {showManagementNumbers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">管理番号一覧</h3>
                  <button
                    onClick={() => setShowManagementNumbers(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="text-xl text-gray-500">×</span>
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedProductItems.length > 0 && (
                    <>
                      {products.find(p => p.id === selectedProductItems[0].product_id)?.name} 
                      - {selectedProductItems.length}台
                    </>
                  )}
                </p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-3">
                  {selectedProductItems.map((item, index) => (
                    <div 
                      key={item.id}
                      className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-mono font-bold text-slate-800 text-sm">
                            {item.id}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {item.location}
                          </div>
                          <div className="mt-2">
                            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getConditionColor(item.condition)}`}>
                              {getConditionText(item.condition)}
                            </div>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </div>
                      </div>
                      
                      {/* 操作ボタン */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setShowManagementNumbers(false)
                            navigate(`/item/${item.id}`)
                          }}
                          className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-xs"
                        >
                          詳細
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowManagementNumbers(false)
                            handleEdit(item)
                          }}
                          className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700 text-xs"
                        >
                          編集
                        </Button>
                        {item.status === 'available' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowManagementNumbers(false)
                              handleOrder(item)
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            発注
                          </Button>
                        )}
                        {item.status !== 'available' && (
                          <div className="text-xs text-slate-400 text-center py-1">
                            利用不可
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  // デスクトップ版UIコンポーネント
  const DesktopInventoryUI = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">在庫管理</h1>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📊</span>
            エクスポート
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowNewItemDialog(true)}
          >
            <span className="mr-2">➕</span>
            新規登録
          </Button>
        </div>
      </div>

      {/* View Mode Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card rounded-lg border border-border p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-white">表示モード:</span>
            <div className="flex space-x-2">
              <Button
                variant={viewMode === 'category' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('category')
                  setSelectedCategory(null)
                  setSelectedProduct(null)
                }}
              >
                種類別
              </Button>
              <Button
                variant={viewMode === 'product' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('product')
                }}
              >
                商品別
              </Button>
              <Button
                variant={viewMode === 'item' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('item')}
              >
                個別管理
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-white">ステータス: 利用可能のみ表示</span>
          </div>
        </div>
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => {
            setViewMode('category')
            setSelectedCategory(null)
            setSelectedProduct(null)
          }}>
            トップ
          </Button>
          {selectedCategory && (
            <>
              <span>/</span>
              <Button variant="ghost" size="sm" onClick={() => {
                setViewMode('product')
                setSelectedProduct(null)
              }}>
                {categories.find(c => c.id === selectedCategory)?.name}
              </Button>
            </>
          )}
          {selectedProduct && (
            <>
              <span>/</span>
              <span className="font-medium text-foreground">
                {products.find(p => p.id === selectedProduct)?.name}
              </span>
            </>
          )}
        </div>
      </div>


      {/* Main Content */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {viewMode === 'category' ? '種類別在庫' :
             viewMode === 'product' ? '商品別在庫' :
             '個別管理在庫'}
          </h2>
          
          {viewMode === 'category' && renderCategoryView()}
          {viewMode === 'product' && renderProductView()}
          {viewMode === 'item' && renderItemView()}
        </div>
      </div>

      {/* Status Change Dialog */}
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>商品情報編集</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  <strong>{selectedItem.id}</strong> の情報を編集します
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="condition">商品状態</Label>
              <Select
                id="condition"
                value={editForm.condition}
                onChange={(e) => setEditForm(prev => ({ ...prev, condition: e.target.value }))}
              >
                <option value="">状態を選択</option>
                <option value="good">良好</option>
                <option value="fair">普通</option>
                <option value="caution">注意</option>
                <option value="needs_repair">要修理</option>
                <option value="unknown">不明</option>
              </Select>
            </div>
            
            {selectedItem?.status === 'available' && (
              <div>
                <Label htmlFor="location">倉庫管理場所</Label>
                <Input
                  id="location"
                  value={editForm.location}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="倉庫での管理場所を入力（例: 倉庫A-1）"
                />
              </div>
            )}
            
            {selectedItem?.status === 'rented' && (
              <>
                <div>
                  <Label htmlFor="customerName">顧客名</Label>
                  <Input
                    id="customerName"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="顧客名を入力（例: 田中太郎様）"
                  />
                </div>
                <div>
                  <Label htmlFor="loanStartDate">貸与開始日</Label>
                  <Input
                    id="loanStartDate"
                    type="date"
                    value={editForm.loanStartDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, loanStartDate: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="editNotes">メモ</Label>
              <Input
                id="editNotes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="商品に関するメモ"
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={handleEditSubmit}>
                更新実行
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Item Registration Dialog */}
      <NewItemDialog
        open={showNewItemDialog}
        onOpenChange={setShowNewItemDialog}
        categories={categories}
        products={products}
        items={items}
        currentUser={currentUser}
        onSuccess={() => {}}
      />
      </div>
    </div>
  )
  
  return (
    <>
      {/* UI分岐 */}
      {isMobile ? <MobileInventoryUI /> : <DesktopInventoryUI />}
      
      {/* 共通ダイアログ（モバイル・デスクトップ両方で使用） */}
      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>管理番号指定発注</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  管理番号 <strong>{selectedItem.id}</strong> を発注します
                  <br />
                  商品: {products.find(p => p.id === selectedItem.product_id)?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
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
            
            <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
              <p className="text-sm text-info-foreground">
                <strong>注意:</strong> この発注により商品は準備商品画面の「番号あり」タブに移動します。<br />
                担当者・持出し者: {currentUser}
              </p>
            </div>

            {/* エラー表示 */}
            {orderError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{orderError}</p>
              </div>
            )}

            {/* ボタン */}
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
    </>
  )
}