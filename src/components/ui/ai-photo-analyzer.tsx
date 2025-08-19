import { useState, useRef } from 'react'
import { Button } from './button'

interface PhotoAnalysisResult {
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair' | 'damaged'
  confidence: number
  issues: Array<{
    type: 'scratch' | 'dirt' | 'wear' | 'damage' | 'missing_parts'
    severity: 'minor' | 'moderate' | 'major'
    description: string
    location: string
  }>
  recommendations: string[]
  timestamp: string
}

interface AIPhotoAnalyzerProps {
  isOpen: boolean
  onClose: () => void
  onResult: (result: PhotoAnalysisResult) => void
  productType?: string
  className?: string
}

export function AIPhotoAnalyzer({ isOpen, onClose, onResult, productType = '', className = '' }: AIPhotoAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 1280, 
          height: 720,
          facingMode: 'environment' // 背面カメラを優先
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsCameraActive(true)
      }
    } catch (error) {
      console.error('カメラへのアクセスに失敗しました:', error)
      alert('カメラへのアクセスに失敗しました。ファイル選択をご利用ください。')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setPreviewImage(imageData)
        stopCamera()
      }
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setPreviewImage(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async () => {
    if (!previewImage) return

    setIsAnalyzing(true)
    
    try {
      // 実際の実装では、ここでAI画像解析APIを呼び出します
      // 例: OpenAI Vision API、Google Cloud Vision API、AWS Rekognition など
      
      // デモ用のシミュレーション
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const mockResult: PhotoAnalysisResult = {
        condition: Math.random() > 0.7 ? 'excellent' : 
                  Math.random() > 0.5 ? 'good' : 
                  Math.random() > 0.3 ? 'fair' : 'needs_repair',
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
        issues: [
          {
            type: 'scratch',
            severity: 'minor',
            description: '左側アームレストに軽微な擦り傷',
            location: '左アームレスト'
          },
          {
            type: 'wear',
            severity: 'moderate',
            description: 'シートクッションに軽度の使用感',
            location: 'シート部分'
          }
        ],
        recommendations: [
          '左アームレストの研磨をお勧めします',
          'シートクッションのクリーニングが効果的です',
          '次回点検時にタイヤの空気圧を確認してください'
        ],
        timestamp: new Date().toISOString()
      }
      
      // 商品タイプに応じた分析結果の調整
      if (productType.includes('車椅子')) {
        mockResult.issues.push({
          type: 'wear',
          severity: 'minor',
          description: 'タイヤの溝が若干浅くなっています',
          location: '後輪タイヤ'
        })
      }
      
      onResult(mockResult)
      
    } catch (error) {
      console.error('画像解析に失敗しました:', error)
      alert('画像解析に失敗しました。もう一度お試しください。')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const reset = () => {
    setPreviewImage(null)
    stopCamera()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">AI商品状態分析</h2>
            <Button variant="outline" size="sm" onClick={handleClose}>✕</Button>
          </div>
        
        <div className="space-y-4">
          {!previewImage && !isCameraActive && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={startCamera} className="flex-1">
                  <span className="mr-2">📷</span>
                  カメラで撮影
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="mr-2">📁</span>
                  ファイルを選択
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="text-center text-sm text-muted-foreground">
                商品の写真を撮影するか、ファイルを選択してください
              </div>
            </div>
          )}
          
          {isCameraActive && (
            <div className="space-y-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <span className="mr-2">📸</span>
                  撮影
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}
          
          {previewImage && (
            <div className="space-y-4">
              <img 
                src={previewImage} 
                alt="分析対象の商品"
                className="w-full rounded-lg max-h-96 object-contain"
              />
              
              <div className="flex gap-2">
                <Button 
                  onClick={analyzeImage} 
                  disabled={isAnalyzing}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="mr-2">🤖</span>
                      AI分析中...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🔍</span>
                      AI分析開始
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={reset}>
                  やり直し
                </Button>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        </div>
      </div>
    </div>
  )
}