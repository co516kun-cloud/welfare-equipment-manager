import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { importFromExcelFiles, importFromSingleExcelFile, ImportResult, ImportOptions } from '../lib/excel-import'

export function Import() {
  const [files, setFiles] = useState<{
    categories?: File
    products?: File
    productItems?: File
    users?: File
  }>({})
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'multiple' | 'single'>('multiple')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [options, setOptions] = useState<ImportOptions>({
    clearExistingData: false,
    skipDuplicates: true,
    validateOnly: false
  })

  const handleFileChange = (type: 'categories' | 'products' | 'productItems' | 'users', file: File | null) => {
    setFiles(prev => ({
      ...prev,
      [type]: file || undefined
    }))
  }

  const handleSingleFileChange = (file: File | null) => {
    setSingleFile(file)
  }

  const validateFiles = (): string[] => {
    const errors: string[] = []
    
    if (mode === 'multiple') {
      if (!files.categories && !files.products && !files.productItems && !files.users) {
        errors.push('最低1つのファイルを選択してください')
      }
    } else {
      if (!singleFile) {
        errors.push('Excelファイルを選択してください')
      }
    }
    
    return errors
  }

  const handleImport = async (validateOnly: boolean = false) => {
    const validationErrors = validateFiles()
    if (validationErrors.length > 0) {
      setImportResult({
        success: false,
        message: validationErrors.join(', '),
        errors: validationErrors,
        warnings: [],
        imported: { categories: 0, products: 0, productItems: 0, users: 0 }
      })
      setShowResultDialog(true)
      return
    }
    
    setIsImporting(true)
    
    try {
      const importOptions = { ...options, validateOnly }
      let result: ImportResult
      
      if (mode === 'multiple') {
        result = await importFromExcelFiles(files, importOptions)
      } else {
        result = await importFromSingleExcelFile(singleFile!, importOptions)
      }
      
      setImportResult(result)
      setShowResultDialog(true)
      
      // インポート成功時にファイルをクリア
      if (result.success && !validateOnly) {
        setFiles({})
        setSingleFile(null)
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: `予期しないエラーが発生しました: ${error.message}`,
        errors: [error.message],
        warnings: [],
        imported: { categories: 0, products: 0, productItems: 0, users: 0 }
      })
      setShowResultDialog(true)
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    // テンプレートファイルのダウンロード用の説明を表示
    const templateInfo = `
Excelテンプレート構造:

【カテゴリ.xlsx】
列: ID, name
例: wheelchairs, 車椅子

【商品.xlsx】
列: ID, name, categoryId, description, manufacturer, model
例: wc-001, 標準車椅子, wheelchairs, 軽量アルミ製, カワムラサイクル, KV22-40SB

【商品アイテム.xlsx】
列: ID, productId, status, condition, location, qrCode, customerName, loanStartDate
例: WC-001, wc-001, 利用可能, 優良, 倉庫A-1, QR-WC-001, , 

【ユーザー.xlsx】
列: ID, name, email, role, department
例: user-001, 田中太郎, tanaka@example.com, admin, 管理部

ステータス値（日本語入力対応）:
利用可能, 貸与中, 返却済み, 消毒済み, メンテナンス済み, デモキャンセル, 故障中, 不明

状態値（日本語入力対応）:
優良, 良好, 普通, 要修理, 不明
    `.trim()
    
    alert(templateInfo)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">データインポート</h1>
        <Button variant="outline" onClick={downloadTemplate}>
          <span className="mr-2">📄</span>
          テンプレート説明
        </Button>
      </div>
      
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <span className="text-warning">⚠️</span>
          <div>
            <p className="text-sm font-medium text-warning">Excel import機能の設定</p>
            <p className="text-sm text-warning/80">
              xlsx ライブラリをインストールしてください: <code className="bg-warning/20 px-1 rounded">npm install xlsx</code>
            </p>
            <p className="text-sm text-warning/80 mt-1">
              正しいプロジェクトフォルダ（package.jsonがあるフォルダ）で実行してください。
            </p>
          </div>
        </div>
      </div>
      

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">インポート方式</h2>
        <div className="flex space-x-4 mb-6">
          <Button
            variant={mode === 'multiple' ? 'default' : 'outline'}
            onClick={() => setMode('multiple')}
          >
            個別ファイル
          </Button>
          <Button
            variant={mode === 'single' ? 'default' : 'outline'}
            onClick={() => setMode('single')}
          >
            単一ファイル（複数シート）
          </Button>
        </div>

        {mode === 'multiple' ? (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground">ファイル選択</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categories">カテゴリ (.xlsx)</Label>
                <Input
                  id="categories"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange('categories', e.target.files?.[0] || null)}
                />
                {files.categories && (
                  <p className="text-sm text-success mt-1">✓ {files.categories.name}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="products">商品 (.xlsx)</Label>
                <Input
                  id="products"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange('products', e.target.files?.[0] || null)}
                />
                {files.products && (
                  <p className="text-sm text-success mt-1">✓ {files.products.name}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="productItems">商品アイテム (.xlsx)</Label>
                <Input
                  id="productItems"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange('productItems', e.target.files?.[0] || null)}
                />
                {files.productItems && (
                  <p className="text-sm text-success mt-1">✓ {files.productItems.name}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="users">ユーザー (.xlsx)</Label>
                <Input
                  id="users"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange('users', e.target.files?.[0] || null)}
                />
                {files.users && (
                  <p className="text-sm text-success mt-1">✓ {files.users.name}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-foreground">単一ファイル選択</h3>
            <div>
              <Label htmlFor="singleFile">Excelファイル（複数シート）</Label>
              <Input
                id="singleFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleSingleFileChange(e.target.files?.[0] || null)}
              />
              {singleFile && (
                <p className="text-sm text-success mt-1">✓ {singleFile.name}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                シート名に「カテゴリ」「商品」「アイテム」「ユーザー」を含めてください
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <h3 className="text-md font-medium text-foreground">インポートオプション</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.clearExistingData}
                onChange={(e) => setOptions(prev => ({ ...prev, clearExistingData: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">既存データをクリアしてからインポート</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.skipDuplicates}
                onChange={(e) => setOptions(prev => ({ ...prev, skipDuplicates: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">重複データをスキップ</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          <Button
            onClick={() => handleImport(true)}
            disabled={isImporting}
            variant="outline"
          >
            <span className="mr-2">🔍</span>
            検証のみ
          </Button>
          <Button
            onClick={() => handleImport(false)}
            disabled={isImporting}
            className="bg-primary hover:bg-primary/90"
          >
            <span className="mr-2">{isImporting ? '⏳' : '📥'}</span>
            {isImporting ? 'インポート中...' : 'インポート実行'}
          </Button>
        </div>
      </div>

      {/* 使用方法の説明 */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">使用方法</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h3 className="font-medium text-foreground mb-2">日本語入力対応</h3>
            <p>ステータスと状態は日本語で入力できます（ひらがな、カタカナ、漢字の混在も可能）</p>
            <p>例: 「利用可能」「りようかのう」「リヨウカノウ」すべて対応</p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">ファイル形式</h3>
            <p>Excel形式（.xlsx, .xls）のファイルをサポート</p>
            <p>1行目はヘッダー行、2行目以降がデータ行</p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">エラー処理</h3>
            <p>インポート前に検証を行い、エラーがある場合は詳細を表示</p>
            <p>日本語入力の解析信頼度が低い場合は警告を表示</p>
          </div>
        </div>
      </div>

      {/* 結果ダイアログ */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {importResult?.success ? '✅ インポート完了' : '❌ インポートエラー'}
            </DialogTitle>
            <DialogDescription>
              {importResult?.message}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {importResult?.success && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{importResult.imported.categories}</div>
                    <div className="text-sm text-muted-foreground">カテゴリ</div>
                  </div>
                </div>
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{importResult.imported.products}</div>
                    <div className="text-sm text-muted-foreground">商品</div>
                  </div>
                </div>
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{importResult.imported.productItems}</div>
                    <div className="text-sm text-muted-foreground">商品アイテム</div>
                  </div>
                </div>
                <div className="bg-success/10 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{importResult.imported.users}</div>
                    <div className="text-sm text-muted-foreground">ユーザー</div>
                  </div>
                </div>
              </div>
            )}
            
            {importResult?.errors && importResult.errors.length > 0 && (
              <div>
                <h3 className="font-medium text-destructive mb-2">エラー ({importResult.errors.length}件)</h3>
                <div className="bg-destructive/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <ul className="space-y-1 text-sm">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-destructive">• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {importResult?.warnings && importResult.warnings.length > 0 && (
              <div>
                <h3 className="font-medium text-warning mb-2">警告 ({importResult.warnings.length}件)</h3>
                <div className="bg-warning/10 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <ul className="space-y-1 text-sm">
                    {importResult.warnings.map((warning, index) => (
                      <li key={index} className="text-warning">• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <Button onClick={() => setShowResultDialog(false)}>
                閉じる
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}