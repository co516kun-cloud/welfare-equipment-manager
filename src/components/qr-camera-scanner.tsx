import { useEffect, useRef, useState, useCallback } from 'react'
import QrScanner from 'qr-scanner'
import { diagnoseCamera, readCameraEnv, type CameraDiagnosis } from '../lib/camera-diagnosis'
import { Button } from './ui/button'

interface QRCameraScannerProps {
  onScanResult: (qrCode: string) => void
  onError?: (error: string) => void
  isActive?: boolean
  className?: string
  continuousMode?: boolean
}

export function QRCameraScanner({ 
  onScanResult, 
  onError, 
  isActive = true,
  className = "",
  continuousMode = true
}: QRCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const onScanResultRef = useRef(onScanResult)
  const onErrorRef = useRef(onError)
  const [hasCamera, setHasCamera] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  // 何が原因で使えないのかを画面に出すための診断結果（2026-09-09）
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  // 「再試行」で初期化をやり直すための番号。増やすと下の useEffect が走り直す
  const [retryToken, setRetryToken] = useState(0)

  // エラー回復機能
  const resetCamera = useCallback(async () => {
    setCameraError(null)
    setIsScanning(false)
    
    // 既存のスキャナーをクリーンアップ
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    
    // 少し待ってから再初期化
    //
    // ⚠️ ここは setFacingMode(prev => prev) だった。同じ値を入れても React は
    //    状態を更新せず再描画もしないので、依存配列が変わらず useEffect が走らない。
    //    その結果「再試行」を押すとスキャナだけ壊れて、エラー表示だけ消えた
    //    無反応状態になっていた（2026-09-08 修正）。
    setTimeout(() => {
      if (videoRef.current && hasCamera && isActive) {
        setRetryToken(n => n + 1)
      }
    }, 500)
  }, [hasCamera, isActive])

  // コールバック参照を最新に保つ
  useEffect(() => {
    onScanResultRef.current = onScanResult
    onErrorRef.current = onError
  }, [onScanResult, onError])

  // カメラの利用可能性をチェック
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera()
        setHasCamera(hasCamera)

        if (!hasCamera) {
          // hasCamera は enumerateDevices を見るだけなので、
          // 「機器が無い」のか「許可が無くて見えない」のかを区別できない。
          // 環境から推測して、次にやることまで出す（2026-09-09）
          let count = 0
          try {
            const devices = await navigator.mediaDevices?.enumerateDevices?.()
            count = devices ? devices.filter(d => d.kind === 'videoinput').length : 0
          } catch { /* 数えられなくても診断は続ける */ }

          const d = diagnoseCamera('Camera not found.', readCameraEnv(count))
          console.error('[camera]', d.cause, d.technical)
          setDiagnosis(d)
          setCameraError(d.title)
          onErrorRef.current?.(d.title)
        }
      } catch (error) {
        console.error('Camera check failed:', error)
        const d = diagnoseCamera(error, readCameraEnv())
        setDiagnosis(d)
        setCameraError(d.title)
        onErrorRef.current?.(d.title)
      }
    }

    checkCamera()
  }, [])

  // QRスキャナーの初期化（retryToken を増やすと開き直す）
  useEffect(() => {
    if (!videoRef.current || !hasCamera || !isActive) return

    const initScanner = async () => {
      try {
        setIsScanning(true)
        setCameraError(null)
        setDiagnosis(null)

        const qrScanner = new QrScanner(
          videoRef.current!,
          (result) => {
            console.log('QR Code detected:', result.data)
            
            // 連続モードでない場合はスキャナーを即座に停止
            if (!continuousMode) {
              console.log('🔐 Non-continuous mode: stopping scanner immediately')
              setIsScanning(false)
              if (qrScannerRef.current) {
                qrScannerRef.current.stop()
              }
            }
            
            onScanResultRef.current(result.data)
          },
          {
            onDecodeError: (error) => {
              // QRコードが検出されない場合のエラーは無視（通常の動作）
              console.debug('QR decode error (normal):', error)
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: facingMode,
            maxScansPerSecond: continuousMode ? 5 : 1, // 非連続モードでは1回/秒に制限
          }
        )

        qrScannerRef.current = qrScanner
        await qrScanner.start()
        setIsScanning(true)
        
      } catch (error) {
        console.error('QR Scanner initialization failed:', error)

        // qr-scanner は getUserMedia のエラーを catch(){} で捨て、文字列
        // 'Camera not found.' だけを投げてくる。本当の原因（許可されていない・
        // 他アプリが使用中など）を知るために、自分でもう一度だけ呼んで確かめる。
        // これが無いと、何が起きても同じ1文言になって原因が追えない（2026-09-09）
        let realError: unknown = error
        let videoInputCount = -1
        try {
          const devices = await navigator.mediaDevices?.enumerateDevices?.()
          videoInputCount = devices ? devices.filter(d => d.kind === 'videoinput').length : -1
        } catch { /* 数えられなくても診断は続ける */ }
        try {
          const probe = await navigator.mediaDevices?.getUserMedia?.({ video: true, audio: false })
          // 取れてしまった場合は掴んだままにしない
          probe?.getTracks().forEach(t => t.stop())
        } catch (probeError) {
          realError = probeError
        }

        const d = diagnoseCamera(realError, readCameraEnv(videoInputCount))
        console.error('[camera]', d.cause, d.technical)
        setDiagnosis(d)
        setCameraError(d.title)
        onErrorRef.current?.(d.title)
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
  }, [hasCamera, isActive, facingMode, retryToken])

  // カメラの切り替え
  const switchCamera = async () => {
    if (!qrScannerRef.current) return

    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
      await qrScannerRef.current.setCamera(newFacingMode)
      setFacingMode(newFacingMode)
    } catch (error) {
      console.error('Camera switch failed:', error)
      onErrorRef.current?.('カメラの切り替えに失敗しました')
    }
  }

  // フラッシュライトの切り替え
  const toggleFlashlight = async () => {
    if (!qrScannerRef.current) return

    try {
      await qrScannerRef.current.toggleFlash()
    } catch (error) {
      console.error('Flashlight toggle failed:', error)
      onErrorRef.current?.('フラッシュライトの制御に失敗しました')
    }
  }

  /**
   * 原因と、次にやることを出す（2026-09-09）
   * 以前は「カメラが利用できません／手動入力をお使いください」だけで、
   * 許可されていないのか機器が無いのかが誰にも分からなかった。
   */
  const renderProblem = (fallbackTitle: string) => {
    const d = diagnosis
    return (
      <div className={`bg-slate-800 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-white p-6 max-w-md w-full">
          <div className="text-center mb-3">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-base font-semibold">{d?.title ?? fallbackTitle}</p>
          </div>

          {d && d.actions.length > 0 && (
            <ol className="text-sm text-white/80 space-y-1.5 list-decimal list-inside mb-4">
              {d.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          )}
          {!d && (
            <p className="text-sm text-white/70 text-center mb-4">手入力をお使いください</p>
          )}

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={resetCamera} className="text-white border-white/30">
              再試行
            </Button>
          </div>

          {d && (
            // 問い合わせのときにこれを見せてもらえれば原因が分かる
            <details className="mt-4">
              <summary className="text-xs text-white/50 cursor-pointer">技術情報</summary>
              <p className="text-xs text-white/50 mt-1 break-all">{d.cause} / {d.technical}</p>
            </details>
          )}
        </div>
      </div>
    )
  }

  if (!hasCamera) return renderProblem('カメラが利用できません')
  if (cameraError) return renderProblem('カメラエラー')

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