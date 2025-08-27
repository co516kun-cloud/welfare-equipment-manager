import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { useInventoryStore } from '../stores/useInventoryStore'
import { supabaseDb } from '../lib/supabase-database'

type ImportType = 'category' | 'product' | 'item' | 'user'

interface ImportOption {
  id: ImportType
  name: string
  description: string
  icon: string
  templateHeaders: string[]
}

const importOptions: ImportOption[] = [
  {
    id: 'category',
    name: '商品カテゴリ',
    description: 'カテゴリマスタのインポート',
    icon: '📁',
    templateHeaders: ['id', 'name']
  },
  {
    id: 'product',
    name: '商品マスタ',
    description: '商品情報のインポート',
    icon: '📦',
    templateHeaders: ['id', 'name', 'category_id', 'description', 'manufacturer', 'model']
  },
  {
    id: 'item',
    name: '商品個体',
    description: '個別管理番号付き商品のインポート',
    icon: '🏷️',
    templateHeaders: ['id', 'product_id', 'status', 'condition', 'location', 'customer_name', 'loan_start_date', 'condition_notes']
  },
  {
    id: 'user',
    name: 'ユーザー',
    description: 'ユーザー情報のインポート',
    icon: '👥',
    templateHeaders: ['id', 'name', 'email', 'role', 'department', 'territory']
  }
]

