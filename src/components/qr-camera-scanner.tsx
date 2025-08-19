import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { Button } from './ui/button'

interface QRCameraScannerProps {
  onScanResult: (qrCode: string) => void
  onError?: (error: string) => void
  isActive?: boolean
  className?: string
}

export function QRCameraScanner({ 
  onScanResult, 
  onError, 
  isActive = true,
  className = "" 
}: QRCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const [hasCamera, setHasCamera] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  // カメラの利用可能性をチェック
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera()
        setHasCamera(hasCamera)
        
        if (!hasCamera) {
          setCameraError('カメラが見つかりません')
          onError?.('カメラが見つかりません')
        }
      } catch (error) {
        console.error('Camera check failed:', error)
        setCameraError('カメラの確認に失敗しました')
        onError?.('カメラの確認に失敗しました')
      }
    }

    checkCamera()
  }, [onError])

  // QRスキャナーの初期化
  useEffect(() => {
    if (!videoRef.current || !hasCamera || !isActive) return

    const initScanner = async () => {
      try {
        setIsScanning(true)
        setCameraError(null)

        const qrScanner = new QrScanner(
          videoRef.current!,
          (result) => {
            console.log('QR Code detected:', result.data)
            onScanResult(result.data)
          },
          {
            onDecodeError: (error) => {
              // QRコードが検出されない場合のエラーは無視（通常の動作）
              console.debug('QR decode error (normal):', error)
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: facingMode,
            maxScansPerSecond: 5,
          }
        )

        qrScannerRef.current = qrScanner
        await qrScanner.start()
        setIsScanning(true)
        
      } catch (error) {
        console.error('QR Scanner initialization failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'カメラの初期化に失敗しました'
        setCameraError(errorMessage)
        onError?.(errorMessage)
        setIsScanning(false)
      }
    }

    initScanner()

    // クリーンアップ
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
        setIsScanning(false)
      }
    }
  }, [hasCamera, isActive, facingMode, onScanResult, onError])

  // カメラの切り替え
  const switchCamera = async () => {
    if (!qrScannerRef.current) return

    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
      await qrScannerRef.current.setCamera(newFacingMode)
      setFacingMode(newFacingMode)
    } catch (error) {
      console.error('Camera switch failed:', error)
      onError?.('カメラの切り替えに失敗しました')
    }
  }

  // フラッシュライトの切り替え
  const toggleFlashlight = async () => {
    if (!qrScannerRef.current) return

    try {
      await qrScannerRef.current.toggleFlash()
    } catch (error) {
      console.error('Flashlight toggle failed:', error)
      onError?.('フラッシュライトの制御に失敗しました')
    }
  }

  if (!hasCamera) {
    return (
      <div className={`bg-slate-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-white p-8">
          <div className="text-4xl mb-4">📱</div>
          <p className="text-lg mb-2">カメラが利用できません</p>
          <p className="text-sm text-white/70">
            手動入力をお使いください
          </p>
        </div>
      </div>
    )
  }

  if (cameraError) {
    return (
      <div className={`bg-slate-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-white p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg mb-2">カメラエラー</p>
          <p className="text-sm text-white/70 mb-4">{cameraError}</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
            className="text-white border-white/30"
          >
            再試行
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-slate-800 rounded-lg overflow-hidden ${className}`}>
      <video 
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* カメラコントロール */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-4">
        <Button 
          onClick={toggleFlashlight}
          size="sm"
          variant="secondary"
          className="bg-white/20 backdrop-blur-xl text-white border-white/30 hover:bg-white/30"
        >
          <span className="text-lg">💡</span>
        </Button>
        <Button 
          onClick={switchCamera}
          size="sm"
          variant="secondary"
          className="bg-white/20 backdrop-blur-xl text-white border-white/30 hover:bg-white/30"
        >
          <span className="text-lg">🔄</span>
        </Button>
      </div>

      {/* スキャン状態インジケーター */}
      {isScanning && (
        <div className="absolute top-4 left-4 flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
            スキャン中...
          </span>
        </div>
      )}

      {/* QRコードターゲット */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
        </div>
      </div>
    </div>
  )
}