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
  const { updateItemStatus } = useInventoryStore()
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
      
      // 商品状態が「要修理」の場合はステータスを「故障中」に変更
      const newCondition = (actionForm.condition || selectedItem.condition) as ProductItem['condition']
      const finalStatus = newCondition === 'needs_repair' 
        ? 'out_of_order' as ProductItem['status']
        : action.nextStatus as ProductItem['status']

      // 楽観的更新でステータスを即座に反映（データベース保存も含む）
      await updateItemStatus(selectedItem.id, finalStatus)
      
      // ステータス以外の属性も更新が必要な場合は追加でDB保存
      if (
        (actionForm.condition && actionForm.condition !== selectedItem.condition) ||
        (actionForm.location && actionForm.location !== selectedItem.location) ||
        (shouldSaveConditionNotes && actionForm.conditionNotes !== (selectedItem.condition_notes || ''))
      ) {
        const updatedItem: ProductItem = {
          id: selectedItem.id,
          product_id: selectedItem.product_id,
          status: finalStatus,
          condition: newCondition,
          location: actionForm.location || selectedItem.location,
          qr_code: selectedItem.qr_code,
          condition_notes: newConditionNotes,
          customer_name: selectedItem.customer_name,
          loan_start_date: selectedItem.loan_start_date
        }
        await supabaseDb.saveProductItem(updatedItem)
      }

      // 履歴を記録
      const historyMetadata: any = {
        scanMethod: 'QR',
        actionType: actionType
      }
      
      if (actionType === 'assign_to_order') {
        historyMetadata.orderId = actionForm.orderId
        historyMetadata.orderItemId = actionForm.orderItemId
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

      resetForm()
      onOpenChange(false)
      onSuccess()
      
    } catch (error) {
      console.error('Action execution error:', error)
      alert(`処理中にエラーが発生しました: ${error.message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        resetForm()
      }
    }}>
      <DialogContent className="max-w-md">
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
    </Dialog>
  )
}