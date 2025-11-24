import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { supabaseDb } from '../lib/supabase-database'
import type { DemoEquipment } from '../types'
import { demoCategories, getDemoCategoryById, getDemoCategoryName, getDemoCategoryIcon } from '../data/demo-categories'
import { useAuth } from '../hooks/useAuth'
import { useProtectedAction, ProcessType } from '../hooks/useProtectedAction'

export function Demo() {
  const [demoEquipment, setDemoEquipment] = useState<DemoEquipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'available' | 'demo'>('available')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const { user } = useAuth()
  
  // 新規デモ機登録用の状態
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    managementNumber: '',
    category_id: ''
  })
  const [addError, setAddError] = useState('')

  // 保護されたアクション用のフック
  const demoManagementProtection = useProtectedAction(
    async (callback: () => Promise<void>) => {
      await callback()
    },
    {
      processType: ProcessType.DEMO_MANAGEMENT,
      debounceMs: 1000,
      preventConcurrent: true
    }
  )

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

  // デモ開始処理（ワンクリック）
  const handleStartDemo = async (equipment: DemoEquipment) => {
    // usersテーブルから操作者名を自動取得
    const operator = await supabaseDb.getCurrentUserName()

    const updatedEquipment: DemoEquipment = {
      ...equipment,
      status: 'demo',
      operator: operator,
      operatedAt: new Date().toISOString(),
      loanDate: new Date().toISOString().split('T')[0]
    }

    await saveData(updatedEquipment)
    alert(`${equipment.name} のデモを開始しました（操作者: ${operator}）`)
  }

  // 日付と操作者でグループ化
  const groupEquipmentByDateAndOperator = (equipment: DemoEquipment[]) => {
    const grouped = equipment.reduce((groups, item) => {
      if (item.status === 'demo' && item.operator && item.operatedAt) {
        const date = new Date(item.operatedAt).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const key = `${date} - ${item.operator}`
        
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(item)
      }
      return groups
    }, {} as Record<string, DemoEquipment[]>)
    
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  }

  // 顧客名入力処理
  const handleEditCustomer = async (equipment: DemoEquipment) => {
    const customerName = prompt('顧客名を入力してください:', equipment.customerName || '')
    if (customerName !== null) { // キャンセルでなければ
      const updatedEquipment: DemoEquipment = {
        ...equipment,
        customerName: customerName.trim() || undefined
      }

      await saveData(updatedEquipment)
      alert(`${equipment.name} の顧客名を更新しました`)
    }
  }

  // 返却処理
  const handleReturn = async (equipment: DemoEquipment) => {
    if (window.confirm(`${equipment.name} を返却処理しますか？`)) {
      const updatedEquipment: DemoEquipment = {
        ...equipment,
        status: 'available',
        customerName: undefined,
        loanDate: undefined,
        operator: undefined,
        operatedAt: undefined,
        notes: undefined
      }

      await saveData(updatedEquipment)
      alert(`${equipment.name} の返却処理が完了しました`)
    }
  }

  // 新規デモ機追加
  const handleAddEquipment = () => {
    setAddForm({ name: '', managementNumber: '', category_id: '' })
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
      category_id: addForm.category_id || undefined,
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



  // タブ別・カテゴリー別にデータをフィルタ
  const filteredEquipment = demoEquipment
    .filter(item => {
      const statusMatch = item.status === activeTab
      
      let categoryMatch = false
      if (selectedCategory === '') {
        // 全て表示
        categoryMatch = true
      } else {
        // 特定のカテゴリー
        categoryMatch = item.category_id === selectedCategory
      }

      return statusMatch && categoryMatch
    })
    .sort((a, b) => {
      // 管理番号でソート（A～、①～順）
      const managementA = a.managementNumber || ''
      const managementB = b.managementNumber || ''
      
      // 丸数字を数値に変換する関数
      const convertCircledNumber = (str: string): string => {
        const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', 
                              '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']
        
        for (let i = 0; i < circledNumbers.length; i++) {
          if (str.startsWith(circledNumbers[i])) {
            // 丸数字を数値に変換（01, 02, ... 10, 11... の形式）
            return String(i + 1).padStart(2, '0') + str.substring(1)
          }
        }
        return str
      }
      
      // 両方を変換してから比較
      const normalizedA = convertCircledNumber(managementA)
      const normalizedB = convertCircledNumber(managementB)
      
      return normalizedA.localeCompare(normalizedB, 'ja-JP', { 
        numeric: true, 
        sensitivity: 'base' 
      })
    })

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

          {/* Category Filter */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-muted-foreground mr-2">カテゴリー:</span>
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === ''
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                全て
              </button>
              {demoCategories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center space-x-1 ${
                    selectedCategory === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredEquipment.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {activeTab === 'available' ? '利用可能なデモ機はありません' : '貸出中のデモ機はありません'}
                </p>
              </div>
            ) : activeTab === 'demo' ? (
              // デモ中: 日付と操作者でグループ表示
              groupEquipmentByDateAndOperator(filteredEquipment).map(([groupKey, groupItems]) => (
                <div key={groupKey} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-600 border-b border-slate-200 pb-1">
                    {groupKey}
                  </h3>
                  {groupItems.map((equipment) => (
                    <div key={equipment.id} className="border border-border rounded-lg p-3 ml-4 hover:bg-accent/50 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <span className="text-lg">{getDemoCategoryIcon(equipment.category_id)}</span>
                              {equipment.name}
                              <span className="text-lg font-bold text-blue-600">{equipment.managementNumber}</span>
                            </h4>
                            {equipment.operatedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(equipment.operatedAt).toLocaleTimeString('ja-JP', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} デモ開始
                              </p>
                            )}
                            {equipment.customerName && (
                              <p className="text-xs text-slate-500 mt-1">
                                顧客: {equipment.customerName}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-600 text-xs"
                              onClick={() => handleEditCustomer(equipment)}
                            >
                              {equipment.customerName ? '顧客名変更' : '顧客名入力'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-red-50 border-red-200 hover:bg-red-100 text-red-600 text-xs"
                              onClick={() => handleReturn(equipment)}
                            >
                              返却
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              // 利用可能: 通常表示
              filteredEquipment.map((equipment) => (
                <div key={equipment.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="space-y-3">
                    {/* ヘッダー */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <span className="text-lg">{getDemoCategoryIcon(equipment.category_id)}</span>
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


      {/* 新規デモ機登録ダイアログ */}
      {showAddDialog && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          {/* 背景オーバーレイ */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddDialog(false)}
          />
          
          {/* ダイアログ */}
          <div className="relative bg-white rounded-xl p-6 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* 閉じるボタン */}
            <button
              onClick={() => setShowAddDialog(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
            
            <div className="pr-8">
              <h2 className="text-lg font-bold text-slate-800 mb-2">新規デモ機登録</h2>
              <p className="text-sm text-slate-600 mb-6">
                新しい入浴用具デモ機を登録します。<br />
                デモ機名を入力してください。
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="equipmentName">デモ機名 <span className="text-red-500">*</span></Label>
                <Input
                  id="equipmentName"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 浴槽台、滑り止めマット"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="managementNumber">管理番号 <span className="text-red-500">*</span></Label>
                <Input
                  id="managementNumber"
                  value={addForm.managementNumber}
                  onChange={(e) => setAddForm(prev => ({ ...prev, managementNumber: e.target.value }))}
                  placeholder="例: A、B、C... または ①、②、③..."
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  他のデモ機と重複しない管理番号を入力してください
                </p>
              </div>

              <div>
                <Label htmlFor="category">カテゴリー</Label>
                <select
                  id="category"
                  value={addForm.category_id}
                  onChange={(e) => setAddForm(prev => ({ ...prev, category_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">未選択</option>
                  {demoCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  デモ機のカテゴリーを選択してください（任意）
                </p>
              </div>

              {addError && (
                <p className="text-sm text-red-500">{addError}</p>
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
          </div>
        </div>
      )}
      </div>
    </div>
  )
}