import { useState, useRef } from 'react'
import { Input } from './ui/input'
import { QRCameraScanner } from './qr-camera-scanner'
import { ScanActionDialog } from './scan-action-dialog'
import type { ItemAction } from '../lib/item-status'
import type { ProductItem, Product, Order, OrderItem } from '../types'

interface SelectedItem extends ProductItem {
  product?: Product
}

interface MobileScanUIProps {
  scanHistory: Array<{
    qrCode: string
    timestamp: string
    action: string
  }>
  onScanResult: (qrCode: string) => void
  onToggleTorch: () => void
  onSwitchCamera: () => void
  continuousMode?: boolean
  selectedItem?: SelectedItem
  onActionSelect?: (action: any) => void
  getAvailableActions?: (status: string) => any[]
  getStatusColor?: (status: string) => string
  getStatusText?: (status: string) => string
  // スキャン結果ダイアログ制御用
  onClearSelectedItem?: () => void
  // アクションダイアログ制御用のprops
  showActionDialog?: boolean
  onActionDialogChange?: (open: boolean) => void
  actionType?: string
  availableOrders?: {order: Order, item: OrderItem, product: Product}[]
  onActionSuccess?: () => void
  getCurrentUserName?: () => string
  orders?: Order[]
  /** 完了ビューの次の工程（2026-11-19）。ScanActionDialog へそのまま渡す */
  onContinue?: (action: ItemAction) => void
  onItemUpdated?: (item: ProductItem) => void
}

export function MobileScanUI({ 
  scanHistory, 
  onScanResult, 
  onToggleTorch, 
  onSwitchCamera,
  continuousMode = true,
  selectedItem,
  onActionSelect,
  getAvailableActions,
  getStatusColor,
  getStatusText,
  onClearSelectedItem,
  showActionDialog = false,
  onActionDialogChange,
  actionType = '',
  availableOrders = [],
  onActionSuccess,
  getCurrentUserName,
  orders = [],
  onContinue,
  onItemUpdated
}: MobileScanUIProps) {
  const [localQrInput, setLocalQrInput] = useState('')
  const [useCameraScanner, setUseCameraScanner] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleScan = () => {
    if (localQrInput.trim()) {
      onScanResult(localQrInput.trim())
      setLocalQrInput('')
      // フォーカスを維持
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  const handleCameraError = (error: string) => {
    console.error('Camera error:', error)
    setCameraError(error)
    setUseCameraScanner(false)
  }

  const handleCameraScanResult = (qrCode: string) => {
    onScanResult(qrCode)
  }

  const toggleScanMode = () => {
    setUseCameraScanner(!useCameraScanner)
    setCameraError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* カメラビュー（画面の60%） */}
      <div className="h-[60vh] bg-slate-800 relative">
        {useCameraScanner && !cameraError ? (
          <QRCameraScanner
            onScanResult={handleCameraScanResult}
            onError={handleCameraError}
            isActive={true}
            continuousMode={continuousMode}
            className="w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white/60 text-sm mb-2">
                  {cameraError ? 'カメラエラー' : '手動入力モード'}
                </span>
                {cameraError && (
                  <span className="text-white/40 text-xs text-center px-4">
                    {cameraError}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* スキャンモード切り替えボタン */}
        <div className="absolute top-4 right-4">
          <button 
            onClick={toggleScanMode}
            className="bg-white/20 backdrop-blur-xl text-white px-3 py-2 rounded-lg text-sm active:scale-95 transition-transform"
          >
            {useCameraScanner ? '📱→✏️' : '✏️→📱'}
          </button>
        </div>
      </div>

      {/* 下部：スキャン履歴と手動入力 */}
      <div className="flex-1 p-4">
        {/* 手動入力セクション */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 mb-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-3">手動入力</h2>
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="QRコードまたは管理番号を入力"
              value={localQrInput}
              onChange={(e) => setLocalQrInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 text-sm"
            />
            <button
              onClick={handleScan}
              disabled={!localQrInput.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              スキャン
            </button>
          </div>
        </div>

        {/* QRスキャン待機メッセージのみ表示（結果はダイアログで表示） */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-3">QRスキャン</h2>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📱</div>
            <p className="text-slate-600">
              QRコードをスキャンまたは<br />
              手動入力してください
            </p>
          </div>
        </div>
      </div>
      
      {/* スキャン結果ダイアログ - カメラビューの上にオーバーレイ（アクションダイアログが開いていない時のみ） */}
      {selectedItem && !showActionDialog && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          {/* 背景オーバーレイ */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => onClearSelectedItem?.()}
          />
          
          {/* スキャン結果ダイアログ */}
          <div className="relative bg-white rounded-xl p-6 shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            {/* 閉じるボタン */}
            <button
              onClick={() => onClearSelectedItem?.()}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
            
            <h2 className="text-lg font-bold text-slate-800 mb-4 pr-8">スキャン結果</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800">{selectedItem.product?.name || 'Unknown Product'}</p>
                <p className="text-sm text-slate-600">管理番号: {selectedItem.id}</p>
                <p className="text-sm text-slate-600">QRコード: {selectedItem.qr_code}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">ステータス:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor ? getStatusColor(selectedItem.status) : 'bg-slate-200 text-slate-800'}`}>
                  {getStatusText ? getStatusText(selectedItem.status) : selectedItem.status}
                </span>
              </div>
              
              {selectedItem.location && (
                <p className="text-sm text-slate-600">場所: {selectedItem.location}</p>
              )}
              
              {/* アクションボタン */}
              {getAvailableActions && onActionSelect && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium text-slate-700 mb-3">実行可能な操作:</p>
                  <div className="flex flex-wrap gap-2">
                    {getAvailableActions(selectedItem.status).map((action) => (
                      <button
                        key={action.key}
                        onClick={() => onActionSelect(action)}
                        className={action.danger
                          ? 'border border-destructive text-destructive bg-white hover:bg-destructive/10 text-sm px-3 py-2 rounded-lg transition-colors'
                          : 'bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-2 rounded-lg transition-colors'}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Action Dialog - カメラビューの上にオーバーレイ */}
      {showActionDialog && onActionDialogChange && onActionSuccess && getCurrentUserName && (
        <div className="fixed inset-0 z-[999998] flex items-center justify-center">
          <ScanActionDialog
            open={showActionDialog}
            onOpenChange={onActionDialogChange}
            selectedItem={selectedItem}
            actionType={actionType}
            availableOrders={availableOrders}
            onSuccess={onActionSuccess}
            getCurrentUserName={getCurrentUserName}
            orders={orders}
            onContinue={onContinue}
            onItemUpdated={onItemUpdated}
          />
        </div>
      )}
    </div>
  )
}