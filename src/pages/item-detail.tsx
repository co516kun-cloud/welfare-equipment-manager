import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabaseDb } from '../lib/supabase-database'
import { getChecklistConfig } from '../lib/maintenance-checklist-config'
import { useAuth } from '../hooks/useAuth'
import { useInventoryStore } from '../stores/useInventoryStore'
import type { ProductItem, Product, ItemHistory } from '../types'

export function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { users, updateItemStatus } = useInventoryStore()
  
  const [item, setItem] = useState<ProductItem | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [histories, setHistories] = useState<ItemHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null)
  const [showAllHistories, setShowAllHistories] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  
  // 編集関連
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({
    status: '',
    condition: '',
    location: '',
    customerName: '',
    loanStartDate: '',
    notes: ''
  })

  useEffect(() => {
    if (itemId) {
      loadItemData(itemId)
    }
  }, [itemId])

  const loadItemData = async (id: string) => {
    setLoading(true)
    
    try {
      const itemData = await supabaseDb.getProductItemById(id)
      if (itemData) {
        setItem(itemData)
        
        const productData = await supabaseDb.getProductById(itemData.product_id)
        setProduct(productData)
        
        const itemHistories = await supabaseDb.getItemHistoriesByItemId(id)
        const sortedHistories = itemHistories.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setHistories(sortedHistories)
        
        // 貸与中の場合、対応する発注を検索
        if (itemData.status === 'rented') {
          const orders = await supabaseDb.getOrders()
          const relatedOrder = orders.find(order =>
            order.items.some(orderItem =>
              orderItem.assigned_item_ids?.includes(itemData.id)
            )
          )
          setCurrentOrder(relatedOrder)
        } else {
          setCurrentOrder(null)
        }
      }
    } catch (error) {
      console.error('Error loading item data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return '管理者'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || 'ユーザー'
  }
  
  // 編集ダイアログを開く
  const handleEdit = () => {
    if (!item) return
    
    setEditForm({
      status: item.status,
      condition: item.condition,
      location: item.location || '',
      customerName: item.customer_name || '',
      loanStartDate: item.loan_start_date || '',
      notes: item.condition_notes || ''
    })
    setShowEditDialog(true)
  }
  
  // 編集を実行
  const handleEditSubmit = async () => {
    if (!item) return
    
    try {
      const updatedItem = {
        id: item.id,
        qr_code: item.qr_code,
        product_id: item.product_id,
        status: editForm.status,
        condition: editForm.condition,
        location: editForm.location || item.location,
        customer_name: editForm.customerName || undefined,
        loan_start_date: editForm.loanStartDate || undefined,
        condition_notes: editForm.notes
      }
      
      // 楽観的更新でステータスを即座に反映
      await updateItemStatus(item.id, updatedItem.status)
      
      // ステータス以外の属性も更新
      await supabaseDb.saveProductItem(updatedItem)
      
      // 履歴を記録
      await supabaseDb.createItemHistory(
        item.id,
        '商品情報更新',
        item.status,
        editForm.status,
        getCurrentUserName(),
        {
          location: editForm.location,
          condition: editForm.condition,
          notes: editForm.notes,
          customerName: editForm.customerName,
          metadata: {
            updateType: 'item_detail_edit',
            previousLocation: item.location,
            previousCondition: item.condition,
            previousCustomerName: item.customer_name,
            previousNotes: item.condition_notes
          }
        }
      )
      
      setShowEditDialog(false)
      
      // データを再読み込み
      await loadItemData(item.id)
      alert('商品情報を更新しました')
    } catch (error) {
      console.error('編集エラー:', error)
      alert('編集中にエラーが発生しました')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'rented': return 'bg-info text-info-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'demo_cancelled': return 'bg-info text-info-foreground'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '消毒済み'
      case 'maintenance': return 'メンテナンス済み'
      case 'demo_cancelled': return 'デモキャンセル'
      case 'out_of_order': return '故障中'
      default: return status
    }
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-success text-success-foreground'
      case 'good': return 'bg-info text-info-foreground'
      case 'fair': return 'bg-warning text-warning-foreground'
      case 'caution': return 'bg-orange-500 text-white'
      case 'needs_repair': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-muted text-muted-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'excellent': return '優良'
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'caution': return '注意'
      case 'needs_repair': return '要修理'
      case 'unknown': return '不明'
      default: return condition
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('返却')) return '📦'
    if (action.includes('貸与')) return '🏠'
    if (action.includes('消毒')) return '🧽'
    if (action.includes('メンテナンス')) return '🔧'
    if (action.includes('入庫')) return '📥'
    if (action.includes('デモ')) return '🎯'
    return '📋'
  }

  const renderChecklistDetails = (history: ItemHistory) => {
    const checklistData = history.metadata?.maintenanceChecklist
    if (!checklistData || !product) return null

    const config = getChecklistConfig(product.category_id || product.category || 'beds')
    if (!config) return null

    const currentItems = checklistData.subcategory 
      ? config.subcategories?.find(sub => sub.id === checklistData.subcategory)?.items || []
      : config.items || []

    const currentSubcategoryName = checklistData.subcategory 
      ? config.subcategories?.find(sub => sub.id === checklistData.subcategory)?.name
      : null

    const okCount = currentItems.filter(item => checklistData.checkedItems[item.id] !== false).length
    const ngCount = currentItems.length - okCount

    return (
      <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* ヘッダー情報 */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-base font-semibold text-gray-900">📋 メンテナンス点検記録</h4>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              checklistData.allItemsOK 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {checklistData.allItemsOK ? '✅ 全項目正常' : '⚠️ 異常あり'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">実施者:</span>
              <span className="ml-2 font-medium text-gray-900">{history.performed_by}</span>
            </div>
            <div>
              <span className="text-gray-600">実施日時:</span>
              <span className="ml-2 font-medium text-gray-900">
                {new Date(checklistData.checkedAt).toLocaleString('ja-JP')}
              </span>
            </div>
          </div>

          {currentSubcategoryName && (
            <div className="mt-2">
              <span className="text-gray-600">点検種別:</span>
              <span className="ml-2 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {currentSubcategoryName}
              </span>
            </div>
          )}
        </div>

        {/* 集計情報 */}
        <div className="mb-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-600">正常項目: <span className="font-semibold text-green-700">{okCount}項目</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="text-gray-600">異常項目: <span className="font-semibold text-red-700">{ngCount}項目</span></span>
          </div>
          <div className="text-gray-600">
            全体: <span className="font-semibold">{currentItems.length}項目</span>
          </div>
        </div>

        {/* 全項目の詳細 */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 mb-3">点検項目詳細</h5>
          {currentItems.map((item, index) => {
            const isChecked = checklistData.checkedItems[item.id] !== false
            return (
              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                isChecked 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isChecked 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isChecked ? '✅' : '❌'}</span>
                    <span className={`font-medium ${
                      isChecked ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="text-xs mt-1">
                    <span className={`px-2 py-1 rounded-full font-medium ${
                      isChecked 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-red-200 text-red-800'
                    }`}>
                      {isChecked ? '正常' : '異常・要確認'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* フッター情報 */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div className="flex justify-between items-center">
            <span>記録ID: {history.id}</span>
            <span>商品ID: {history.item_id}</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <span className="mr-2">←</span>
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!item || !product) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <span className="mr-2">←</span>
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">商品が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleEdit}
            className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          >
            ✏️ 編集
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <span className="mr-2">←</span>
            戻る
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">商品情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">商品名</p>
                <p className="font-medium text-foreground">{product.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">管理番号</p>
                <p className="font-medium text-foreground">{item.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">メーカー</p>
                <p className="font-medium text-foreground">{product.manufacturer}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">型番</p>
                <p className="font-medium text-foreground">{product.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">QRコード</p>
                <p className="font-medium text-foreground font-mono">{item.qr_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">現在の場所</p>
                <p className="font-medium text-foreground">{item.location}</p>
              </div>
              {item.condition_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">状態メモ</p>
                  <p className="font-medium text-foreground">{item.condition_notes}</p>
                </div>
              )}
            </div>
            
            {item.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">備考</p>
                <p className="text-foreground">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Status and Condition */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">現在の状態</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">ステータス</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">商品状態</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConditionColor(item.condition)}`}>
                  {getConditionText(item.condition)}
                </span>
              </div>
            </div>
          </div>

          {/* Loan Information */}
          {item.loan_start_date && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">貸与情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">貸与開始日</p>
                  <p className="font-medium text-foreground">{new Date(item.loan_start_date).toLocaleDateString('ja-JP')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">貸与期間</p>
                  <p className="font-medium text-foreground">
                    {(() => {
                      const startDate = new Date(item.loan_start_date)
                      const today = new Date()
                      const diffTime = Math.abs(today.getTime() - startDate.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return `${diffDays}日間`
                    })()}
                  </p>
                </div>
                {currentOrder && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">貸与先顧客</p>
                      <p className="font-medium text-foreground">{currentOrder.customer_name}様</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">担当者</p>
                      <p className="font-medium text-foreground">{currentOrder.assigned_to}</p>
                    </div>
                    {currentOrder.carried_by && currentOrder.carried_by !== currentOrder.assigned_to && (
                      <div>
                        <p className="text-sm text-muted-foreground">持出者</p>
                        <p className="font-medium text-foreground">{currentOrder.carried_by}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">発注ID</p>
                      <p className="font-medium text-foreground text-xs">{currentOrder.id}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* History Timeline */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">業務フロー履歴</h2>
            
            {histories.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                履歴がありません
              </p>
            ) : (
              <div className="space-y-4">
                {(showAllHistories ? histories : histories.slice(0, 5)).map((history, index) => (
                  <div key={history.id} className="relative">
                    {index !== histories.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-8 bg-border"></div>
                    )}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm">{getActionIcon(history.action)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">
                            {history.action}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(history.timestamp).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.from_status)}`}>
                            {getStatusText(history.from_status)}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.to_status)}`}>
                            {getStatusText(history.to_status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          実行者: {history.performed_by}
                        </p>
                        {history.location && (
                          <p className="text-xs text-muted-foreground">
                            場所: {history.location}
                          </p>
                        )}
                        {history.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            備考: {history.notes}
                          </p>
                        )}
                        
                        {/* メンテナンス履歴の場合のチェックリスト詳細 */}
                        {history.action.includes('メンテナンス') && history.metadata?.maintenanceChecklist && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedChecklist(
                                expandedChecklist === history.id ? null : history.id
                              )}
                              className="text-xs h-6 px-2"
                            >
                              {expandedChecklist === history.id ? '📋 チェックリスト詳細を隠す' : '📋 チェックリスト詳細を表示'}
                            </Button>
                            {expandedChecklist === history.id && renderChecklistDetails(history)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* もっと見る / 閉じる ボタン */}
                {histories.length > 5 && (
                  <div className="flex justify-center pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllHistories(!showAllHistories)}
                      className="text-sm"
                    >
                      {showAllHistories 
                        ? `📈 履歴を閉じる (${histories.length - 5}件を非表示)`
                        : `📈 もっと見る (${histories.length - 5}件の履歴)`
                      }
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">クイックアクション</h2>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate(`/scan?item=${item.id}`)}
              >
                <span className="mr-2">📱</span>
                QRスキャン
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate(`/inventory?item=${item.id}`)}
              >
                <span className="mr-2">📦</span>
                在庫管理で表示
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate(`/history?item=${item.id}`)}
              >
                <span className="mr-2">📋</span>
                履歴で表示
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>商品情報編集</DialogTitle>
            <DialogDescription>
              {item && `${item.id} の情報を編集します`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">ステータス</Label>
              <Select
                id="status"
                value={editForm.status}
                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                className="mt-1"
              >
                <option value="available">利用可能</option>
                <option value="reserved">予約済み</option>
                <option value="ready_for_delivery">配送準備完了</option>
                <option value="rented">貸与中</option>
                <option value="returned">返却済み</option>
                <option value="cleaning">清掃中</option>
                <option value="maintenance">メンテナンス中</option>
                <option value="out_of_order">故障中</option>
                <option value="unknown">不明</option>
              </Select>
            </div>
            
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
              <Label htmlFor="notes">備考・メモ</Label>
              <Input
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="備考やメモを入力"
                className="mt-1"
              />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={handleEditSubmit}>
                更新
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}