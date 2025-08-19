import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { supabaseDb } from '../lib/supabase-database'
import type { DepositItem } from '../types'

export function Deposits() {
  const [depositItems, setDepositItems] = useState<DepositItem[]>([])
  const [filteredItems, setFilteredItems] = useState<DepositItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // 新規登録ダイアログ用の状態
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    itemName: '',
    notes: ''
  })
  const [addError, setAddError] = useState('')
  
  // 削除確認ダイアログ用の状態
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<DepositItem | null>(null)

  // 初期データ読み込み
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await supabaseDb.getDepositItems()
      setDepositItems(data)
      setFilteredItems(data)
    } catch (error) {
      console.error('Error loading deposit items:', error)
    }
  }

  // 検索機能
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(depositItems)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = depositItems.filter(item =>
        item.customerName.toLowerCase().includes(query) ||
        item.itemName.toLowerCase().includes(query) ||
        (item.notes && item.notes.toLowerCase().includes(query))
      )
      setFilteredItems(filtered)
    }
  }, [searchQuery, depositItems])

  // データ保存
  const saveData = async (item: DepositItem) => {
    try {
      await supabaseDb.saveDepositItem(item)
      await loadData() // データを再読み込み
    } catch (error) {
      console.error('Error saving deposit item:', error)
      alert('データの保存中にエラーが発生しました')
    }
  }

  // 新規登録
  const handleAddItem = () => {
    setAddForm({
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      itemName: '',
      notes: ''
    })
    setAddError('')
    setShowAddDialog(true)
  }

  const handleAddSubmit = async () => {
    if (!addForm.customerName.trim()) {
      setAddError('顧客名を入力してください')
      return
    }

    if (!addForm.itemName.trim()) {
      setAddError('商品名・部品名を入力してください')
      return
    }

    if (!addForm.date) {
      setAddError('預かり日を選択してください')
      return
    }

    const newItem: DepositItem = {
      id: `DEP-${String(depositItems.length + 1).padStart(3, '0')}`,
      date: addForm.date,
      customerName: addForm.customerName.trim(),
      itemName: addForm.itemName.trim(),
      notes: addForm.notes.trim() || undefined
    }

    await saveData(newItem)
    setShowAddDialog(false)
    alert(`${newItem.customerName}様の${newItem.itemName}を預かり品として登録しました`)
  }

  // 削除処理
  const handleDeleteItem = (item: DepositItem) => {
    setItemToDelete(item)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    try {
      await supabaseDb.deleteDepositItem(itemToDelete.id)
      await loadData() // データを再読み込み
      setShowDeleteDialog(false)
      setItemToDelete(null)
      alert(`${itemToDelete.customerName}様の${itemToDelete.itemName}を削除しました`)
    } catch (error) {
      console.error('Error deleting deposit item:', error)
      alert('削除中にエラーが発生しました')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">預かり品管理</h1>
        <Button 
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          onClick={handleAddItem}
        >
          <span className="mr-2">📦</span>
          新規預かり品登録
        </Button>
      </div>

      {/* 検索バー */}
      <div className="bg-card rounded-lg border border-border p-3 md:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="search" className="text-sm font-medium text-white">
              検索
            </Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="顧客名、商品名、備考で検索..."
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="text-xs"
            >
              クリア
            </Button>
          </div>
        </div>
      </div>

      {/* 預かり品一覧 */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-base md:text-lg font-semibold text-white">
              預かり品一覧
            </h2>
            <span className="text-xs md:text-sm text-muted-foreground">
              {searchQuery ? `検索結果: ${filteredItems.length}件` : `総数: ${depositItems.length}件`}
            </span>
          </div>
          
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-muted-foreground">
                  {searchQuery ? '検索結果が見つかりません' : '預かり品はありません'}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    className="mt-3"
                  >
                    検索をクリア
                  </Button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="space-y-3">
                    {/* ヘッダー */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">📦</span>
                          <div className="flex-1">
                            <p className="text-lg font-bold text-foreground">
                              {item.date}
                            </p>
                            <p className="text-lg font-semibold text-foreground">
                              {item.itemName}
                            </p>
                            <p className="text-lg font-semibold text-foreground">
                              {item.customerName}様
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-red-50 border-red-200 hover:bg-red-100 text-red-600 text-xs px-2 py-1"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <span className="mr-1">🗑️</span>
                        削除
                      </Button>
                    </div>

                    {/* 備考 */}
                    {item.notes && (
                      <div className="p-2 bg-accent/30 rounded-lg">
                        <p className="text-xs text-foreground">
                          <span className="font-medium">備考:</span> {item.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 新規登録ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新規預かり品登録</DialogTitle>
            <DialogDescription>
              新しい預かり品を登録します。<br />
              必要な情報を入力してください。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="depositDate">預かり日 <span className="text-destructive">*</span></Label>
              <Input
                id="depositDate"
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm(prev => ({ ...prev, date: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="customerName">顧客名 <span className="text-destructive">*</span></Label>
              <Input
                id="customerName"
                value={addForm.customerName}
                onChange={(e) => setAddForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="例: 山田太郎"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="itemName">商品名・部品名 <span className="text-destructive">*</span></Label>
              <Input
                id="itemName"
                value={addForm.itemName}
                onChange={(e) => setAddForm(prev => ({ ...prev, itemName: e.target.value }))}
                placeholder="例: 車椅子クッション、シャワーチェア部品"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">備考</Label>
              <Input
                id="notes"
                value={addForm.notes}
                onChange={(e) => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="預かり理由や注意事項など"
                className="mt-1"
              />
            </div>

            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowAddDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleAddSubmit}>
                登録
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>預かり品削除の確認</DialogTitle>
            <DialogDescription>
              {itemToDelete && (
                <>
                  <strong>{itemToDelete.customerName}様</strong>の<br />
                  <strong>{itemToDelete.itemName}</strong><br />
                  を削除しますか？
                  <br />
                  <br />
                  <span className="text-destructive font-medium">
                    ⚠️ この操作は取り消せません
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
            >
              削除実行
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}