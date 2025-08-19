import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { importAllCSVData } from '../lib/csv-to-database'
import { csvData, sampleProductItems } from '../lib/csv-data'

export function CSVImport() {
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)

  const handleCSVImport = async () => {
    setIsImporting(true)
    
    try {
      // 埋め込みCSVデータを使用
      const result = await importAllCSVData(csvData)
      setImportResult(result)
      setShowResultDialog(true)
      
    } catch (error) {
      setImportResult({
        success: false,
        message: `インポート中にエラーが発生しました: ${error.message}`,
        imported: { categories: 0, products: 0, productItems: 0, users: 0 }
      })
      setShowResultDialog(true)
    } finally {
      setIsImporting(false)
    }
  }

  const handleManualImport = () => {
    // より多くのサンプルデータでインポート
    const extendedCSVData = {
      ...csvData,
      productItems: sampleProductItems
    }
    
    setIsImporting(true)
    
    importAllCSVData(extendedCSVData)
      .then(result => {
        setImportResult(result)
        setShowResultDialog(true)
      })
      .catch(error => {
        setImportResult({
          success: false,
          message: `インポート中にエラーが発生しました: ${error.message}`,
          imported: { categories: 0, products: 0, productItems: 0, users: 0 }
        })
        setShowResultDialog(true)
      })
      .finally(() => {
        setIsImporting(false)
      })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">CSVデータインポート</h1>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">デスクトップDBフォルダからインポート</h2>
        <p className="text-sm text-muted-foreground mb-4">
          C:\Users\taguchi\Desktop\DB フォルダのCSVファイルからデータを読み込みます
        </p>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-accent/10 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">📊 対象ファイル</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Categories.csv (カテゴリ)</li>
                <li>• Products.csv (商品)</li>
                <li>• ProductItems.csv (商品アイテム)</li>
                <li>• Users.csv (ユーザー)</li>
              </ul>
            </div>
            
            <div className="bg-success/10 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">🔄 変換内容</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 日本語ステータス → 英語</li>
                <li>• 管理番号 → QRコード</li>
                <li>• 日付正規化</li>
                <li>• データ構造最適化</li>
              </ul>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <Button
              onClick={handleManualImport}
              disabled={isImporting}
              className="bg-primary hover:bg-primary/90"
            >
              <span className="mr-2">{isImporting ? '⏳' : '📥'}</span>
              {isImporting ? 'インポート中...' : '実データでインポート（拡張版）'}
            </Button>
            
            <Button
              onClick={handleCSVImport}
              disabled={isImporting}
              variant="outline"
            >
              <span className="mr-2">{isImporting ? '⏳' : '📁'}</span>
              {isImporting ? 'インポート中...' : '実データでインポート（基本版）'}
            </Button>
          </div>
        </div>
      </div>

      {/* 手順説明 */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">インポート手順</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
            <p><strong>データ確認:</strong> CSVファイルの内容を解析</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
            <p><strong>データ変換:</strong> 日本語ステータスを英語に変換</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
            <p><strong>データベース更新:</strong> 既存データをクリアして新しいデータを保存</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
            <p><strong>完了:</strong> インポート結果を表示</p>
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