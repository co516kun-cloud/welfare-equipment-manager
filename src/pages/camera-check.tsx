import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { useGoBack } from '../hooks/useGoBack'
import { diagnoseCamera, readCameraEnv, type CameraDiagnosis } from '../lib/camera-diagnosis'
import { calculateScanRegion, SCAN_RATE_PER_SECOND } from '../lib/scan-region'

/**
 * カメラ診断ページ（2026-09-09）
 *
 * 田口さん:
 *   「1人だけスキャンが効かない端末があって。だいぶ古い iPhone SE。
 *     普通のカメラアプリやと読み取れるのに、アプリ内のスキャンだけ効かない」
 *
 * 手元に同じ端末が無いので、その端末で開いてもらって状態を持ち帰るためのページ。
 * 画面をそのまま撮って送ってもらえば原因が分かるようにしてある。
 *
 * 業務画面と違い、ここは失敗しても何も壊れない。だから遠慮なく試せる。
 */

type CheckState = 'pending' | 'ok' | 'ng' | 'skip'

interface Check {
  label: string
  state: CheckState
  detail: string
}

const ICON: Record<CheckState, string> = { pending: '⏳', ok: '✅', ng: '❌', skip: '⬜' }

export function CameraCheck() {
  const goBack = useGoBack('/menu')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [checks, setChecks] = useState<Check[]>([])
  const [diagnosis, setDiagnosis] = useState<CameraDiagnosis | null>(null)
  const [running, setRunning] = useState(false)
  const [ua, setUa] = useState('')

  // 実際に読めるかを見る（田口さん「カメラは動くのに全く無反応」への対応）
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const liveScannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null)
  const [liveState, setLiveState] = useState<'idle' | 'starting' | 'scanning' | 'hit' | 'error'>('idle')
  const [liveInfo, setLiveInfo] = useState('')
  const [hits, setHits] = useState<string[]>([])

  const run = async () => {
    setRunning(true)
    setDiagnosis(null)
    const out: Check[] = []
    const push = (label: string, state: CheckState, detail: string) => {
      out.push({ label, state, detail })
      setChecks([...out])
    }

    setUa(navigator.userAgent)

    // 1. 安全なコンテキストか（HTTPS か localhost）
    const secure = window.isSecureContext === true
    push('安全な接続（HTTPS）', secure ? 'ok' : 'ng',
      secure ? location.protocol : `${location.protocol} ではカメラを使えません`)

    // 2. カメラAPIがあるか
    const hasMD = !!navigator.mediaDevices
    push('カメラAPIが使える', hasMD ? 'ok' : 'ng',
      hasMD ? 'navigator.mediaDevices あり' : 'navigator.mediaDevices が存在しません')

    // 3. どこで開いているか
    const env = readCameraEnv()
    push('開き方', env.isInAppBrowser ? 'ng' : 'ok',
      [env.isIOS ? 'iOS' : 'iOS以外',
       env.isStandalone ? 'ホーム画面から起動' : 'ブラウザで起動',
       env.isInAppBrowser ? 'アプリ内ブラウザ（カメラを使えないことがあります）' : '通常のブラウザ',
      ].join(' / '))

    // 4. カメラが何台見えるか（許可前は0台に見えることがある）
    let count = -1
    if (hasMD) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        count = devices.filter(d => d.kind === 'videoinput').length
        push('見えているカメラ', count > 0 ? 'ok' : 'ng',
          count > 0 ? `${count}台` : '0台（許可されていないと0台に見えます）')
      } catch (e) {
        push('見えているカメラ', 'ng', String(e))
      }
    } else {
      push('見えているカメラ', 'skip', 'カメラAPIが無いので調べられません')
    }

    // 5. 実際にカメラを開いてみる（ここが本番と同じ動き）
    if (!hasMD) {
      push('カメラを開く', 'skip', 'カメラAPIが無いので試せません')
      setDiagnosis(diagnoseCamera(null, readCameraEnv(count)))
      setRunning(false)
      return
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false,
      })
      push('カメラを開く', 'ok', '背面カメラを開けました')
    } catch (e) {
      const name = (e as { name?: string })?.name ?? String(e)
      push('カメラを開く（背面）', 'ng', name)
      // 背面が駄目でも前面なら開くことがある
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        push('カメラを開く（指定なし）', 'ok', '前面などで開けました')
      } catch (e2) {
        push('カメラを開く（指定なし）', 'ng', (e2 as { name?: string })?.name ?? String(e2))
        setDiagnosis(diagnoseCamera(e2, readCameraEnv(count)))
        setRunning(false)
        return
      }
    }

    // 6. 映像が実際に流れるか（iOS は再生できないと何も映らない）
    if (stream && videoRef.current) {
      const v = videoRef.current
      v.srcObject = stream
      try {
        await v.play()
        await new Promise(r => setTimeout(r, 1200))
        const ok = v.videoWidth > 0 && v.videoHeight > 0
        push('映像が流れる', ok ? 'ok' : 'ng',
          ok ? `${v.videoWidth}×${v.videoHeight}` : '大きさが取れません（映像が来ていません）')
      } catch (e) {
        push('映像が流れる', 'ng', `再生できません: ${String(e)}`)
      }
      stream.getTracks().forEach(t => t.stop())
      v.srcObject = null
    }

    // 7. 読み取り部品を作れるか
    try {
      const { default: QrScanner } = await import('qr-scanner')
      await QrScanner.hasCamera()
      push('読み取り部品', 'ok', '読み込めました')
    } catch (e) {
      push('読み取り部品', 'ng', String(e))
    }

    setRunning(false)
  }

  const stopLive = () => {
    liveScannerRef.current?.stop()
    liveScannerRef.current?.destroy()
    liveScannerRef.current = null
    setLiveState('idle')
  }

  const startLive = async () => {
    stopLive()
    setHits([])
    setLiveInfo('')
    setLiveState('starting')
    try {
      const { default: QrScanner } = await import('qr-scanner')
      const video = liveVideoRef.current
      if (!video) throw new Error('映像の置き場がありません')

      const scanner = new QrScanner(
        video,
        (result: { data: string }) => {
          setHits(prev => (prev.includes(result.data) ? prev : [...prev, result.data]))
          setLiveState('hit')
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
          maxScansPerSecond: SCAN_RATE_PER_SECOND,
          calculateScanRegion,
          onDecodeError: () => { /* 読めない間は毎フレーム呼ばれる。正常 */ },
        }
      )
      liveScannerRef.current = scanner as unknown as { stop: () => void; destroy: () => void }
      await scanner.start()
      setLiveState('scanning')

      // 映像の大きさと読み取り範囲を出す（0×0 なら読めなくて当然）
      setTimeout(() => {
        const v = liveVideoRef.current
        if (!v) return
        const r = calculateScanRegion(v)
        setLiveInfo(
          `映像 ${v.videoWidth}×${v.videoHeight} / 読み取り範囲 ${r.width}×${r.height}` +
          ` → ${r.downScaledWidth}px / ${SCAN_RATE_PER_SECOND}回per秒`
        )
      }, 1500)
    } catch (e) {
      setLiveState('error')
      setLiveInfo(String(e))
    }
  }

  useEffect(() => {
    // 開いたときに一度だけ調べる。片付けは離れるとき
    run()
    return () => stopLive()
  }, [])

  const allOk = checks.length > 0 && checks.every(c => c.state !== 'ng')

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">カメラ診断</h1>
        <Button variant="outline" size="sm" onClick={goBack}>戻る</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        カメラでの読み取りがうまくいかない端末で、このページを開いてください。
        結果をそのまま画面撮影して送っていただければ原因が分かります。
        ここで何を押しても、在庫や発注のデータは変わりません。
      </p>

      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {checks.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">調べています…</p>
        )}
        {checks.map((c, i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">{ICON[c.state]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground break-words">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {allOk && !running && (
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <p className="text-sm font-medium text-success-foreground">
            この端末ではカメラを使えます
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            それでも読み取れない場合は、QRコードの汚れ・印刷のかすれ・
            暗さ・ピントが合わないほどの近さを疑ってください。
          </p>
        </div>
      )}

      {diagnosis && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
          <p className="text-sm font-semibold text-destructive">{diagnosis.title}</p>
          <ol className="text-sm space-y-1 list-decimal list-inside text-foreground">
            {diagnosis.actions.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
          <p className="text-xs text-muted-foreground break-all pt-1">
            {diagnosis.cause} / {diagnosis.technical}
          </p>
        </div>
      )}

      {/* ここからが本題: 実際に QRコードを読めるか */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">読み取りテスト</h2>
          <p className="text-xs text-muted-foreground mt-1">
            「カメラは映るのに、かざしても何も起きない」場合はここで確かめます。
            開始したら、商品のQRコードを画面に映してください。
          </p>
        </div>

        <video
          ref={liveVideoRef}
          className={`w-full rounded-lg bg-black ${liveState === 'idle' ? 'hidden' : ''}`}
          playsInline
          muted
        />

        {liveInfo && <p className="text-xs text-muted-foreground break-words">{liveInfo}</p>}

        {liveState === 'scanning' && (
          <p className="text-sm text-muted-foreground">
            読み取り中… QRコードを映してください（まだ1件も読めていません）
          </p>
        )}
        {hits.length > 0 && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-sm font-semibold">読み取れました（{hits.length}件）</p>
            <ul className="text-sm mt-1 space-y-0.5">
              {hits.map(h => <li key={h} className="break-all">・{h}</li>)}
            </ul>
          </div>
        )}
        {liveState === 'error' && (
          <p className="text-sm text-destructive break-words">開始できません: {liveInfo}</p>
        )}

        <div className="flex gap-2">
          <Button onClick={startLive} disabled={liveState === 'starting'}>
            {liveState === 'idle' || liveState === 'error' ? '読み取りテストを開始' : 'やり直す'}
          </Button>
          {liveState !== 'idle' && (
            <Button variant="outline" onClick={stopLive}>止める</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={run} disabled={running}>
          {running ? '確認中…' : 'もう一度確認する'}
        </Button>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">端末の情報</summary>
        <p className="mt-1 break-all">{ua}</p>
      </details>
    </div>
  )
}
