import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { supabaseDb } from '../lib/supabase-database'
import { useLocation, useNavigate } from 'react-router-dom'

export function Orders() {
  const { products, users, items, createOrder, updateItemStatus, getProductAvailableStock } = useInventoryStore()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  
  // ローカル状態で注文データを管理
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return 'ゲスト'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || 'ユーザー'
  }
  
  const currentUser = getCurrentUserName()
  
  // 注文データをオンデマンドで読み込み
  useEffect(() => {
    const loadOrdersData = async () => {
      setOrdersLoading(true)
      setOrdersError(null)
      
      try {
        console.log('📦 Loading orders data...')
        const ordersData = await supabaseDb.getOrders()
        setOrders(ordersData)
        console.log(`✅ Loaded ${ordersData.length} orders`)
      } catch (error) {
        console.error('Failed to load orders:', error)
        setOrdersError('注文データの読み込みに失敗しました')
      } finally {
        setOrdersLoading(false)
      }
    }
    
    loadOrdersData()
  }, [])

  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAllOrders, setShowAllOrders] = useState(false)
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    assignedTo: '',
    carriedBy: '',
    requiredDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ productId: '', quantity: 1 }]
  })

  // URLパラメータをチェックして新規発注ダイアログを自動的に開く
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    if (searchParams.get('action') === 'new') {
      setShowNewOrderDialog(true)
      // URLパラメータをクリア
      navigate('/orders', { replace: true })
    }
  }, [location.search, navigate])

  const addOrderItem = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }]
    }))
  }

  const removeOrderItem = (index: number) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // 商品ステータスに基づいて承認が必要かどうかを判定（予約枠を考慮）
  const needsApprovalForProduct = (productId: string) => {
    const productItems = items.filter(item => item.product_id === productId)
    const physicalAvailable = productItems.filter(item => item.status === 'available')
    const processingItems = productItems.filter(item => 
      ['returned', 'cleaning', 'maintenance'].includes(item.status)
    )
    
    // 実質在庫数を取得（予約枠を考慮）
    const actualAvailableCount = getProductAvailableStock(productId)
    
    return {
      hasAvailable: actualAvailableCount > 0,
      hasProcessing: processingItems.length > 0,
      physicalAvailableCount: physicalAvailable.length,
      availableCount: actualAvailableCount,
      processingCount: processingItems.length,
      needsApproval: actualAvailableCount === 0 && processingItems.length > 0
    }
  }

  // 発注アイテムの詳細な情報を取得
  const getOrderItemDetails = (productId: string, quantity: number) => {
    const statusInfo = needsApprovalForProduct(productId)
    const product = products.find(p => p.id === productId)
    
    return {
      ...statusInfo,
      productName: product?.name || 'Unknown',
      canFulfill: statusInfo.availableCount + statusInfo.processingCount >= quantity,
      shortfall: Math.max(0, quantity - (statusInfo.availableCount + statusInfo.processingCount))
    }
  }

  const handleSubmitOrder = async () => {
    console.log('🎯 handleSubmitOrder called')
    console.log('📋 Current orderForm:', orderForm)
    
    try {
      console.log('🔍 Starting order submission process...')
      
      // Validation
      if (!orderForm.customerName || !orderForm.assignedTo || !orderForm.carriedBy || !orderForm.requiredDate) {
        console.log('❌ Validation failed: missing required fields')
        alert('必須項目を入力してください')
        return
      }
      console.log('✅ Basic validation passed')

      if (orderForm.items.some(item => !item.productId || item.quantity < 1)) {
        alert('商品と数量を正しく入力してください')
        return
      }

    // 在庫チェック - 発注不可能な商品があるかチェック
    const invalidItems = orderForm.items.filter(item => {
      const details = getOrderItemDetails(item.productId, item.quantity)
      return details.shortfall > 0 // 在庫不足がある場合
    })

    if (invalidItems.length > 0) {
      const invalidItemNames = invalidItems.map(item => {
        const product = products.find(p => p.id === item.productId)
        const details = getOrderItemDetails(item.productId, item.quantity)
        return `${product?.name || 'Unknown'} (${details.shortfall}個不足)`
      }).join('\n')
      
      alert(`以下の商品は在庫不足のため発注できません:\n${invalidItemNames}`)
      return
    }

    // Check if any items need approval and set individual approval status
    console.log('🔍 Processing order items...')
    const itemsWithApproval = orderForm.items.flatMap((item, index) => {
      const details = getOrderItemDetails(item.productId, item.quantity)
      const result = []
      
      // 利用可能在庫がある場合、その分を承認不要として処理
      if (details.availableCount > 0) {
        const availableQuantity = Math.min(details.availableCount, item.quantity)
        result.push({
          id: `item-${Date.now()}-${index}-available`,
          product_id: item.productId,
          quantity: availableQuantity,
          needs_approval: false,
          item_status: 'available' as const,
          approval_status: 'not_required' as const,
          item_processing_status: 'waiting' as const
        })
        console.log(`📦 Available item for ${item.productId}: ${availableQuantity}個`)
      }
      
      // 残りの数量で処理中在庫がある場合、承認必要として処理
      const remainingQuantity = item.quantity - Math.min(details.availableCount, item.quantity)
      if (remainingQuantity > 0 && details.processingCount > 0) {
        const processingQuantity = Math.min(details.processingCount, remainingQuantity)
        result.push({
          id: `item-${Date.now()}-${index}-processing`,
          product_id: item.productId,
          quantity: processingQuantity,
          needs_approval: true,
          item_status: 'maintenance' as const,
          approval_status: 'pending' as const,
          item_processing_status: 'waiting' as const
        })
        console.log(`📦 Processing item for ${item.productId}: ${processingQuantity}個 (承認必要)`)
      }
      
      return result
    })
    console.log('✅ All items processed:', itemsWithApproval)

    // 承認が必要な商品と不要な商品を分離
    const approvalRequiredItems = itemsWithApproval.filter(item => item.needs_approval)
    const noApprovalItems = itemsWithApproval.filter(item => !item.needs_approval)

    const baseOrderData = {
      customer_name: orderForm.customerName,
      assigned_to: orderForm.assignedTo,
      carried_by: orderForm.carriedBy,
      created_at: new Date().toISOString(),
      order_date: new Date().toISOString().split('T')[0],
      required_date: orderForm.requiredDate,
      notes: orderForm.notes,
      created_by: currentUser
    }

    // 承認不要の商品がある場合、承認済み状態で発注作成
    if (noApprovalItems.length > 0) {
      const immediateOrder = {
        ...baseOrderData,
        items: noApprovalItems,
        status: 'approved' as const
      }
      console.log('🚀 Creating immediate order (no approval):', immediateOrder)
      
      try {
        await createOrder(immediateOrder)
        console.log('✅ Immediate order created successfully')
        // 商品のステータスは変更しない（availableのまま）
      } catch (orderError) {
        console.error('❌ Error creating immediate order:', orderError)
        throw orderError
      }
    }

    // 承認必要の商品がある場合、承認待ち状態で発注作成
    if (approvalRequiredItems.length > 0) {
      const approvalOrder = {
        ...baseOrderData,
        items: approvalRequiredItems,
        status: 'pending' as const
      }
      console.log('⏳ Creating approval order (needs approval):', approvalOrder)
      
      try {
        await createOrder(approvalOrder)
        console.log('✅ Approval order created successfully')
        // 承認待ち商品のステータスは変更しない（承認後に変更）
      } catch (orderError) {
        console.error('❌ Error creating approval order:', orderError)
        throw orderError
      }
    }

    // メッセージ表示
    console.log('💬 Showing completion message...')
    console.log(`📊 Summary: noApproval=${noApprovalItems.length}, approval=${approvalRequiredItems.length}`)
    
    if (noApprovalItems.length > 0 && approvalRequiredItems.length > 0) {
      const message = `発注を分割しました。\n承認不要: ${noApprovalItems.length}商品 (承認済み)\n承認必要: ${approvalRequiredItems.length}商品 (承認待ち)`
      console.log('💬 Showing split order message:', message)
      alert(message)
    } else if (noApprovalItems.length > 0) {
      const message = `発注が完了しました。${noApprovalItems.length}商品の発注が承認されました。`
      console.log('💬 Showing no approval message:', message)
      alert(message)
    } else if (approvalRequiredItems.length > 0) {
      const message = `発注が完了しました。${approvalRequiredItems.length}商品が承認待ちになりました。`
      console.log('💬 Showing approval required message:', message)
      alert(message)
    } else {
      console.log('⚠️ No items to process - this should not happen')
    }
    
      // Reset form
      setOrderForm({
        customerName: '',
        assignedTo: '',
        carriedBy: '',
        requiredDate: new Date().toISOString().split('T')[0],
        notes: '',
        items: [{ productId: '', quantity: 1 }]
      })
      setShowNewOrderDialog(false)
      
    } catch (error) {
      console.error('❌ Error in handleSubmitOrder:', error)
      alert(`発注処理中にエラーが発生しました: ${error.message}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning text-warning-foreground'
      case 'partial_approved': return 'bg-info text-info-foreground'
      case 'approved': return 'bg-info text-info-foreground'
      case 'ready': return 'bg-success text-success-foreground'
      case 'delivered': return 'bg-primary text-primary-foreground'
      case 'cancelled': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '承認待ち'
      case 'partial_approved': return '一部承認済み'
      case 'approved': return '承認済み'
      case 'ready': return '準備完了'
      case 'delivered': return '配送完了'
      case 'cancelled': return 'キャンセル'
      default: return status
    }
  }

  // 商品のステータスを更新する関数
  const updateProductItemsStatus = async (orderItems: any[], newStatus: string) => {
    console.log(`🔄 Updating product status to ${newStatus} for order items:`, orderItems)
    
    try {
      for (const orderItem of orderItems) {
        // 対象商品の利用可能なアイテムを取得
        const availableItems = items.filter(item => 
          item.product_id === orderItem.product_id && 
          item.status === 'available'
        )
        
        console.log(`📦 Found ${availableItems.length} available items for product ${orderItem.product_id}`)
        
        if (availableItems.length === 0) {
          console.warn(`⚠️ No available items found for product ${orderItem.product_id}`)
          continue
        }
        
        // 必要数分のアイテムのステータスを更新
        const itemsToUpdate = availableItems.slice(0, orderItem.quantity)
        
        for (const item of itemsToUpdate) {
          console.log(`🏷️ Updating item ${item.id} status from ${item.status} to ${newStatus}`)
          try {
            await updateItemStatus(item.id, newStatus as any)
            console.log(`✅ Successfully updated ${item.id}`)
          } catch (itemError) {
            console.error(`❌ Failed to update item ${item.id}:`, itemError)
            throw itemError
          }
        }
      }
      
      // データを再読み込みして画面に反映
      console.log('🔄 Reloading data to reflect changes...')
      await loadData()
      console.log('✅ Product status update completed')
      
    } catch (error) {
      console.error('❌ Error in updateProductItemsStatus:', error)
      throw error
    }
  }

  // 発注選択関連の関数
  const handleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }
  
  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length && orders.length > 0) {
      // 全選択解除
      setSelectedOrders(new Set())
    } else {
      // 全選択
      const allIds = new Set(orders.map(o => o.id))
      setSelectedOrders(allIds)
    }
  }
  
  const handleDeleteSelected = () => {
    if (selectedOrders.size > 0) {
      setShowDeleteDialog(true)
    }
  }
  
  const confirmDeleteOrders = async () => {
    try {
      // 選択された発注を削除
      for (const orderId of selectedOrders) {
        await supabaseDb.deleteOrder(orderId)
      }
      
      // データを再読み込み
      await loadData()
      
      // 選択状態をクリア
      setSelectedOrders(new Set())
      setShowDeleteDialog(false)
      
      alert(`${selectedOrders.size}件の発注を削除しました`)
    } catch (error) {
      console.error('Error deleting orders:', error)
      alert('発注の削除中にエラーが発生しました')
    }
  }

  // Calculate stats
  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    approved: orders.filter(o => o.status === 'approved').length,
    ready: orders.filter(o => o.status === 'ready').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }

  // ローディング中の表示
  if (ordersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white">注文データを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  // エラー時の表示
  if (ordersError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{ordersError}</p>
          <Button onClick={() => window.location.reload()}>再読み込み</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
        
        <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-white">発注管理</h1>
          <div className="flex space-x-2">
            {selectedOrders.size > 0 && (
              <Button 
                variant="outline" 
                onClick={handleDeleteSelected}
                className="bg-destructive/10 border-destructive/20 hover:bg-destructive/20 text-destructive"
              >
                <span className="mr-2">🗑️</span>
                選択削除 ({selectedOrders.size})
              </Button>
            )}
            <Button 
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              onClick={() => setShowNewOrderDialog(true)}
            >
              <span className="mr-2">➕</span>
              新規発注
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">承認待ち</p>
                <p className="text-lg font-bold text-foreground">{stats.pending}</p>
              </div>
              <div className="h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center">
                <span className="text-warning text-xs">⏳</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">承認済み</p>
                <p className="text-lg font-bold text-foreground">{stats.approved}</p>
              </div>
              <div className="h-6 w-6 rounded-full bg-info/20 flex items-center justify-center">
                <span className="text-info text-xs">🔄</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">準備完了</p>
                <p className="text-lg font-bold text-foreground">{stats.ready}</p>
              </div>
              <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
                <span className="text-success text-xs">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">配送完了</p>
                <p className="text-lg font-bold text-foreground">{stats.delivered}</p>
              </div>
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary text-xs">🚚</span>
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-3 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">
              発注一覧 {orders.length > 5 && !showAllOrders && <span className="text-sm text-muted-foreground">（新着5件）</span>}
            </h2>
            
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-10">
                      <input
                        type="checkbox"
                        checked={selectedOrders.size === orders.length && orders.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">顧客名</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">商品名</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">担当者</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">持出者</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">ステータス</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">発注日</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">希望日</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">作成者</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllOrders ? orders : orders.slice(0, 5)).map((order) => {
                    // 商品名の表示を作成（複数商品の場合は最初の商品名 + 他X件）
                    const getProductNames = () => {
                      if (!order.items || order.items.length === 0) return '商品なし'
                      
                      const firstProduct = products.find(p => p.id === order.items[0].product_id)
                      const firstName = firstProduct?.name || '商品名不明'
                      
                      if (order.items.length === 1) {
                        return firstName
                      } else {
                        return `${firstName} 他${order.items.length - 1}件`
                      }
                    }

                    return (
                      <tr key={order.id} className="border-b border-border hover:bg-accent/50">
                        <td className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => handleSelectOrder(order.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-3 px-4 text-foreground">{order.customer_name}様</td>
                        <td className="py-3 px-4 text-foreground">{getProductNames()}</td>
                        <td className="py-3 px-4 text-foreground">{order.assigned_to}</td>
                        <td className="py-3 px-4 text-foreground">{order.carried_by}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground">{order.order_date}</td>
                        <td className="py-3 px-4 text-foreground">{order.required_date}</td>
                        <td className="py-3 px-4 text-foreground">{order.created_by}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Mobile List */}
            <div className="lg:hidden space-y-2">
              {(showAllOrders ? orders : orders.slice(0, 5)).map((order) => {
                // 商品名の表示を作成（複数商品の場合は最初の商品名 + 他X件）
                const getProductNames = () => {
                  if (!order.items || order.items.length === 0) return '商品なし'
                  
                  const firstProduct = products.find(p => p.id === order.items[0].product_id)
                  const firstName = firstProduct?.name || '商品名不明'
                  
                  if (order.items.length === 1) {
                    return firstName
                  } else {
                    return `${firstName} 他${order.items.length - 1}件`
                  }
                }

                return (
                  <div key={order.id} className="border border-border rounded-lg p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-4 h-4 flex-shrink-0"
                      />
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">{order.order_date}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground text-sm">{order.customer_name}様</span>
                          </div>
                          
                          <div className="text-xs text-muted-foreground truncate">
                            {getProductNames()}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>担当: {order.assigned_to}</span>
                            <span>持出: {order.carried_by}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* もっと見るボタン */}
            {orders.length > 5 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllOrders(!showAllOrders)}
                  className="bg-primary/10 hover:bg-primary/20 border-primary/20"
                >
                  <span className="mr-2">{showAllOrders ? '📌' : '📋'}</span>
                  {showAllOrders ? '表示を減らす' : `もっと見る（残り${orders.length - 5}件）`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Order Dialog */}
      <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="text-2xl font-bold flex items-center gap-2">
                <span className="text-2xl">📋</span>
                新規発注
              </div>
            </DialogTitle>
            <DialogDescription>
              商品の発注を作成します。必須項目を入力してください。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Customer Information Section */}
            <div className="bg-card/50 rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-blue-500">👤</span>
                顧客情報
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="customerName" className="text-sm font-medium text-foreground">
                    顧客名 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={orderForm.customerName}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="顧客名を入力してください"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Assignment Information Section */}
            <div className="bg-card/50 rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-green-500">👥</span>
                担当・持出情報
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="assignedTo" className="text-sm font-medium text-foreground">
                    担当者 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={orderForm.assignedTo}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="mt-1"
                    placeholder="担当者を選択してください"
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.name}>
                        {user.name} ({user.department})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="carriedBy" className="text-sm font-medium text-foreground">
                    持出者 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={orderForm.carriedBy}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, carriedBy: e.target.value }))}
                    className="mt-1"
                    placeholder="持出者を選択してください"
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.name}>
                        {user.name} ({user.department})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Date Information Section */}
            <div className="bg-card/50 rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-purple-500">📅</span>
                希望日
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="requiredDate" className="text-sm font-medium text-foreground">
                    希望日 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requiredDate"
                    type="date"
                    value={orderForm.requiredDate}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, requiredDate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Order Items Section */}
            <div className="bg-card/50 rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="text-orange-500">📦</span>
                  発注商品
                </h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addOrderItem}
                  className="bg-primary/10 hover:bg-primary/20 border-primary/20"
                >
                  <span className="mr-2">➕</span>
                  商品追加
                </Button>
              </div>
              
              <div className="space-y-3">
                {orderForm.items.map((item, index) => {
                  const details = item.productId ? getOrderItemDetails(item.productId, item.quantity) : null
                  return (
                    <div key={index} className="p-4 bg-background/50 border border-border rounded-lg">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="flex-1">
                          <Select
                            value={item.productId}
                            onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                            placeholder="商品を選択してください"
                          >
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.manufacturer})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="数量"
                          />
                        </div>
                        {orderForm.items.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOrderItem(index)}
                            className="text-destructive border-destructive/20 hover:bg-destructive/10"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                      
                      {item.productId && (
                        <div className="text-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">在庫状況:</span>
                            <div className="flex items-center space-x-2">
                              {details ? (
                                <>
                                  <span className="text-success">利用可能 {details.availableCount}</span>
                                  {details.hasProcessing && (
                                    <span className="text-warning">処理中 {details.processingCount}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">在庫情報を読み込み中...</span>
                              )}
                            </div>
                          </div>
                          
                          {details && details.needsApproval && (
                            <div className="flex items-center space-x-2 p-2 bg-warning/10 border border-warning/20 rounded">
                              <span className="text-warning">⚠️</span>
                              <span className="text-sm text-warning">
                                この商品は処理中のため承認が必要です
                              </span>
                            </div>
                          )}
                          
                          {details && details.shortfall > 0 && (
                            <div className="flex items-center space-x-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                              <span className="text-destructive">❌</span>
                              <span className="text-sm text-destructive">
                                在庫不足: {details.shortfall}個 足りません
                              </span>
                            </div>
                          )}
                          
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-card/50 rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-yellow-500">📝</span>
                備考
              </h3>
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-foreground">
                  備考・特記事項
                </Label>
                <Input
                  id="notes"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="備考があれば入力してください"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => setShowNewOrderDialog(false)}
                className="px-6"
              >
                キャンセル
              </Button>
              <Button 
                onClick={handleSubmitOrder}
                className="px-6 bg-primary hover:bg-primary/90"
              >
                <span className="mr-2">✨</span>
                発注作成
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>発注削除の確認</DialogTitle>
            <DialogDescription>
              選択した {selectedOrders.size} 件の発注を削除します。
              <br />
              この操作は取り消すことができません。
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={confirmDeleteOrders}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              削除実行
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}