import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ScanActionDialog } from '../components/scan-action-dialog'
import { MobileScanUI } from '../components/mobile-scan-ui'
import { QRCameraScanner } from '../components/qr-camera-scanner'
import { useInventoryStore } from '../stores/useInventoryStore'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect, useCallback, memo, useRef } from 'react'
import { supabaseDb } from '../lib/supabase-database'
import type { ProductItem, Product, Order, OrderItem } from '../types'

interface ScanResult {
  id: string
  qrCode: string
  itemName: string
  timestamp: string
  action: string
  status: 'success' | 'error' | 'warning'
}

interface SelectedItem extends ProductItem {
  product?: Product
}

// 非制御コンポーネントとして実装したQR入力フィールド
const QRInputField = memo(({ onSubmit }: {
  onSubmit: (value: string) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value?.trim()
      if (value) {
        onSubmit(value)
        if (inputRef.current) {
          inputRef.current.value = '' // 送信後にクリア
        }
      }
    }
  }, [onSubmit])
  
  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="QRコードを入力 (例: QR-WC-001)"
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      onKeyPress={handleKeyPress}
    />
  )
})

function ScanComponent() {
  const { loadData, orders, users, items, products } = useInventoryStore()
  
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  
  const [scanHistory, setScanHistory] = useState<Array<{
    qrCode: string
    timestamp: string
    action: string
  }>>([])

  useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth < 768
      if (newIsMobile !== isMobile) {
        setIsMobile(newIsMobile)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [isMobile])


  // 認証ユーザーから現在のユーザー名を取得
  const getCurrentUserName = () => {
    if (!user) return '管理者'
    
    // Supabaseのusersテーブルから名前を取得
    const dbUser = users.find(u => u.email === user.email)
    if (dbUser) return dbUser.name
    
    // なければuser_metadataから取得
    return user.user_metadata?.name || user.email?.split('@')[0] || user.email || '管理者'
  }
  const [isScanning, setIsScanning] = useState(true)
  const [continuousMode, setContinuousMode] = useState(true)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionType, setActionType] = useState<string>('')
  const [availableOrders, setAvailableOrders] = useState<{order: Order, item: OrderItem, product: Product}[]>([])
  const [useCameraScanner, setUseCameraScanner] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [qrInput, setQrInput] = useState('') // デスクトップ版用に残す
  
  
  // カメラ関連の関数（モバイル用）
  const toggleTorch = () => {
    // トーチのトグル機能（実装は後で追加可能）
    console.log('Toggle torch')
  }
  
  const switchCamera = () => {
    // カメラの切り替え機能（実装は後で追加可能）
    console.log('Switch camera')
  }



  // 初回データロードはApp.tsxで処理されるため、ここでは不要
  // useEffect(() => {
  //   loadData()
  // }, [])

  const handleScanResult = useCallback(async (qrCode: string) => {
    console.log('🔍 Scanning QR Code:', qrCode)
    console.log('📊 Store data available:', {
      itemsCount: items.length,
      productsCount: products.length,
      ordersCount: orders.length
    })
    
    // スクロール位置を保存
    const scrollPosition = window.scrollY
    
    // ストアのitemsデータからアイテムを検索（高速・確実）
    const item = items.find(item => item.qr_code === qrCode)
    console.log('🔍 Found item:', item)
    
    if (item) {
      // ストアのproductsデータから商品情報を取得
      const product = products.find(p => p.id === item.product_id)
      console.log('📦 Found product:', product)
      console.log('🏷️ Item status:', item.status)
      
      const result: ScanResult = {
        id: `scan-${Date.now()}`,
        qrCode,
        itemName: product ? `${product.name} #${item.id}` : `アイテム #${item.id}`,
        timestamp: new Date().toLocaleString('ja-JP'),
        action: 'スキャン完了',
        status: 'success'
      }
      
      setScanResults(prev => [result, ...prev.slice(0, 9)]) // 最新10件を保持
      
      // selectedItemにproductも含めて設定
      const selectedItemWithProduct = { ...item, product }
      setSelectedItem(selectedItemWithProduct)
      console.log('✅ Selected item set:', selectedItemWithProduct)
      
      // 利用可能なアクションをログ出力
      const availableActions = getAvailableActions(item.status)
      console.log('🎬 Available actions for status', item.status, ':', availableActions)
      
      // スキャン履歴を更新
      setScanHistory(prev => [{
        qrCode,
        timestamp: new Date().toLocaleString('ja-JP'),
        action: 'スキャン完了'
      }, ...prev.slice(0, 9)])
    } else {
      console.log('❌ Item not found for QR code:', qrCode)
      const result: ScanResult = {
        id: `scan-${Date.now()}`,
        qrCode,
        itemName: '不明なアイテム',
        timestamp: new Date().toLocaleString('ja-JP'),
        action: 'アイテムが見つかりません',
        status: 'error'
      }
      
      setScanResults(prev => [result, ...prev.slice(0, 9)])
      setSelectedItem(null)
      
      // スキャン履歴を更新
      setScanHistory(prev => [{
        qrCode,
        timestamp: new Date().toLocaleString('ja-JP'),
        action: 'エラー'
      }, ...prev.slice(0, 9)])
    }
    
    // スクロール位置を復元（次のフレームで実行）
    setTimeout(() => {
      window.scrollTo(0, scrollPosition)
    }, 0)
  }, [items, products, orders])
  
  // handleScanResultへの最新参照を保持
  const handleScanResultRef = useRef(handleScanResult)
  handleScanResultRef.current = handleScanResult
  
  // QR入力送信のコールバック（完全に安定化）
  const handleQRInputSubmit = useCallback((value: string) => {
    handleScanResultRef.current(value)
    // setQrInputは不要（QRInputField内で自動クリア）
  }, []) // 依存配列を空にして完全に安定化


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'rented': return 'bg-info text-info-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'demo_cancelled': return 'bg-info text-info-foreground'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '消毒済み'
      case 'maintenance': return 'メンテナンス済み'
      case 'demo_cancelled': return 'デモキャンセル'
      case 'out_of_order': return '故障中'
      default: return status
    }
  }

  const getAvailableActions = (status: string) => {
    console.log('🎬 Getting available actions for status:', status)
    const actions = []
    
    switch (status) {
      case 'rented':
        actions.push(
          { key: 'return', label: '返却', nextStatus: 'returned' },
          { key: 'demo_cancel', label: 'デモキャンセル', nextStatus: 'demo_cancelled' },
          { key: 'demo_cancel_storage', label: 'デモキャン入庫', nextStatus: 'available' }
        )
        break
      case 'returned':
        actions.push(
          { key: 'clean', label: '消毒完了', nextStatus: 'cleaning' }
        )
        break
      case 'cleaning':
        actions.push(
          { key: 'maintenance', label: 'メンテナンス完了', nextStatus: 'maintenance' }
        )
        break
      case 'maintenance':
        actions.push(
          { key: 'storage', label: '入庫処理', nextStatus: 'available' }
        )
        break
      case 'demo_cancelled':
        actions.push(
          { key: 'storage', label: '入庫処理', nextStatus: 'available' }
        )
        break
      case 'available':
        // 利用可能な商品について、承認済みの発注があるかチェック
        console.log('📋 Available orders count:', availableOrders.length)
        if (availableOrders.length > 0) {
          actions.push(
            { key: 'assign_to_order', label: '発注に割り当て', nextStatus: 'rented' }
          )
        } else {
          // availableの場合でも基本アクションを追加
          actions.push(
            { key: 'rent_directly', label: '直接貸与', nextStatus: 'rented' }
          )
        }
        break
      case 'out_of_order':
        actions.push(
          { key: 'repair', label: '修理完了', nextStatus: 'available' }
        )
        break
      default:
        console.log('⚠️ Unknown status:', status)
        // 不明なステータスでも基本操作を提供
        actions.push(
          { key: 'update_status', label: 'ステータス更新', nextStatus: 'available' }
        )
        break
    }
    
    console.log('✅ Available actions:', actions)
    return actions
  }

  const handleActionSelect = useCallback(async (action: any) => {
    console.log('🎯 Action selected:', action)
    console.log('📱 Selected item:', selectedItem)
    
    setActionType(action.key)
    
    // 発注に割り当てる場合は、利用可能な発注を取得
    if (action.key === 'assign_to_order' && selectedItem) {
      console.log('📋 Fetching matching orders for assign_to_order...')
      const approvedOrders = orders.filter(order => order.status === 'approved')
      console.log('✅ Approved orders found:', approvedOrders.length)
      
      const matchingOrders: {order: Order, item: OrderItem, product: Product}[] = []
      
      for (const order of approvedOrders) {
        for (const item of order.items) {
          // ストアのproductsデータから取得（高速化）
          const product = products.find(p => p.id === item.product_id)
          if (product?.id === selectedItem.product_id && item.item_processing_status === 'waiting') {
            matchingOrders.push({ order, item, product })
          }
        }
      }
      
      console.log('🎯 Matching orders found:', matchingOrders.length)
      setAvailableOrders(matchingOrders)
    }
    
    console.log('🚀 Opening action dialog...')
    setShowActionDialog(true)
  }, [selectedItem, orders, products])

  // アクション処理完了時のコールバック
  const handleActionSuccess = async () => {
    // データを再取得
    loadData()
    
    // 結果をスキャン履歴に追加
    if (selectedItem) {
      const result: ScanResult = {
        id: `action-${Date.now()}`,
        qrCode: selectedItem.qr_code,
        itemName: selectedItem.product ? `${selectedItem.product.name} #${selectedItem.id}` : `アイテム #${selectedItem.id}`,
        timestamp: new Date().toLocaleString('ja-JP'),
        action: '処理完了',
        status: 'success'
      }
      setScanResults(prev => [result, ...prev.slice(0, 9)])
    }
    
    // 状態をリセット
    setActionType('')
    setAvailableOrders([])
    
    // 連続モードの場合は、3秒後にアイテム選択をクリア
    if (continuousMode) {
      setTimeout(() => {
        setSelectedItem(null)
        if (!isScanning) {
          setIsScanning(true)
        }
      }, 3000)
    }
  }

  // モバイルスキャンの結果処理（メモ化）
  const handleMobileScanResult = useCallback((qrCode: string) => {
    handleScanResult(qrCode)
  }, [handleScanResult])

  // デスクトップカメラスキャンの結果処理
  const handleDesktopCameraScanResult = useCallback((qrCode: string) => {
    handleScanResult(qrCode)
  }, [handleScanResult])

  // デスクトップカメラエラーハンドリング
  const handleDesktopCameraError = (error: string) => {
    console.error('Desktop camera error:', error)
    setCameraError(error)
    setUseCameraScanner(false)
  }

  // デスクトップカメラモード切り替え
  const toggleDesktopCameraMode = () => {
    setUseCameraScanner(!useCameraScanner)
    setCameraError(null)
  }
  
  // デスクトップ版UIコンポーネント
  const DesktopScanUI = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">QRコードスキャン</h1>
        <div className="flex items-center space-x-2">
          <Button 
            variant={continuousMode ? "default" : "outline"}
            onClick={() => setContinuousMode(!continuousMode)}
          >
            <span className="mr-2">🔄</span>
            {continuousMode ? '連続モード' : '単発モード'}
          </Button>
          <Button 
            variant={useCameraScanner ? "default" : "outline"}
            onClick={toggleDesktopCameraMode}
          >
            <span className="mr-2">{useCameraScanner ? '📹' : '📱'}</span>
            {useCameraScanner ? 'カメラスキャン' : '手動入力'}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsScanning(!isScanning)}
          >
            <span className="mr-2">📸</span>
            {isScanning ? 'スキャン停止' : 'スキャン開始'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">QRコードをスキャン</h2>
          <div className="aspect-square bg-secondary/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            {useCameraScanner && isScanning && !cameraError ? (
              <QRCameraScanner
                onScanResult={handleDesktopCameraScanResult}
                onError={handleDesktopCameraError}
                isActive={isScanning}
                continuousMode={continuousMode}
                className="w-full h-full rounded-lg"
              />
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {cameraError ? '⚠️' : useCameraScanner ? '📹' : '📱'}
                </div>
                <p className="text-muted-foreground mb-4">
                  {cameraError 
                    ? `カメラエラー: ${cameraError}` 
                    : useCameraScanner 
                      ? 'カメラスキャンが停止中です' 
                      : 'QRコードを手動で入力してください'
                  }
                </p>
                {!useCameraScanner && (
                  <div className="space-y-3">
                    <QRInputField
                      onSubmit={handleQRInputSubmit}
                    />
                    <div className="flex flex-wrap gap-2">
                      {['WC-001', 'BED-001', 'WK-001', 'CANE-001'].map((sample) => (
                        <Button
                          key={sample}
                          variant="outline"
                          size="sm"
                          onClick={() => handleScanResult(sample)}
                          className="text-xs"
                        >
                          {sample}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Item Details */}
        {selectedItem ? (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">アイテム詳細</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground">{selectedItem.product?.name}</h3>
                <p className="text-sm text-muted-foreground">管理番号: {selectedItem.id}</p>
                <p className="text-sm text-muted-foreground">QRコード: {selectedItem.qr_code}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">ステータス:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedItem.status)}`}>
                  {getStatusText(selectedItem.status)}
                </span>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">場所: {selectedItem.location}</p>
                {selectedItem.loan_start_date && (
                  <p className="text-sm text-muted-foreground">貸与開始日: {selectedItem.loan_start_date}</p>
                )}
              </div>
              
              <div className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {getAvailableActions(selectedItem.status).map((action) => (
                    <Button
                      key={action.key}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => handleActionSelect(action)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  {getAvailableActions(selectedItem.status).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      このステータスでは処理できる操作がありません
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">スキャン履歴</h2>
            <div className="space-y-3">
              {scanResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  まだスキャンされていません
                </p>
              ) : (
                scanResults.map((result) => (
                  <div 
                    key={result.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border ${
                      result.status === 'success' ? 'bg-success/10 border-success/20' :
                      result.status === 'error' ? 'bg-destructive/10 border-destructive/20' :
                      'bg-warning/10 border-warning/20'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      result.status === 'success' ? 'bg-success/20' :
                      result.status === 'error' ? 'bg-destructive/20' :
                      'bg-warning/20'
                    }`}>
                      <span className={`text-sm ${
                        result.status === 'success' ? 'text-success' :
                        result.status === 'error' ? 'text-destructive' :
                        'text-warning'
                      }`}>
                        {result.status === 'success' ? '✓' : result.status === 'error' ? '✗' : '⚠'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{result.itemName}</p>
                      <p className="text-xs text-muted-foreground">{result.timestamp} • {result.action}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <ScanActionDialog
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        selectedItem={selectedItem}
        actionType={actionType}
        availableOrders={availableOrders}
        onSuccess={handleActionSuccess}
        getCurrentUserName={getCurrentUserName}
        orders={orders}
      />
    </div>
  )
  
  return (
    <>
      {/* UI分岐 */}
      {isMobile ? (
        <MobileScanUI 
          scanHistory={scanHistory}
          onScanResult={handleMobileScanResult}
          onToggleTorch={toggleTorch}
          onSwitchCamera={switchCamera}
          continuousMode={continuousMode}
        />
      ) : (
        <DesktopScanUI />
      )}
    </>
  )
}

export const Scan = memo(ScanComponent)