export function DataImport() {
  const navigate = useNavigate()
  const { loadData } = useInventoryStore()
  const [selectedType, setSelectedType] = useState<ImportType | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  // テンプレートCSVのダウンロード
  const downloadTemplate = (option: ImportOption) => {
    const bom = '\uFEFF'
    const headers = option.templateHeaders.join(',')
    let sampleData = ''
    
    switch (option.id) {
      case 'category':
        sampleData = '\ncat_001,車椅子\ncat_002,特殊寝台'
        break
      case 'product':
        sampleData = '\nprod_001,電動車椅子,cat_001,高機能電動車椅子,○○メーカー,MODEL-A1'
        break
      case 'item':
        sampleData = '\nWC-001,prod_001,倉庫,良好,A-1,,,\nWC-002,prod_001,貸与中,良好,,田中様,2024-01-15,'
        break
      case 'user':
        sampleData = '\nuser_001,山田太郎,yamada@example.com,staff,営業部,東京エリア'
        break
    }
    
    const csvContent = bom + headers + sampleData
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${option.id}_template.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // ファイル選択処理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile || !selectedType) return
    
    setFile(selectedFile)
    setErrors([])
    
    // CSVプレビュー
    const text = await selectedFile.text()
    // BOMを除去
    const cleanText = text.replace(/^\uFEFF/, '')
    
    // 改行コードを統一（Windows CRLF、Mac CR、Unix LF に対応）
    const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalizedText.split('\n').filter(line => line.trim())
    
    // ヘッダー解析（タブ区切りにも対応）
    const delimiter = lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(delimiter).map(h => {
      // ヘッダー名を正規化
      let header = h.trim().replace(/^["']|["']$/g, '').toLowerCase()
      // categoryid → category_id に変換
      if (header === 'categoryid') header = 'category_id'
      return header
    })
    
    const data = lines.slice(1).map((line, index) => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''))
      const row: any = { _rowIndex: index + 2 }
      headers.forEach((header, i) => {
        row[header] = values[i] || ''
      })
      return row
    })
    
    // デバッグ情報
    
    setPreview(data.slice(0, 50)) // 最初の50件のみプレビュー
    
    // バリデーション
    validateData(selectedType, data)
  }

  // データバリデーション
  const validateData = async (type: ImportType, data: any[]) => {
    const newErrors: string[] = []
    
    if (data.length > 2000) {
      newErrors.push('エラー: 最大2000件までインポート可能です')
    }
    
    // 重複チェック
    const ids = data.map(row => row.id).filter(id => id) // 空のIDを除外
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      newErrors.push(`重複ID: ${[...new Set(duplicateIds)].join(', ')}`)
    }
    
    // デバッグ用ログ
    
    // 型別バリデーション
    switch (type) {
      case 'item':
        // 必須項目チェック
        data.forEach(row => {
          if (!row.id) newErrors.push(`行 ${row._rowIndex}: IDが必須です`)
          if (!row.product_id) newErrors.push(`行 ${row._rowIndex}: 商品IDが必須です`)
        })
        
        // 商品ID存在チェック
        try {
          const products = await supabaseDb.getProducts()
          const existingProductIds = new Set(products.map(p => p.id))
          
          console.log(`商品マスタに登録されている商品ID数: ${existingProductIds.size}`)
          console.log('商品マスタの最初の5件:', Array.from(existingProductIds).slice(0, 5))
          
          const missingProductIds = new Set()
          data.forEach(row => {
            if (row.product_id && !existingProductIds.has(row.product_id)) {
              newErrors.push(`行 ${row._rowIndex}: 商品ID「${row.product_id}」が商品マスタに存在しません`)
              missingProductIds.add(row.product_id)
            }
          })
          
          if (missingProductIds.size > 0) {
            console.log('存在しない商品ID:', Array.from(missingProductIds).slice(0, 10))
          }
        } catch (error) {
          newErrors.push('商品マスタの確認に失敗しました')
          console.error('商品マスタ確認エラー:', error)
        }
        break
      case 'product':
        data.forEach(row => {
          if (!row.id || !row.name || !row.category_id) {
            newErrors.push(`行 ${row._rowIndex}: 必須項目が不足しています`)
          }
        })
        break
      case 'category':
        data.forEach(row => {
          if (!row.id || !row.name) {
            newErrors.push(`行 ${row._rowIndex}: ID と名前は必須です`)
          }
        })
        break
      case 'user':
        data.forEach(row => {
          if (!row.id || !row.name || !row.email || !row.role || !row.department) {
            newErrors.push(`行 ${row._rowIndex}: 必須項目が不足しています`)
          }
        })
        break
    }
    
    setErrors(newErrors)
  }

  // インポート実行
  const executeImport = async () => {
    if (!file || !selectedType || errors.length > 0) return
    
    setImporting(true)
    setProgress(0)
    
    try {
      const text = await file.text()
      // BOMを除去
      const cleanText = text.replace(/^\uFEFF/, '')
      
      // 改行コードを統一
      const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = normalizedText.split('\n').filter(line => line.trim())
      
      // ヘッダー解析（タブ区切りにも対応）
      const delimiter = lines[0].includes('\t') ? '\t' : ','
      const headers = lines[0].split(delimiter).map(h => {
        // ヘッダー名を正規化
        let header = h.trim().replace(/^["']|["']$/g, '').toLowerCase()
        // categoryid → category_id に変換
        if (header === 'categoryid') header = 'category_id'
        return header
      })
      
      const data = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''))
        const row: any = {}
        headers.forEach((header, i) => {
          row[header] = values[i] || ''
        })
        return row
      })
      
      // バッチ処理（50件ずつ）
      const batchSize = 20
      const totalBatches = Math.ceil(data.length / batchSize)
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = data.slice(i * batchSize, (i + 1) * batchSize)
        
        switch (selectedType) {
          case 'category':
            await importCategories(batch)
            break
          case 'product':
            await importProducts(batch)
            break
          case 'item':
            await importItems(batch)
            break
          case 'user':
            await importUsers(batch)
            break
        }
        
        setProgress(Math.round(((i + 1) / totalBatches) * 100))
      }
      
      await loadData() // データリロード
      alert('インポートが完了しました')
      navigate(-1)
      
    } catch (error) {
      console.error('Import error:', error)
      alert(`インポートエラー: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  // カテゴリインポート
  const importCategories = async (data: any[]) => {
    // 空の行やIDがない行を除外
    const validData = data.filter(row => row.id && row.name)
    
    const categories = validData.map(row => ({
      id: row.id,
      name: row.name,
      description: row.name, // descriptionにもnameを使用
      icon: getCategoryIcon(row.name)
    }))
    
    if (categories.length === 0) {
      throw new Error('有効なデータがありません')
    }
    
    await supabaseDb.upsertCategories(categories)
  }

  // カテゴリアイコン自動生成
  const getCategoryIcon = (name: string): string => {
    const iconMap: Record<string, string> = {
      '車椅子': '♿',
      'ベッド': '🛏️',
      '寝台': '🛏️',
      '歩行': '🚶',
      '入浴': '🛁',
      '浴室': '🛁',
      'トイレ': '🚽',
      '排泄': '🚽',
      'リフト': '🏗️',
      '昇降': '🏗️',
      'マットレス': '🛌',
      'クッション': '🪑',
      '座位': '🪑',
      '手すり': '🤝',
      'スロープ': '📐'
    }
    
    for (const [keyword, icon] of Object.entries(iconMap)) {
      if (name.includes(keyword)) return icon
    }
    return '📦'
  }

  // 商品インポート
  const importProducts = async (data: any[]) => {
    // 必須項目がある行のみフィルター
    const validData = data.filter(row => row.id && row.name && row.category_id)
    
    const products = validData.map(row => ({
      id: row.id,
      name: row.name,
      category_id: row.category_id,
      description: row.description || row.name, // descriptionが無い場合はnameを使用
      manufacturer: row.manufacturer || '',
      model: row.model || ''
    }))
    
    if (products.length === 0) {
      throw new Error('有効なデータがありません')
    }
    
    await supabaseDb.upsertProducts(products)
  }

  // 商品個体インポート
  const importItems = async (data: any[]) => {
    // ステータスと状態の日本語→英語変換
    const statusMap: Record<string, string> = {
      '倉庫': 'available',
      '利用可能': 'available',
      '予約済み': 'reserved',
      '準備完了': 'ready_for_delivery',
      '貸与中': 'rented',
      '返却済み': 'returned',
      '消毒済み': 'cleaning',
      'メンテナンス済み': 'maintenance',
      'デモキャンセル': 'demo_cancelled',
      '故障': 'out_of_order',
      '不明': 'unknown'
    }
    
    const conditionMap: Record<string, string> = {
      '良好': 'good',
      '普通': 'fair',
      '要注意': 'caution',
      '要修理': 'needs_repair',
      '不明': 'unknown'
    }
    
    const items = data.map(row => ({
      id: row.id,
      product_id: row.product_id,
      status: row.status ? (statusMap[row.status] || 'unknown') : 'unknown', // 空欄の場合は「不明」
      condition: row.condition ? (conditionMap[row.condition] || 'unknown') : 'unknown', // 空欄の場合は「不明」
      location: row.location || '',
      customer_name: row.customer_name || null,
      loan_start_date: row.loan_start_date || null,
      qr_code: row.id, // QRコードは管理番号と同じ
      condition_notes: row.condition_notes || null
    }))
    
    // インポート直前の最終チェック
    try {
      const products = await supabaseDb.getProducts()
      const existingProductIds = new Set(products.map(p => p.id))
      
      console.log(`=== インポート直前チェック ===`)
      console.log(`商品マスタ件数: ${existingProductIds.size}`)
      console.log('商品マスタサンプル:', Array.from(existingProductIds).slice(0, 5))
      
      const invalidItems = items.filter(item => !existingProductIds.has(item.product_id))
      if (invalidItems.length > 0) {
        console.error('存在しない商品IDを持つアイテム:', invalidItems.slice(0, 10).map(item => ({ id: item.id, product_id: item.product_id })))
        throw new Error(`${invalidItems.length}件のアイテムが存在しない商品IDを参照しています`)
      }
    } catch (error) {
      if (error.message.includes('件のアイテムが存在しない商品ID')) {
        throw error
      }
      console.error('商品ID事前チェックエラー:', error)
    }
    
    try {
      await supabaseDb.upsertProductItems(items)
    } catch (error) {
      console.error('Product items upsert failed:', error)
      console.error('Failed items:', items.map(item => ({ id: item.id, product_id: item.product_id })))
      console.error('Error code:', error.code)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      throw new Error(`商品アイテムの保存に失敗しました: ${error.message || error.toString()} (Code: ${error.code || 'Unknown'})`)
    }
  }

  // ユーザーインポート
  const importUsers = async (data: any[]) => {
    const users = data.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as 'admin' | 'staff' | 'manager',
      department: row.department || '',
      territory: row.territory || null
    }))
    
    await supabaseDb.upsertUsers(users)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">データインポート</h1>
          <p className="text-slate-300">CSVファイルから一括でデータを登録・更新します</p>
        </div>

        {/* インポートタイプ選択 */}
        {!selectedType && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {importOptions.map(option => (
              <div
                key={option.id}
                onClick={() => setSelectedType(option.id)}
                className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/20 hover:border-white/40 cursor-pointer transition-all hover:scale-105"
              >
                <div className="flex items-center mb-4">
                  <span className="text-4xl mr-4">{option.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{option.name}</h3>
                    <p className="text-slate-300">{option.description}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadTemplate(option)
                  }}
                >
                  テンプレートをダウンロード
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* インポート画面 */}
        {selectedType && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border-2 border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {importOptions.find(o => o.id === selectedType)?.name}のインポート
              </h2>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedType(null)
                  setFile(null)
                  setPreview([])
                  setErrors([])
                }}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                戻る
              </Button>
            </div>

            {/* ファイル選択 */}
            <div className="mb-6">
              <label className="block">
                <span className="sr-only">CSVファイルを選択</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-slate-300
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-white/20 file:text-white
                    hover:file:bg-white/30"
                />
              </label>
            </div>

            {/* エラー表示 */}
            {errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-lg">
                <h3 className="font-bold text-red-200 mb-2">エラー</h3>
                <ul className="list-disc list-inside text-red-300">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* プレビュー */}
            {preview.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">プレビュー（最初の50件）</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white">
                    <thead>
                      <tr className="border-b border-white/20">
                        {Object.keys(preview[0])
                          .filter(key => key !== '_rowIndex')
                          .map(key => (
                            <th key={key} className="px-4 py-2 text-left">{key}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-white/10">
                          {Object.entries(row)
                            .filter(([key]) => key !== '_rowIndex')
                            .map(([key, value], j) => (
                              <td key={j} className="px-4 py-2">{value as string}</td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  全{file ? file.name.split('\n').length - 1 : 0}件のデータ
                </p>
              </div>
            )}

            {/* インポートボタン */}
            {file && (
              <div className="flex justify-end">
                <Button
                  onClick={executeImport}
                  disabled={importing || errors.length > 0}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {importing ? `インポート中... ${progress}%` : 'インポート実行'}
                </Button>
              </div>
            )}

            {/* プログレスバー */}
            {importing && (
              <div className="mt-4">
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}