import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { getChecklistConfig, type ChecklistItem } from '../lib/maintenance-checklist-config'

interface MaintenanceChecklistProps {
  isOpen: boolean
  onClose: () => void
  productCategoryId: string
  productName: string
  onComplete: (checklistData: ChecklistResult) => void
}

export interface ChecklistResult {
  allItemsOK: boolean
  checkedItems: Record<string, boolean>
  subcategory?: string
  checkedAt: string
  method: 'detailed' // 詳細チェック
}

export function MaintenanceChecklist({
  isOpen,
  onClose,
  productCategoryId,
  productName,
  onComplete
}: MaintenanceChecklistProps) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  
  const config = getChecklistConfig(productCategoryId)
  
  console.log('MaintenanceChecklist props:', {
    isOpen,
    productCategoryId,
    productName,
    config
  })
  
  useEffect(() => {
    if (isOpen && config) {
      // デフォルトで全項目をチェック済みにする
      const items = selectedSubcategory 
        ? config.subcategories?.find(sub => sub.id === selectedSubcategory)?.items || []
        : config.items || []
      
      const defaultChecked: Record<string, boolean> = {}
      items.forEach(item => {
        defaultChecked[item.id] = true
      })
      setCheckedItems(defaultChecked)
    }
  }, [isOpen, config, selectedSubcategory])
  
  useEffect(() => {
    // ダイアログを開く時にサブカテゴリをリセット
    if (isOpen) {
      setSelectedSubcategory(null)
    }
  }, [isOpen])
  
  if (!config) {
    return null
  }
  
  const handleItemCheck = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
    }))
  }
  
  const handleComplete = () => {
    const allItemsOK = Object.values(checkedItems).every(checked => checked)
    
    const checklistData: ChecklistResult = {
      allItemsOK,
      checkedItems,
      subcategory: selectedSubcategory || undefined,
      checkedAt: new Date().toISOString(),
      method: 'detailed'
    }
    
    onComplete(checklistData)
    onClose()
  }
  
  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId)
  }
  
  const handleBackToCategories = () => {
    setSelectedSubcategory(null)
  }
  
  // サブカテゴリ選択画面
  if (config.subcategories && !selectedSubcategory) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📋 メンテナンスチェック
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-800">{productName}</p>
              <p className="text-sm text-gray-600">{config.categoryName}</p>
            </div>
            
            <div className="space-y-2">
              <p className="font-medium text-gray-700 text-center">種類を選択してください</p>
              {config.subcategories.map(subcategory => (
                <Button
                  key={subcategory.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleSubcategorySelect(subcategory.id)}
                >
                  <div className="text-left">
                    <div className="font-medium">{subcategory.name}</div>
                    <div className="text-xs text-gray-500">{subcategory.items.length}項目</div>
                  </div>
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  
  // チェックリスト画面
  const currentItems = selectedSubcategory 
    ? config.subcategories?.find(sub => sub.id === selectedSubcategory)?.items || []
    : config.items || []
  
  const currentSubcategoryName = selectedSubcategory 
    ? config.subcategories?.find(sub => sub.id === selectedSubcategory)?.name
    : null
  
  const uncheckedCount = Object.values(checkedItems).filter(checked => !checked).length
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 メンテナンスチェックリスト
            {uncheckedCount > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm">
                {uncheckedCount}項目で異常
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* ヘッダー情報 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-800">{productName}</p>
            <p className="text-sm text-gray-600">
              {config.categoryName}
              {currentSubcategoryName && ` - ${currentSubcategoryName}`}
            </p>
          </div>
          
          {/* 説明 */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              ✅ 異常がない項目はチェックが入った状態です<br/>
              ⚠️ 異常がある項目のチェックを外してください
            </p>
          </div>
          
          {/* チェック項目 */}
          <div className="space-y-3">
            {currentItems.map(item => {
              const isChecked = checkedItems[item.id] || false
              return (
                <div
                  key={item.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors ${
                    isChecked 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={item.id}
                      checked={isChecked}
                      onChange={(e) => handleItemCheck(item.id, e.target.checked)}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                  </div>
                  <label 
                    htmlFor={item.id}
                    className={`flex-1 cursor-pointer ${
                      isChecked ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    <span className="mr-2">
                      {isChecked ? '✅' : '❌'}
                    </span>
                    {item.name}
                  </label>
                </div>
              )
            })}
          </div>
          
          {/* アクションボタン */}
          <div className="flex gap-2 pt-4 border-t">
            {config.subcategories && selectedSubcategory && (
              <Button variant="outline" onClick={handleBackToCategories}>
                ← 種類選択に戻る
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              ✅ 確認完了
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}