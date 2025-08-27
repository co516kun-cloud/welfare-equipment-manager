import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { supabaseDb } from '../lib/supabase-database'
import type { DemoEquipment } from '../types'

export function Demo() {
  const [demoEquipment, setDemoEquipment] = useState<DemoEquipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showLoanDialog, setShowLoanDialog] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<DemoEquipment | null>(null)
  const [activeTab, setActiveTab] = useState<'available' | 'demo'>('available')
  const [loanForm, setLoanForm] = useState({
    customerName: '',
    loanDate: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [formError, setFormError] = useState('')
  
  // 新規デモ機登録用の状態
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    managementNumber: ''
  })
  const [addError, setAddError] = useState('')

  // デモページ用のデータをオンデマンド読み込み
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const data = await supabaseDb.getDemoEquipment()
      setDemoEquipment(data)
    } catch (error) {
      console.error('Error loading demo equipment:', error)
      setLoadError('デモ機器データの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // データ保存
  const saveData = async (equipment: DemoEquipment) => {
    try {
      await supabaseDb.saveDemoEquipment(equipment)
      await loadData() // データを再読み込み
    } catch (error) {
      console.error('Error saving demo equipment:', error)
      alert('データの保存中にエラーが発生しました')
    }
  }

  // デモ開始処理
  const handleStartDemo = (equipment: DemoEquipment) => {
    setSelectedEquipment(equipment)
    setLoanForm({
      customerName: '',
      loanDate: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setFormError('')
    setShowLoanDialog(true)
  }

  // デモ開始送信
  const handleLoanSubmit = async () => {
    if (!loanForm.customerName.trim()) {
      setFormError('顧客名を入力してください')
      return
    }

    if (!loanForm.loanDate) {
      setFormError('貸出日を選択してください')
      return
    }

    if (!selectedEquipment) return

    const updatedEquipment: DemoEquipment = {
      ...selectedEquipment,
      status: 'demo',
      customerName: loanForm.customerName,
      loanDate: loanForm.loanDate,
      notes: loanForm.notes
    }

    await saveData(updatedEquipment)
    setShowLoanDialog(false)
    setSelectedEquipment(null)
    alert(`${selectedEquipment.name} のデモ貸出を開始しました`)
  }

  // 返却処理
  const handleReturn = async (equipment: DemoEquipment) => {
    if (window.confirm(`${equipment.name} を返却処理しますか？`)) {
      const updatedEquipment: DemoEquipment = {
        ...equipment,
        status: 'available',
        customerName: undefined,
        loanDate: undefined,
        notes: undefined
      }

      await saveData(updatedEquipment)
      alert(`${equipment.name} の返却処理が完了しました`)
    }
  }

  // 新規デモ機追加
  const handleAddEquipment = () => {
    setAddForm({ name: '', managementNumber: '' })
    setAddError('')
    setShowAddDialog(true)
  }

  // 新規デモ機登録送信
  const handleAddSubmit = async () => {
    if (!addForm.name.trim()) {
      setAddError('デモ機名を入力してください')
      return
    }

    if (!addForm.managementNumber.trim()) {
      setAddError('管理番号を入力してください')
      return
    }

    // 管理番号の重複チェック
    const isDuplicate = demoEquipment.some(equipment => 
      equipment.managementNumber === addForm.managementNumber.trim()
    )
    
    if (isDuplicate) {
      setAddError('この管理番号は既に使用されています')
      return
    }

    const newEquipment: DemoEquipment = {
      id: `DEMO-${String(demoEquipment.length + 1).padStart(3, '0')}`,
      name: addForm.name.trim(),
      managementNumber: addForm.managementNumber.trim(),
      status: 'available'
    }

    await saveData(newEquipment)
    setShowAddDialog(false)
    alert(`${newEquipment.name}（${newEquipment.managementNumber}）を登録しました`)
  }

  // デモ機削除
  const handleDeleteEquipment = async (equipment: DemoEquipment) => {
    if (window.confirm(`${equipment.name} を削除しますか？この操作は取り消せません。`)) {
      try {
        await supabaseDb.deleteDemoEquipment(equipment.id)
        await loadData() // データを再読み込み
        alert(`${equipment.name} を削除しました`)
      } catch (error) {
        console.error('Error deleting demo equipment:', error)
        alert('削除中にエラーが発生しました')
      }
    }
  }

  // ステータス別の色とテキスト
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'demo': return 'bg-warning text-warning-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'demo': return 'デモ中'
      default: return status
    }
  }

  // 統計情報
  const stats = {
    available: demoEquipment.filter(item => item.status === 'available').length,
    demo: demoEquipment.filter(item => item.status === 'demo').length,
    total: demoEquipment.length
  }

  // タブ別にデータをフィルタ
  const filteredEquipment = demoEquipment.filter(item => item.status === activeTab)

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white">デモ機器データを読み込んでいます...</p>
        </div>
      </div>
    )
  }

  // エラー時の表示
  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{loadError}</p>
          <Button onClick={() => loadData()}>再読み込み</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 dark:bg-slate-900/80 backdrop-blur-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-purple-600/20"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.1)_60deg,transparent_120deg)] animate-spin" style={{animationDuration: "20s"}}></div>
      
      <div className="relative z-10 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">入浴用具デモ機管理</h1>
        <Button 
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          onClick={handleAddEquipment}
        >
          <span className="mr-2">➕</span>
          新規デモ機登録
        </Button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">利用可能</p>
              <p className="text-lg font-bold text-foreground">{stats.available}</p>
            </div>
            <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
              <span className="text-success text-xs">✅</span>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">デモ中</p>
              <p className="text-lg font-bold text-foreground">{stats.demo}</p>
            </div>
            <div className="h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center">
              <span className="text-warning text-xs">🔄</span>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">総数</p>
              <p className="text-lg font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs">🛁</span>
            </div>
          </div>
        </div>
      </div>

      {/* デモ機一覧 */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-3 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">デモ機一覧</h2>
          
          {/* タブ */}
          <div className="mb-4">
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('available')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'available'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-blue-100'
                }`}
              >
                利用可能 ({stats.available})
              </button>
              <button
                onClick={() => setActiveTab('demo')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'demo'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-red-100'
                }`}
              >
                貸出中 ({stats.demo})
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredEquipment.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {activeTab === 'available' ? '利用可能なデモ機はありません' : '貸出中のデモ機はありません'}
                </p>
              </div>
            ) : (
              filteredEquipment.map((equipment) => (
                <div key={equipment.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="space-y-3">
                    {/* ヘッダー */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="text-lg">🛁</span>
                          {equipment.name}
                          <span className="text-lg font-bold text-blue-600">{equipment.managementNumber}</span>
                        </h3>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(equipment.status)}`}>
                        {getStatusText(equipment.status)}
                      </span>
                    </div>

                    {/* 詳細情報 */}
                    {equipment.status === 'demo' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">顧客: <span className="text-foreground font-medium">{equipment.customerName}様</span></p>
                          <p className="text-muted-foreground">貸出日: <span className="text-foreground">{equipment.loanDate}</span></p>
                          {equipment.notes && (
                            <p className="text-muted-foreground">備考: <span className="text-foreground">{equipment.notes}</span></p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="flex gap-2">
                      {equipment.status === 'available' ? (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-primary hover:bg-primary/90 text-xs"
                            onClick={() => handleStartDemo(equipment)}
                          >
                            <span className="mr-1">📋</span>
                            デモ開始
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="bg-red-50 border-red-200 hover:bg-red-100 text-red-600 text-xs"
                            onClick={() => handleDeleteEquipment(equipment)}
                          >
                            <span className="mr-1">🗑️</span>
                            削除
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          className="bg-success hover:bg-success/90 text-success-foreground text-xs"
                          onClick={() => handleReturn(equipment)}
                        >
                          <span className="mr-1">📦</span>
                          返却処理
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* デモ開始ダイアログ */}
      <Dialog open={showLoanDialog} onOpenChange={setShowLoanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>デモ機貸出</DialogTitle>
            <DialogDescription>
              {selectedEquipment && (
                <>
                  <strong>{selectedEquipment.name}</strong> のデモ貸出を開始します。<br />
                  顧客情報を入力してください。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="customerName">顧客名 <span className="text-destructive">*</span></Label>
              <Input
                id="customerName"
                value={loanForm.customerName}
                onChange={(e) => setLoanForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="例: 田中太郎"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="loanDate">貸出日 <span className="text-destructive">*</span></Label>
              <Input
                id="loanDate"
                type="date"
                value={loanForm.loanDate}
                onChange={(e) => setLoanForm(prev => ({ ...prev, loanDate: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">備考</Label>
              <Input
                id="notes"
                value={loanForm.notes}
                onChange={(e) => setLoanForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="特記事項があれば入力してください"
                className="mt-1"
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowLoanDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleLoanSubmit}>
                貸出開始
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新規デモ機登録ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新規デモ機登録</DialogTitle>
            <DialogDescription>
              新しい入浴用具デモ機を登録します。<br />
              デモ機名を入力してください。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="equipmentName">デモ機名 <span className="text-destructive">*</span></Label>
              <Input
                id="equipmentName"
                value={addForm.name}
                onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例: 浴槽台、滑り止めマット"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="managementNumber">管理番号 <span className="text-destructive">*</span></Label>
              <Input
                id="managementNumber"
                value={addForm.managementNumber}
                onChange={(e) => setAddForm(prev => ({ ...prev, managementNumber: e.target.value }))}
                placeholder="例: ①、②、③... または A、B、C..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                他のデモ機と重複しない管理番号を入力してください
              </p>
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
      </div>
    </div>
  )
}