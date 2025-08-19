import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { importAllCSVData } from '../lib/csv-to-database'

export function ManualImport() {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  
  // 各CSVデータの状態
  const [categoriesCSV, setCategoriesCSV] = useState('')
  const [productsCSV, setProductsCSV] = useState('')
  const [productItemsCSV, setProductItemsCSV] = useState('')
  const [usersCSV, setUsersCSV] = useState('')

  const handleImport = async () => {
    // 必須データのチェック
    if (!categoriesCSV.trim() || !productsCSV.trim() || !productItemsCSV.trim() || !usersCSV.trim()) {
      setImportResult({
        success: false,
        message: 'すべてのCSVデータを入力してください',
        errors: ['必須データが不足しています'],
        warnings: [],
        imported: { categories: 0, products: 0, productItems: 0, users: 0 }
      })
      setShowResultDialog(true)
      return
    }

    setIsImporting(true)
    
    try {
      const csvData = {
        categories: categoriesCSV.trim(),
        products: productsCSV.trim(),
        productItems: productItemsCSV.trim(),
        users: usersCSV.trim()
      }
      
      const result = await importAllCSVData(csvData)
      setImportResult(result)
      setShowResultDialog(true)
      
      // インポート成功時にフォームをクリア
      if (result.success) {
        setCategoriesCSV('')
        setProductsCSV('')
        setProductItemsCSV('')
        setUsersCSV('')
      }
      
    } catch (error) {
      setImportResult({
        success: false,
        message: `インポート中にエラーが発生しました: ${error.message}`,
        errors: [error.message],
        warnings: [],
        imported: { categories: 0, products: 0, productItems: 0, users: 0 }
      })
      setShowResultDialog(true)
    } finally {
      setIsImporting(false)
    }
  }

  const loadSampleData = () => {
    setCategoriesCSV(`ID,name
beds,特殊寝台
bedsaccessory,特殊寝台付属品
mattress,マットレス
wheelchair,車いす
walker,歩行器
cane,杖
handrail,手すり
handrailaccessory,手すり付属品
slope,スロープ`)

    setProductsCSV(`ID,name,categoryID,manufacturer
30170,楽匠プラス 2M,beds,パラマウントベッド
10660,BACKS　自走,wheelchair,カワムラサイクル
90078,リトルターン（H）,walker,アロン化成
100002,アルミ製4点杖　シルバー,cane,不明
70008,べスポジ　旧型,handrail,ホクメイ`)

    setProductItemsCSV(`ID,productId,status,condition,location,customerName,loanStartDate
BED-001,30170,利用可能,良好,倉庫A-1,,
WC-001,10660,貸与中,優良,顧客先,田中太郎,2024-01-15
WK-001,90078,不明,不明,不明,,
CANE-001,100002,倉庫,良好,倉庫B-1,,
RAIL-001,70008,利用可能,優良,倉庫C-1,,`)

    setUsersCSV(`ID,name,email,role,department
user-001,田口　慧,co516kun@gmail.com,admin,管理部`)
  }

  const clearAll = () => {
    setCategoriesCSV('')
    setProductsCSV('')
    setProductItemsCSV('')
    setUsersCSV('')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">手動CSVインポート</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadSampleData}>
            <span className="mr-2">📝</span>
            サンプルデータ読み込み
          </Button>
          <Button variant="outline" onClick={clearAll}>
            <span className="mr-2">🗑️</span>
            すべてクリア
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">CSVデータ入力</h2>
        <p className="text-sm text-muted-foreground mb-6">
          各テキストエリアにCSVファイルの内容をコピー&ペーストしてください
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories */}
          <div className="space-y-2">
            <Label htmlFor="categories" className="text-sm font-medium">
              📂 Categories.csv（カテゴリ）
            </Label>
            <textarea
              id="categories"
              value={categoriesCSV}
              onChange={(e) => setCategoriesCSV(e.target.value)}
              placeholder={`ID,name\nbeds,特殊寝台\nwheelchair,車いす\n...`}
              className="w-full h-32 p-3 border border-border rounded-md resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              形式: ID,name
            </p>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <Label htmlFor="products" className="text-sm font-medium">
              🛒 Products.csv（商品）
            </Label>
            <textarea
              id="products"
              value={productsCSV}
              onChange={(e) => setProductsCSV(e.target.value)}
              placeholder={`ID,name,categoryID,manufacturer\n30170,楽匠プラス 2M,beds,パラマウントベッド\n...`}
              className="w-full h-32 p-3 border border-border rounded-md resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              形式: ID,name,categoryID,manufacturer
            </p>
          </div>

          {/* Product Items */}
          <div className="space-y-2">
            <Label htmlFor="productItems" className="text-sm font-medium">
              📦 ProductItems.csv（商品アイテム）
            </Label>
            <textarea
              id="productItems"
              value={productItemsCSV}
              onChange={(e) => setProductItemsCSV(e.target.value)}
              placeholder={`ID,productId,status,condition,location,customerName,loanStartDate\nWC-001,10660,貸与中,優良,顧客先,田中太郎,2024-01-15\n...`}
              className="w-full h-40 p-3 border border-border rounded-md resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              形式: ID,productId,status,condition,location,customerName,loanStartDate
            </p>
          </div>

          {/* Users */}
          <div className="space-y-2">
            <Label htmlFor="users" className="text-sm font-medium">
              👤 Users.csv（ユーザー）
            </Label>
            <textarea
              id="users"
              value={usersCSV}
              onChange={(e) => setUsersCSV(e.target.value)}
              placeholder={`ID,name,email,role,department\nuser-001,田口　慧,co516kun@gmail.com,admin,管理部\n...`}
              className="w-full h-32 p-3 border border-border rounded-md resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              形式: ID,name,email,role,department
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="bg-primary hover:bg-primary/90 px-8 py-2"
          >
            <span className="mr-2">{isImporting ? '⏳' : '📥'}</span>
            {isImporting ? 'インポート中...' : 'データベースにインポート'}
          </Button>
        </div>
      </div>

      {/* 使用方法の説明 */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">使用方法</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
            <p>ExcelファイルまたはCSVファイルを開いて、内容をコピー</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
            <p>対応するテキストエリアにペースト（ヘッダー行も含めて）</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
            <p>すべてのデータを入力したら「データベースにインポート」をクリック</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
            <p>インポート結果を確認して、アプリの他の画面でデータを確認</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-info/10 rounded-lg">
          <h3 className="font-medium text-info mb-2">💡 Tips</h3>
          <ul className="space-y-1 text-sm text-info">
            <li>• 日本語ステータス（貸与中、利用可能など）は自動で英語に変換されます</li>
            <li>• 管理番号がQRコードとして自動設定されます</li>
            <li>• エラーがある場合は詳細が表示されます</li>
            <li>• 既存データは完全に置き換えられます</li>
          </ul>
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
                    {importResult.errors.map((error: string, index: number) => (
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
                    {importResult.warnings.map((warning: string, index: number) => (
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