import { useState, useRef } from 'react'
import { Input } from './ui/input'
import { QRCameraScanner } from './qr-camera-scanner'

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
}

export function MobileScanUI({ 
  scanHistory, 
  onScanResult, 
  onToggleTorch, 
  onSwitchCamera,
  continuousMode = true
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

        {/* 最近のスキャン履歴 */}
        <div className="bg-white/95 backdrop-blur-xl rounded-xl p-4 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-3">最近のスキャン</h2>
          <div className="space-y-2">
            {scanHistory.slice(0, 3).map((scan, index) => (
              <div key={index} className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{scan.qrCode}</p>
                    <p className="text-xs text-slate-600">{scan.timestamp}</p>
                  </div>
                  <span className="text-sm text-slate-500">{scan.action}</span>
                </div>
              </div>
            ))}
            
            {scanHistory.length === 0 && (
              <div className="text-center py-4 text-slate-500">
                スキャン履歴がありません
              </div>
            )}
            
            {scanHistory.length > 3 && (
              <button className="w-full text-center text-blue-500 text-sm py-2">
                すべて表示 ({scanHistory.length}件)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}