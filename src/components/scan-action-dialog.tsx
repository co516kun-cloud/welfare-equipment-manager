import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { supabaseDb } from '../lib/supabase-database'
import { useInventoryStore } from '../stores/useInventoryStore'
import { MaintenanceChecklist, type ChecklistResult } from './maintenance-checklist'
import { SubcategorySelector } from './subcategory-selector'
import { getCategoryIdByName, getChecklistConfig } from '../lib/maintenance-checklist-config'
import { calculateRentalDays } from '../lib/utils'
import type { ProductItem, Product, Order, OrderItem } from '../types'

interface SelectedItem extends ProductItem {
  product?: Product
}

interface ScanActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItem: SelectedItem | null
  actionType: string
  availableOrders: {order: Order, item: OrderItem, product: Product}[]
  onSuccess: () => void
  getCurrentUserName: () => string
  orders: Order[]
}

export function ScanActionDialog({
  open,
  onOpenChange,
  selectedItem,
  actionType,
  availableOrders,
  onSuccess,
  getCurrentUserName,
  orders
}: ScanActionDialogProps) {
  const { items } = useInventoryStore()
  const [actionForm, setActionForm] = useState({
    condition: '',
    location: '',
    conditionNotes: '',
    orderId: '',
    orderItemId: '',
    photos: [] as string[]
  })

  const [showMaintenanceChecklist, setShowMaintenanceChecklist] = useState(false)
  const [checklistResult, setChecklistResult] = useState<ChecklistResult | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [showLabelPrintDialog, setShowLabelPrintDialog] = useState(false)

  // フォームをリセット
  const resetForm = () => {
    setActionForm({
      condition: '',
      location: '',
      conditionNotes: '',
      orderId: '',
      orderItemId: '',
      photos: []
    })
    setChecklistResult(null)
    setShowMaintenanceChecklist(false)
    setSelectedSubcategory(null)
    setShowLabelPrintDialog(false)
  }

  // 写真撮影機能
  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          setActionForm(prev => ({
            ...prev,
            photos: [...prev.photos, result]
          }))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // 写真削除
  const handlePhotoRemove = (index: number) => {
    setActionForm(prev => ({
      ...prev, 
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }
  
  // チェックリスト完了処理
  const handleChecklistComplete = (result: ChecklistResult) => {
    setChecklistResult(result)
  }
  
  // チェックリストボタンの処理
  const handleOpenChecklist = () => {
    setShowMaintenanceChecklist(true)
  }

  const getAvailableActions = (status: string) => {
    const actions = []
    
    switch (status) {
      case 'rented':
        actions.push(
          { key: 'return', label: '返却', nextStatus: 'returned' },
          { key: 'demo_cancel', label: 'デモキャンセル', nextStatus: 'demo_cancelled' },
          { key: 'demo_cancel_storage', label: 'デモキャン入庫', nextStatus: 'available' }
        )
        break
      case 'returned':
        actions.push(
          { key: 'clean', label: '消毒完了', nextStatus: 'cleaning' }
        )
        break
      case 'cleaning':
        actions.push(
          { key: 'maintenance', label: 'メンテナンス完了', nextStatus: 'maintenance' }
        )
        break
      case 'maintenance':
        actions.push(
          { key: 'storage', label: '入庫処理', nextStatus: 'available' }
        )
        break
      case 'demo_cancelled':
        actions.push(
          { key: 'storage', label: '入庫処理', nextStatus: 'available' }
        )
        break
      case 'available':
        if (availableOrders.length > 0) {
          actions.push(
            { key: 'assign_to_order', label: '発注に割り当て', nextStatus: 'rented' }
          )
        }
        break
      case 'out_of_order':
        actions.push(
          { key: 'repair', label: '修理完了', nextStatus: 'available' }
        )
        break
    }
    
    return actions
  }

  const handleActionSubmit = async () => {
    if (!selectedItem) return

    const action = getAvailableActions(selectedItem.status).find(a => a.key === actionType)
    if (!action) return

    // サーバー側の最新ステータスを確認（二重処理防止）
    try {
      const latestItem = await supabaseDb.getProductItemById(selectedItem.id)
      if (latestItem && latestItem.status !== selectedItem.status) {
        alert(`この商品は既に別の処理が行われています。\n\n現在のステータス: ${latestItem.status}\n\n画面を更新します。`)
        // ストアを最新状態に更新
        const currentItems = useInventoryStore.getState().items
        useInventoryStore.setState({
          items: currentItems.map(i => i.id === latestItem.id ? latestItem : i)
        })
        onOpenChange(false)
        return
      }
    } catch (error) {
      console.error('ステータス確認エラー:', error)
    }

    // メンテナンス処理で、サブカテゴリが必要な商品の場合の検証
    if (actionType === 'maintenance' && selectedItem.product) {
      const categoryId = selectedItem.product.category_id || selectedItem.product.category
      const config = getChecklistConfig(categoryId)
      if (config?.subcategories && !selectedSubcategory) {
        alert('点検項目の種類を選択してください')
        return
      }
    }

    try {
      // 発注に割り当てる場合の特別処理
      if (actionType === 'assign_to_order') {
        if (!actionForm.orderId || !actionForm.orderItemId) {
          alert('発注を選択してください')
          return
        }
        
        try {
          // 発注に商品を割り当て
          const order = await supabaseDb.getOrderById(actionForm.orderId)
          if (order) {
            const updatedItems = order.items.map(item => 
              item.id === actionForm.orderItemId
                ? { ...item, assigned_item_ids: [...(item.assigned_item_ids || []), selectedItem.id] }
                : item
            )
            await supabaseDb.saveOrder({ ...order, items: updatedItems })
          }
        } catch (error) {
          console.error('Error assigning item to order:', error)
          alert('発注への割り当てに失敗しました')
          return
        }
      }

      // 状態メモはメンテナンス済み、修理完了時のみ保存
      const shouldSaveConditionNotes = ['maintenance', 'repair'].includes(actionType)
      const newConditionNotes = shouldSaveConditionNotes ? actionForm.conditionNotes : selectedItem.condition_notes
      
      // 返却処理の場合は貸与日数を計算して合計に加算
      let rentalDays = 0
      let newTotalRentalDays = selectedItem.total_rental_days || 0
      if (actionType === 'return' && selectedItem.loan_start_date) {
        rentalDays = calculateRentalDays(selectedItem.loan_start_date)
        newTotalRentalDays = (selectedItem.total_rental_days || 0) + rentalDays
      }

      // 商品状態が「要修理」の場合はステータスを「故障中」に変更
      const newCondition = (actionForm.condition || selectedItem.condition) as ProductItem['condition']
      const finalStatus = newCondition === 'needs_repair'
        ? 'out_of_order' as ProductItem['status']
        : action.nextStatus as ProductItem['status']

      // 全フィールドを含めて1回で保存（データベース + ストア更新）
      const updatedItem: ProductItem = {
        id: selectedItem.id,
        product_id: selectedItem.product_id,
        status: finalStatus,
        condition: newCondition,
        location: actionForm.location || selectedItem.location,
        qr_code: selectedItem.qr_code,
        condition_notes: newConditionNotes,
        photos: actionType === 'maintenance' ? actionForm.photos : selectedItem.photos,
        customer_name: selectedItem.customer_name, // 後でnullに更新
        loan_start_date: selectedItem.loan_start_date, // 後でnullに更新
        current_setting: selectedItem.current_setting,
        total_rental_days: newTotalRentalDays // 累積貸与日数を更新
      }

      // 返却処理の場合は貸与情報を明示的にnullにリセット
      if (actionType === 'return') {
        updatedItem.customer_name = undefined
        updatedItem.loan_start_date = undefined
      }

      // データベースに保存（1回の保存で全フィールドを更新）
      await supabaseDb.saveProductItem(updatedItem)

      // Zustandストアを即座に更新（楽観的更新）
      const updatedItems = items.map(i => i.id === updatedItem.id ? updatedItem : i)
      useInventoryStore.setState({ items: updatedItems })

      // 履歴を記録
      const historyMetadata: any = {
        scanMethod: 'QR',
        actionType: actionType
      }

      if (actionType === 'assign_to_order') {
        historyMetadata.orderId = actionForm.orderId
        historyMetadata.orderItemId = actionForm.orderItemId
      }

      // 返却処理の場合は貸与日数情報を記録
      if (actionType === 'return') {
        historyMetadata.rentalDays = rentalDays
        historyMetadata.totalRentalDays = newTotalRentalDays
        historyMetadata.loanStartDate = selectedItem.loan_start_date
        historyMetadata.returnDate = new Date().toISOString()
      }
      
      // チェックリストデータの準備（メンテナンス処理の場合）
      const finalChecklistData = actionType === 'maintenance' ? 
        (checklistResult || {
          allItemsOK: true,
          checkedItems: {},
          subcategory: selectedSubcategory || undefined,
          checkedAt: new Date().toISOString(),
          method: 'quick' // チェックリストボタンを押さなかった場合
        }) : undefined

      await supabaseDb.createItemHistory(
        selectedItem.id,
        newCondition === 'needs_repair' ? '故障中へ変更' : action.label,
        selectedItem.status,
        finalStatus,
        getCurrentUserName(),
        {
          location: actionForm.location || selectedItem.location,
          condition: actionForm.condition || selectedItem.condition,
          conditionNotes: shouldSaveConditionNotes ? actionForm.conditionNotes : undefined,
          customerName: actionType === 'assign_to_order' ?
            orders.find(o => o.id === actionForm.orderId)?.customer_name : undefined,
          photos: actionType === 'maintenance' ? actionForm.photos : undefined,
          metadata: {
            ...historyMetadata,
            actionType: actionType,
            conditionChanged: newCondition === 'needs_repair',
            originalNextStatus: action.nextStatus,
            photoCount: actionType === 'maintenance' ? actionForm.photos.length : 0,
            maintenanceChecklist: finalChecklistData
          }
        }
      )

      // 入庫処理の場合は印刷確認ダイアログを表示
      if (actionType === 'storage') {
        setShowLabelPrintDialog(true)
      } else {
        resetForm()
        onOpenChange(false)
        onSuccess()
      }

    } catch (error) {
      console.error('Action execution error:', error)
      alert(`処理中にエラーが発生しました: ${error.message}`)
    }
  }

  // ラベル印刷確認ダイアログの処理
  const handleLabelPrintConfirm = async () => {
    if (!selectedItem) return

    try {
      // 印刷待ちキューに追加
      await supabaseDb.addLabelPrintQueue({
        item_id: selectedItem.id,
        product_name: selectedItem.product?.name || '不明な商品',
        management_id: selectedItem.id,
        condition_notes: actionForm.conditionNotes || selectedItem.condition_notes || '',
        status: 'pending',
        created_by: getCurrentUserName()
      })

      alert('印刷待ちキューに追加しました')
    } catch (error) {
      console.error('印刷キューへの追加エラー:', error)
      alert('印刷待ちキューへの追加に失敗しました')
    }

    // ダイアログを閉じる
    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  const handleLabelPrintCancel = () => {
    // 印刷しない場合もダイアログを閉じる
    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        resetForm()
      }
    }}>
      <DialogContent className="max-w-md scan-action-dialog">
        <DialogHeader>
          <DialogTitle>
            {actionType === 'return' && '返却処理'}
            {actionType === 'demo_cancel' && 'デモキャンセル処理'}
            {actionType === 'demo_cancel_storage' && 'デモキャン入庫処理'}
            {actionType === 'clean' && '消毒完了処理'}
            {actionType === 'maintenance' && 'メンテナンス完了処理'}
            {actionType === 'storage' && '入庫処理'}
            {actionType === 'assign_to_order' && '発注に割り当て'}
            {actionType === 'repair' && '修理完了処理'}
          </DialogTitle>
          <DialogDescription>
            {selectedItem?.product?.name} #{selectedItem?.id} の処理を行います
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {actionType === 'assign_to_order' && (
            <div>
              <Label htmlFor="orderSelection">割り当てる発注を選択</Label>
              {availableOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-accent/20 rounded">
                  この商品に対応する承認済みの発注がありません
                </p>
              ) : (
                <div className="space-y-2">
                  {availableOrders.map(({ order, item, product }) => {
                    const assignedCount = item.assigned_item_ids ? item.assigned_item_ids.filter(id => id !== null && id !== undefined).length : 0
                    const remainingCount = item.quantity - assignedCount
                    
                    return (
                      <div 
                        key={`${order.id}-${item.id}`} 
                        className={`p-3 border border-border rounded-lg cursor-pointer hover:bg-accent/50 ${
                          actionForm.orderId === order.id && actionForm.orderItemId === item.id 
                            ? 'bg-primary/10 border-primary' 
                            : ''
                        }`}
                        onClick={() => setActionForm(prev => ({ ...prev, orderId: order.id, orderItemId: item.id }))}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{order.customer_name}様</p>
                            <p className="text-sm text-muted-foreground">発注番号: {order.id}</p>
                            <p className="text-sm text-muted-foreground">商品: {product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              数量: {assignedCount}/{item.quantity} 
                              {remainingCount > 0 && <span className="text-blue-600"> (残り{remainingCount}個)</span>}
                            </p>
                            <p className="text-sm text-muted-foreground">希望日: {order.requiredDate}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">担当: {order.assignedTo}</p>
                            <p className="text-sm text-muted-foreground">持出: {order.carriedBy}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          
          {(actionType === 'maintenance' || actionType === 'demo_cancel_storage' || actionType === 'repair') && (
            <div>
              <Label htmlFor="condition">商品状態</Label>
              <Select
                value={actionForm.condition}
                onChange={(e) => setActionForm(prev => ({ ...prev, condition: e.target.value }))}
              >
                <option value="">状態を選択</option>
                <option value="good">良好</option>
                <option value="fair">普通</option>
                <option value="caution">注意</option>
                {actionType !== 'repair' && <option value="needs_repair">要修理</option>}
              </Select>
            </div>
          )}
          
          {(actionType === 'maintenance' || actionType === 'repair') && (
            <div>
              <Label htmlFor="conditionNotes">状態メモ</Label>
              <Input
                id="conditionNotes"
                type="text"
                value={actionForm.conditionNotes}
                onChange={(e) => setActionForm(prev => ({ ...prev, conditionNotes: e.target.value }))}
                placeholder={
                  actionType === 'repair' 
                    ? '修理内容や修理後の状態を入力' 
                    : '商品の状態について詳細を入力'
                }
              />
            </div>
          )}

          {actionType === 'maintenance' && (
            <div>
              <Label>メンテナンス完了時の写真</Label>
              <div className="space-y-3">
                {/* 写真アップロードボタン */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoCapture}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div className="text-center">
                      <span className="text-2xl mb-2 block">📷</span>
                      <span className="text-sm text-muted-foreground">
                        写真を撮影または選択
                      </span>
                    </div>
                  </label>
                </div>

                {/* 撮影済み写真の表示 */}
                {actionForm.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {actionForm.photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`メンテナンス写真 ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePhotoRemove(index)}
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  メンテナンス完了後の商品状態を記録するため写真を撮影してください（任意）
                </p>
              </div>
            </div>
          )}
          
          {(actionType === 'storage' || actionType === 'demo_cancel_storage' || actionType === 'assign_to_order' || actionType === 'repair') && (
            <div>
              <Label htmlFor="location">保管場所</Label>
              <Input
                id="location"
                type="text"
                value={actionForm.location}
                onChange={(e) => setActionForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder={
                  actionType === 'assign_to_order' 
                    ? '送り先住所または配送先'
                  : actionType === 'repair'
                    ? '修理完了後の保管場所を入力'
                  : selectedItem?.location 
                    ? `前の場所: ${selectedItem.location}` 
                    : '保管場所を入力'
                }
              />
            </div>
          )}
          
          {/* メンテナンス処理の場合のサブカテゴリ選択とチェックリスト */}
          {actionType === 'maintenance' && selectedItem?.product && (
            <SubcategorySelector
              productCategoryId={selectedItem.product.category_id || selectedItem.product.category || 'beds'}
              selectedSubcategory={selectedSubcategory}
              onSubcategoryChange={setSelectedSubcategory}
              onOpenChecklist={handleOpenChecklist}
              checklistResult={checklistResult}
            />
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleActionSubmit}>
              処理実行
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* メンテナンスチェックリスト */}
      {selectedItem?.product && (
        <MaintenanceChecklist
          isOpen={showMaintenanceChecklist}
          onClose={() => setShowMaintenanceChecklist(false)}
          productCategoryId={selectedItem.product.category_id || selectedItem.product.category || 'beds'}
          productName={selectedItem.product.name}
          selectedSubcategory={selectedSubcategory}
          onComplete={handleChecklistComplete}
        />
      )}

      {/* ラベル印刷確認ダイアログ */}
      <Dialog open={showLabelPrintDialog} onOpenChange={setShowLabelPrintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ラベル印刷</DialogTitle>
            <DialogDescription>
              入庫処理が完了しました。梱包用のラベルを印刷しますか？
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-secondary/20 rounded-lg">
              <h3 className="font-bold mb-2">印刷内容</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">商品名:</dt>
                  <dd className="font-medium">{selectedItem?.product?.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">管理番号:</dt>
                  <dd className="font-mono font-medium">{selectedItem?.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">商品状態:</dt>
                  <dd>{actionForm.conditionNotes || selectedItem?.condition_notes || '(メモなし)'}</dd>
                </div>
              </dl>
            </div>

            <p className="text-sm text-muted-foreground">
              ※ 印刷待ちキューに追加されます。「ラベル印刷待ち」ページから印刷してください。
            </p>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleLabelPrintCancel}>
                印刷しない
              </Button>
              <Button onClick={handleLabelPrintConfirm}>
                印刷待ちに追加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}