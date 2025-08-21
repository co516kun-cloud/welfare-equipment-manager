import { useState } from 'react'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { getChecklistConfig } from '../lib/maintenance-checklist-config'

interface SubcategorySelectorProps {
  productCategoryId: string
  selectedSubcategory: string | null
  onSubcategoryChange: (subcategoryId: string | null) => void
  onOpenChecklist: () => void
  checklistResult?: {
    allItemsOK: boolean
    subcategory?: string
  } | null
}

export function SubcategorySelector({
  productCategoryId,
  selectedSubcategory,
  onSubcategoryChange,
  onOpenChecklist,
  checklistResult
}: SubcategorySelectorProps) {
  const config = getChecklistConfig(productCategoryId)
  
  // サブカテゴリがない商品の場合は何も表示しない
  if (!config?.subcategories) {
    return null
  }
  
  const handleSubcategoryToggle = (subcategoryId: string) => {
    // 既に選択されている場合は選択解除、そうでなければ選択
    const newSelection = selectedSubcategory === subcategoryId ? null : subcategoryId
    onSubcategoryChange(newSelection)
  }
  
  return (
    <div className="border-t pt-4">
      <div className="space-y-3">
        <div>
          <Label>📋 点検項目の種類</Label>
          <p className="text-xs text-muted-foreground">
            該当する種類を選択してください
          </p>
        </div>
        
        {/* サブカテゴリ選択 */}
        <div className="space-y-2">
          {config.subcategories.map(subcategory => {
            const isSelected = selectedSubcategory === subcategory.id
            return (
              <div
                key={subcategory.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => handleSubcategoryToggle(subcategory.id)}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSubcategoryToggle(subcategory.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-gray-800">
                    {subcategory.name}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({subcategory.items.length}項目)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* チェックリストボタン（サブカテゴリが選択されている場合のみ表示） */}
        {selectedSubcategory && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                問題がある場合のみ詳細チェック
              </p>
              {checklistResult && checklistResult.subcategory === selectedSubcategory && (
                <span className={`px-2 py-1 rounded-full text-xs ${
                  checklistResult.allItemsOK 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {checklistResult.allItemsOK ? '✅ 全項目OK' : '⚠️ 異常項目あり'}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenChecklist()
              }}
            >
              📋 チェックリスト
            </Button>
          </div>
        )}
        
        {/* 選択が必要な場合の注意メッセージ */}
        {!selectedSubcategory && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ メンテナンス項目の種類を選択してください
            </p>
          </div>
        )}
      </div>
    </div>
  )
}