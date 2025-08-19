import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useState, useEffect, useCallback } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'
import { supabaseDb } from '../lib/supabase-database'
import { useAuth } from '../hooks/useAuth'
import type { Order, Product } from '../types'

export function Approval() {
  const { orders, products, items, users, loadData, isDataInitialized } = useInventoryStore()
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalForm, setApprovalForm] = useState({
    action: '', // 'approve' or 'reject'
    notes: ''
  })

  // 安全なモバイル検出
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


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

  useEffect(() => {
    // データが初期化されていない場合、または基本データが空の場合のみ再読み込み
    if (!isDataInitialized && (orders.length === 0 || products.length === 0)) {
      console.log('🔄 Approval page: Data not initialized, loading basic data...')
      loadData()
    }
  }, [orders.length, products.length, isDataInitialized, loadData])

  useEffect(() => {
    // 承認待ちまたは一部承認済みの発注を取得
    const pending = orders.filter(order => 
      order.status === 'pending' || order.status === 'partial_approved'
    )
    setPendingOrders(pending)
  }, [orders])

  // 共通のイベントハンドラー（モバイル・デスクトップ共通）
  const handleApprovalAction = useCallback((order: Order, action: 'approve' | 'reject') => {
    setSelectedOrder(order)
    setApprovalForm({ action, notes: '' })
    setShowApprovalDialog(true)
  }, [])


  const handleItemApproval = async (orderId: string, itemId: string, action: 'approve' | 'reject', notes: string = '') => {
    try {
      const order = await supabaseDb.getOrderById(orderId)
      if (!order) return


      const updatedItems = order.items.map(item => {
        if (item.id === itemId && item.approval_status === 'pending') {
          return {
            ...item,
            approval_status: action === 'approve' ? 'approved' as const : 'rejected' as const,
            approved_by: currentUser,
            approved_date: new Date().toISOString().split('T')[0],
            approval_notes: notes,
            item_processing_status: action === 'approve' ? 'waiting' as const : 'cancelled' as const
          }
        }
        return item
      })

      // 発注全体のステータスを更新
      const pendingItems = updatedItems.filter(item => item.approval_status === 'pending')
      const approvedItems = updatedItems.filter(item => item.approval_status === 'approved' || item.approval_status === 'not_required')
      
      let newOrderStatus: Order['status'] = 'cancelled'
      if (pendingItems.length > 0) {
        newOrderStatus = approvedItems.length > 0 ? 'partial_approved' : 'pending'
      } else {
        newOrderStatus = approvedItems.length > 0 ? 'approved' : 'cancelled'
      }

      const updatedOrder: Order = {
        ...order,
        items: updatedItems,
        status: newOrderStatus
      }

      await supabaseDb.saveOrder(updatedOrder)
      await loadData()
    } catch (error) {
      console.error('Error in handleItemApproval:', error)
    }
  }

  const handleApprovalSubmit = async () => {
    if (!selectedOrder) return

    try {
      console.log('🎯 Starting approval submit:', { action: approvalForm.action, orderId: selectedOrder.id })

      // 全体承認の場合は、承認待ちのアイテムを一括処理
      const updatedItems = selectedOrder.items.map(item => {
        if (item.approval_status === 'pending') {
          return {
            ...item,
            approval_status: approvalForm.action === 'approve' ? 'approved' as const : 'rejected' as const,
            approved_by: currentUser,
            approved_date: new Date().toISOString().split('T')[0],
            approval_notes: approvalForm.notes,
            item_processing_status: approvalForm.action === 'approve' ? 'waiting' as const : 'cancelled' as const
          }
        }
        return item
      })

      const updatedOrder: Order = {
        ...selectedOrder,
        items: updatedItems,
        status: approvalForm.action === 'approve' ? 'approved' : 'cancelled',
        approved_by: currentUser,
        approved_date: new Date().toISOString().split('T')[0],
        approval_notes: approvalForm.notes
      }

      console.log('💾 Saving updated order:', updatedOrder)
      await supabaseDb.saveOrder(updatedOrder)
      
      console.log('🔄 Reloading data...')
      await loadData()
      
      console.log('✅ Approval submit completed, closing dialog')
      setShowApprovalDialog(false)
      setSelectedOrder(null)
      setApprovalForm({ action: '', notes: '' })
      
      alert(`発注が${approvalForm.action === 'approve' ? '承認' : '却下'}されました`)
    } catch (error) {
      console.error('❌ Error in handleApprovalSubmit:', error)
      alert('承認処理中にエラーが発生しました: ' + error.message)
    }
  }

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : 'Unknown Product'
  }

  const getItemStatusInfo = (productId: string) => {
    const productItems = items.filter(item => item.product_id === productId)
    const availableItems = productItems.filter(item => item.status === 'available')
    const processingItems = productItems.filter(item => 
      ['returned', 'cleaning', 'maintenance'].includes(item.status)
    )
    
    return {
      available: availableItems.length,
      processing: processingItems.length,
      total: productItems.length
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'demo_cancelled': return 'bg-info text-info-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'returned': return '返却済み'
      case 'cleaning': return '消毒済み'
      case 'maintenance': return 'メンテナンス済み'
      case 'demo_cancelled': return 'デモキャンセル'
      default: return status
    }
  }



  // モバイル版UIコンポーネント
  const MobileApprovalUI = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      {/* ヘッダー */}
      <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-slate-800">承認待ち</h1>
          <div className="flex items-center space-x-2">
            <div className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {pendingOrders.length}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-600">承認が必要な発注があります</p>
      </div>

      {/* 承認待ちリスト */}
      <div className="space-y-3">
        {pendingOrders.map((order) => {
          const reqDate = new Date(order.required_date)
          const today = new Date()
          const diffDays = Math.ceil((reqDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const isUrgent = diffDays <= 2
          
          return (
            <div 
              key={order.id} 
              className={`bg-white/95 backdrop-blur-xl rounded-xl p-4 shadow-lg ${
                isUrgent ? 'border-l-4 border-rose-500' : ''
              }`}
            >
              {/* オーダーヘッダー */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-sm">#{order.id}</h3>
                    {isUrgent && (
                      <span className="bg-rose-100 text-rose-600 text-xs px-2 py-0.5 rounded-full font-medium">
                        緊急
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    {order.customer_name}様 • {order.created_by}
                  </p>
                  <p className="text-xs text-slate-700 line-clamp-2">
                    希望日: {order.required_date}
                  </p>
                </div>
              </div>

              {/* 商品リスト */}
              <div className="space-y-2 mb-4">
                {order.items.slice(0, 2).map((item) => {
                  const product = products.find(p => p.id === item.product_id)
                  return (
                    <div key={item.id} className="bg-slate-50 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700">
                          {product?.name || `商品ID: ${item.product_id}`}
                        </span>
                        <span className="text-xs text-slate-500">
                          数量: {item.quantity}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {order.items.length > 2 && (
                  <div className="text-xs text-slate-500 text-center">
                    他 {order.items.length - 2} 件
                  </div>
                )}
              </div>

              {/* アクションボタン - 同じhandleApprovalActionを使用 */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleApprovalAction(order, 'approve')}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2 rounded-lg"
                >
                  承認
                </Button>
                <Button
                  onClick={() => handleApprovalAction(order, 'reject')}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium py-2 rounded-lg"
                >
                  却下
                </Button>
              </div>
            </div>
          )
        })}
        
        {pendingOrders.length === 0 && (
          <div className="text-center py-8 text-white/60">
            <div className="text-4xl mb-2">✅</div>
            <p>承認待ちの発注はありません</p>
          </div>
        )}
      </div>
    </div>
  )

  // デスクトップ版UIコンポーネント
  const DesktopApprovalUI = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">発注承認管理</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-white/70">
            承認待ち: <span className="font-semibold text-white">{pendingOrders.length}</span>件
          </span>
          <Button variant="outline" onClick={() => loadData()}>
            <span className="mr-2">🔄</span>
            更新
          </Button>
        </div>
      </div>

      {/* 承認待ちリスト */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-3 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">承認待ち発注一覧</h2>
          
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/70">承認待ちの発注はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => {
                const reqDate = new Date(order.required_date)
                const today = new Date()
                const diffDays = Math.ceil((reqDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const isUrgent = diffDays <= 2

                return (
                  <div key={order.id} className={`border rounded-lg p-4 ${isUrgent ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-foreground text-sm">{order.id}</h3>
                          <span className="text-sm text-muted-foreground">
                            {order.customer_name}様
                          </span>
                          {isUrgent && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground">
                              緊急
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">担当者:</span>
                            <span className="ml-1 text-foreground">{order.assigned_to}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">持出者:</span>
                            <span className="ml-1 text-foreground">{order.carried_by}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">希望日:</span>
                            <span className="ml-1 text-foreground">{order.required_date}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">作成者:</span>
                            <span className="ml-1 text-foreground">{order.created_by}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprovalAction(order, 'approve')}
                          className="bg-success/10 border-success/20 hover:bg-success/20 text-success"
                        >
                          <span className="mr-1">✅</span>
                          承認
                        </Button>
                        <Button
                          variant="outline"
                          size="sm" 
                          onClick={() => handleApprovalAction(order, 'reject')}
                          className="bg-destructive/10 border-destructive/20 hover:bg-destructive/20 text-destructive"
                        >
                          <span className="mr-1">❌</span>
                          拒否
                        </Button>
                      </div>
                    </div>

                    {/* 商品リスト */}
                    <div className="space-y-2 mb-3">
                      <h4 className="font-medium text-foreground text-sm">発注商品</h4>
                      {order.items.map((item) => {
                        const statusInfo = getItemStatusInfo(item.product_id)
                        const productName = getProductName(item.product_id)
                        
                        return (
                          <div key={item.id} className="p-2 bg-background/50 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-foreground text-sm">{productName}</span>
                              <span className="text-xs text-muted-foreground">
                                数量: {item.quantity}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-success">利用可能: {statusInfo.available}</span>
                                <span className="text-warning">処理中: {statusInfo.processing}</span>
                              </div>
                              <div className="text-right">
                                {statusInfo.available + statusInfo.processing >= item.quantity ? (
                                  <span className="text-success text-xs">✅ 在庫充足</span>
                                ) : (
                                  <span className="text-destructive text-xs">❌ 在庫不足</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {order.notes && (
                      <div className="mt-3 p-2 bg-accent/30 rounded-lg">
                        <p className="text-xs text-foreground">
                          <span className="font-medium">備考:</span> {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )

  return (
    <>
      {/* UI分岐：同じイベントハンドラーを使用 */}
      {isMobile ? <MobileApprovalUI /> : <DesktopApprovalUI />}
      
      {/* 共通ダイアログ */}
      <Dialog 
        open={showApprovalDialog} 
        onOpenChange={setShowApprovalDialog}
      >
        <DialogContent className="max-w-sm md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalForm.action === 'approve' ? '発注承認' : '発注拒否'}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.id} - {selectedOrder?.customer_name}様
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvalNotes" className="text-sm font-medium text-foreground">
                {approvalForm.action === 'approve' ? '承認' : '拒否'}理由・備考
              </Label>
              <Input
                id="approvalNotes"
                value={approvalForm.notes}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="理由や備考を入力してください"
                className="mt-2"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowApprovalDialog(false)}
                className="w-full sm:w-auto"
              >
                キャンセル
              </Button>
              <Button 
                onClick={handleApprovalSubmit}
                className={`w-full sm:w-auto ${
                  approvalForm.action === 'approve' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {approvalForm.action === 'approve' ? '承認実行' : '拒否実行'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}