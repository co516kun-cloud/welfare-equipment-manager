import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { supabaseDb } from '../lib/supabase-database'
import { LabelPrinter } from '../lib/label-printer'
import { useAuth } from '../hooks/useAuth'
import type { LabelPrintQueue } from '../types'

/**
 * ラベル印刷状況
 *
 * 2026-09-04 に「押す場所」から「見る場所」に変えた。
 * 印刷は事務所PCで常駐している印刷エージェント（mcp-server/src/print-agent）が
 * label_print_queue に行が入った瞬間に拾って行う。人がこの画面で「印刷」を押す必要はない。
 *
 * この画面の役目:
 *   - いま何が印刷待ち／印刷中／完了／失敗なのかを見る（5秒ごとに自動更新）
 *   - 失敗した行を「再印刷」で pending に戻す（エージェントが拾い直す）
 *   - エージェントが止まっていそうなときに気づけるようにする（60秒以上 pending のまま）
 *   - 保険: b-PAC ブラウザ拡張が入った PC なら、その場で直接印刷もできる
 */

const REFRESH_MS = 5_000
const STALE_PENDING_MS = 60_000
const SHOW_LIMIT = 100

const STATUS_LABEL: Record<LabelPrintQueue['status'], string> = {
  pending: '印刷待ち',
  printing: '印刷中',
  completed: '完了',
  failed: '失敗',
}

const STATUS_CLASS: Record<LabelPrintQueue['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  printing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function LabelQueuePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [queue, setQueue] = useState<LabelPrintQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [printerAvailable, setPrinterAvailable] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadQueue = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true)
      const data = await supabaseDb.getLabelPrintQueue()
      setQueue(data.slice(0, SHOW_LIMIT))
    } catch (error) {
      console.error('印刷状況読み込みエラー:', error)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue(true)
    const timer = setInterval(() => loadQueue(false), REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadQueue])

  useEffect(() => {
    // b-PAC 拡張は body にクラスを付けるまで少し時間がかかる
    const check = () => setPrinterAvailable(LabelPrinter.isAvailable())
    check()
    const t = setTimeout(check, 1500)
    return () => clearTimeout(t)
  }, [])

  // --- エージェントが止まっていそうか（60秒以上 pending のまま）---
  const now = Date.now()
  const stalePending = queue.filter(
    q => q.status === 'pending' && now - new Date(q.created_at).getTime() > STALE_PENDING_MS
  )

  // --- 再印刷: pending に戻すだけ。実際の印刷はエージェントがやる ---
  const handleRequeue = async (item: LabelPrintQueue) => {
    setBusyId(item.id)
    try {
      await supabaseDb.requeueLabelPrint(item.id)
      await loadQueue(false)
    } catch (error) {
      console.error('再印刷エラー:', error)
      alert('再印刷の指示に失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (item: LabelPrintQueue) => {
    if (!confirm(`${item.management_id} の印刷待ちを取り消しますか？`)) return
    setBusyId(item.id)
    try {
      await supabaseDb.deleteLabelPrintQueue(item.id)
      await loadQueue(false)
    } catch (error) {
      console.error('削除エラー:', error)
      alert('取り消しに失敗しました')
    } finally {
      setBusyId(null)
    }
  }

  // --- 保険: この PC の b-PAC 拡張で直接印刷 ---
  // Supabase Auth の User に name は無い（旧コードの user.name は常に undefined で printed_by が空だった）
  const displayName = user?.user_metadata?.name || user?.email || 'ブラウザ'

  const handleDirectPrint = async (item: LabelPrintQueue) => {
    if (!user) return
    setBusyId(item.id)
    try {
      await supabaseDb.updateLabelPrintQueueStatus(item.id, 'printing')
      await LabelPrinter.printLabel({
        managementId: item.management_id,
        productName: item.product_name,
        conditionNotes: item.condition_notes || '',
        qrCode: item.management_id,
      })
      await supabaseDb.updateLabelPrintQueueStatus(item.id, 'completed', displayName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      await supabaseDb.updateLabelPrintQueueStatus(item.id, 'failed', undefined, message)
      alert(`印刷エラー: ${message}`)
    } finally {
      setBusyId(null)
      await loadQueue(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ラベル印刷状況</h1>
            <p className="text-muted-foreground mt-1">
              印刷は事務所PCの印刷エージェントが自動で行います
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            戻る
          </Button>
        </div>

        {stalePending.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
            <p className="font-semibold">
              {stalePending.length}件が1分以上「印刷待ち」のままです
            </p>
            <p className="mt-1">
              事務所PCが起動しているか、印刷エージェントが動いているかを確認してください。
              PCが起動すれば、待っている分はまとめて印刷されます。
            </p>
          </div>
        )}

        {printerAvailable && (
          <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800">
            この PC の b-PAC 拡張が使えます。エージェントを待たずに直接印刷することもできます。
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">印刷の記録はまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(item => {
            const busy = busyId === item.id
            return (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${STATUS_CLASS[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                        <h3 className="font-bold text-lg truncate">{item.product_name}</h3>
                      </div>
                      <span className="font-mono text-lg font-bold whitespace-nowrap">
                        {item.management_id}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>状態: {item.condition_notes || '(メモなし)'}</p>
                      <p>
                        {item.created_by} が {new Date(item.created_at).toLocaleString('ja-JP')} に指示
                      </p>
                      {item.status === 'completed' && item.printed_at && (
                        <p className="text-green-700">
                          {item.printed_by || '—'} が {new Date(item.printed_at).toLocaleString('ja-JP')} に印刷
                        </p>
                      )}
                      {item.status === 'printing' && (
                        <p className="text-blue-700">プリンタに送信済み。まもなく出ます</p>
                      )}
                      {item.status === 'failed' && item.error_message && (
                        <p className="text-red-700 break-words">エラー: {item.error_message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {(item.status === 'failed' || item.status === 'completed') && (
                      <Button size="sm" onClick={() => handleRequeue(item)} disabled={busy}>
                        再印刷
                      </Button>
                    )}
                    {item.status === 'pending' && printerAvailable && (
                      <Button size="sm" onClick={() => handleDirectPrint(item)} disabled={busy}>
                        この PC で印刷
                      </Button>
                    )}
                    {(item.status === 'pending' || item.status === 'failed') && (
                      <Button size="sm" variant="outline" onClick={() => handleDelete(item)} disabled={busy}>
                        取り消し
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
