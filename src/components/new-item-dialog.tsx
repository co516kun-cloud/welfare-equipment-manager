import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { supabaseDb } from '../lib/supabase-database'
import { useInventoryStore } from '../stores/useInventoryStore'
import type { ProductItem, ProductCategory, Product } from '../types'

interface NewItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ProductCategory[]
  products: Product[]
  items: ProductItem[]
  currentUser: string
  onSuccess: () => void
}

export function NewItemDialog({ 
  open, 
  onOpenChange, 
  categories, 
  products, 
  items, 
  currentUser, 
  onSuccess 
}: NewItemDialogProps) {
  const { addProductItem } = useInventoryStore()
  // 登録タイプ
  const [registrationType, setRegistrationType] = useState<'existing' | 'new'>('existing')
  
  // 新規アイテムフォーム
  const [newItemForm, setNewItemForm] = useState({
    productId: '',
    managementId: '',
    condition: 'good' as ProductItem['condition'],
    location: '倉庫',
    notes: ''
  })
  
  // 新規商品フォーム
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    categoryId: '',
    description: '',
    manufacturer: '',
    model: ''
  })
  
  const [registrationError, setRegistrationError] = useState('')

  // フォームをリセット
  const resetForms = () => {
    setRegistrationType('existing')
    setNewItemForm({
      productId: '',
      managementId: '',
      condition: 'good',
      location: '倉庫',
      notes: ''
    })
    setNewProductForm({
      name: '',
      categoryId: '',
      description: '',
      manufacturer: '',
      model: ''
    })
    setRegistrationError('')
  }

  // 新規アイテム登録処理
  const handleNewItemSubmit = async () => {
    try {
      setRegistrationError('')
      
      // バリデーション
      if (!newItemForm.managementId.trim()) {
        setRegistrationError('管理番号を入力してください')
        return
      }
      
      // 管理番号の重複チェック
      const existingItem = items.find(item => item.id === newItemForm.managementId.trim())
      if (existingItem) {
        setRegistrationError('この管理番号は既に使用されています')
        return
      }
      
      let productId = newItemForm.productId
      
      // 新規商品の場合は先に商品を登録
      if (registrationType === 'new') {
        if (!newProductForm.name || !newProductForm.categoryId) {
          setRegistrationError('商品名とカテゴリーは必須です')
          return
        }
        
        const newProduct = {
          id: `PROD-${Date.now()}`,
          name: newProductForm.name,
          category_id: newProductForm.categoryId,
          description: newProductForm.description || '',
          manufacturer: newProductForm.manufacturer || '',
          model: newProductForm.model || ''
        }
        
        await supabaseDb.saveProduct(newProduct)
        productId = newProduct.id
      } else {
        // 既存商品の場合
        if (!newItemForm.productId) {
          setRegistrationError('商品を選択してください')
          return
        }
      }
      
      // 新規アイテムを作成（ストア経由で楽観的追加）
      const newItemData: Omit<ProductItem, 'id'> = {
        qr_code: newItemForm.managementId.trim(), // 管理番号と同じ値
        product_id: productId,
        status: 'available',
        condition: newItemForm.condition,
        location: newItemForm.location || '倉庫',
        notes: newItemForm.notes || ''
      }
      
      await addProductItem(newItemData)
      
      // idを取得するために生成されたアイテムIDを作成
      const newItem: ProductItem = {
        id: newItemForm.managementId.trim(),
        ...newItemData
      }
      
      // 履歴を記録
      await supabaseDb.createItemHistory(
        newItem.id,
        '新規登録',
        'available',
        'available',
        currentUser,
        {
          location: newItem.location,
          condition: newItem.condition,
          notes: `新規登録: ${registrationType === 'new' ? '新規商品' : '既存商品'}`,
          metadata: {
            registrationType: registrationType,
            productId: productId
          }
        }
      )
      
      // 成功メッセージ
      alert(`管理番号 ${newItem.id} を登録しました`)
      
      // ダイアログを閉じてリロード
      resetForms()
      onOpenChange(false)
      onSuccess()
      
    } catch (error) {
      console.error('Registration error:', error)
      setRegistrationError(`登録エラー: ${error.message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        resetForms()
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規登録</DialogTitle>
          <DialogDescription>
            商品アイテムを新規登録します
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 登録タイプ選択 */}
          <div>
            <Label>登録タイプ</Label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="registrationType"
                  value="existing"
                  checked={registrationType === 'existing'}
                  onChange={() => setRegistrationType('existing')}
                  className="w-4 h-4"
                />
                <span>既存商品</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="registrationType"
                  value="new"
                  checked={registrationType === 'new'}
                  onChange={() => setRegistrationType('new')}
                  className="w-4 h-4"
                />
                <span>新規商品</span>
              </label>
            </div>
          </div>

          {/* 既存商品の場合 */}
          {registrationType === 'existing' && (
            <div>
              <Label htmlFor="productSelect">商品選択 <span className="text-destructive">*</span></Label>
              <Select
                id="productSelect"
                value={newItemForm.productId}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, productId: e.target.value }))}
                className="mt-1"
              >
                <option value="">商品を選択してください</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* 新規商品の場合 */}
          {registrationType === 'new' && (
            <div>
              <div>
                <Label htmlFor="productName">商品名 <span className="text-destructive">*</span></Label>
                <Input
                  id="productName"
                  type="text"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 電動車椅子 Model-X"
                />
              </div>
              
              <div>
                <Label htmlFor="categorySelect">カテゴリー <span className="text-destructive">*</span></Label>
                <Select
                  id="categorySelect"
                  value={newProductForm.categoryId}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, categoryId: e.target.value }))}
                >
                  <option value="">カテゴリーを選択</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              
              <div>
                <Label htmlFor="manufacturer">メーカー</Label>
                <Input
                  id="manufacturer"
                  type="text"
                  value={newProductForm.manufacturer}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                  placeholder="例: パナソニック"
                />
              </div>
              
              <div>
                <Label htmlFor="model">型番</Label>
                <Input
                  id="model"
                  type="text"
                  value={newProductForm.model}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="例: PW-X100"
                />
              </div>
              
              <div>
                <Label htmlFor="description">説明</Label>
                <Input
                  id="description"
                  type="text"
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="商品の特徴など"
                />
              </div>
            </div>
          )}

          {/* 共通フィールド */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label htmlFor="managementId">管理番号 <span className="text-destructive">*</span></Label>
              <Input
                id="managementId"
                type="text"
                className="font-mono"
                value={newItemForm.managementId}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, managementId: e.target.value.toUpperCase() }))}
                placeholder="例: WC-001, BED-002"
              />
            </div>
            
            <div>
              <Label>QRコード</Label>
              <div className="p-3 bg-secondary/20 rounded-md font-mono text-sm">
                {newItemForm.managementId || '（管理番号と同じ値）'}
              </div>
            </div>
            
            <div>
              <Label htmlFor="condition">商品状態</Label>
              <Select
                id="condition"
                value={newItemForm.condition}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, condition: e.target.value as ProductItem['condition'] }))}
              >
                <option value="excellent">優良</option>
                <option value="good">良好</option>
                <option value="fair">普通</option>
                <option value="needs_repair">要修理</option>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="location">保管場所</Label>
              <Input
                id="location"
                value={newItemForm.location}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="例: 倉庫A-1"
              />
            </div>
            
            <div>
              <Label htmlFor="newNotes">メモ</Label>
              <Input
                id="newNotes"
                value={newItemForm.notes}
                onChange={(e) => setNewItemForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="特記事項があれば入力"
              />
            </div>
          </div>

          {/* エラー表示 */}
          {registrationError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{registrationError}</p>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleNewItemSubmit}>
              登録
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}