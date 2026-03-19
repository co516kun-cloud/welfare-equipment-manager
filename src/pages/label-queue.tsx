import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { supabaseDb } from '../lib/supabase-database'
import { LabelPrinter } from '../lib/label-printer'
import { useAuth } from '../hooks/useAuth'
import { useProtectedAction, ProcessType } from '../hooks/useProtectedAction'
import type { LabelPrintQueue } from '../types'

export function LabelQueuePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [queue, setQueue] = useState<LabelPrintQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printerAvailable, setPrinterAvailable] = useState(false)

  // データ読み込み
  const loadQueue = async () => {
    try {
      setLoading(true)
      const data = await supabaseDb.getLabelPrintQueueByStatus('pending')
      setQueue(data)
    } catch (error) {
      console.error('印刷キュー読み込みエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()

    // b-PAC拡張機能の検出（拡張機能がbodyにクラスを追加するまで少し待つ）
    const checkPrinter = () => {
      const available = LabelPrinter.isAvailable()
      setPrinterAvailable(available)
      console.log('b-PAC拡張機能:', available ? '検出済み' : '未検出')
    }

    // 拡張機能のロードを待って再チェック
    checkPrinter()
    const timer = setTimeout(checkPrinter, 1500)
    return () => clearTimeout(timer)
  }, [])

  // 個別印刷
  const { execute: executePrint, isLoading: isPrinting } = useProtectedAction(
    async (queueItem: LabelPrintQueue) => {
      if (!user) {
        alert('ユーザー情報が取得できません')
        return
      }

      try {
        // ステータスを「印刷中」に更新
        await supabaseDb.updateLabelPrintQueueStatus(queueItem.id, 'printing')

        // ラベル印刷実行
        await LabelPrinter.printLabel({
          managementId: queueItem.management_id,
          productName: queueItem.product_name,
          conditionNotes: queueItem.condition_notes || '',
          qrCode: queueItem.management_id
        })

        // ステータスを「完了」に更新
        await supabaseDb.updateLabelPrintQueueStatus(
          queueItem.id,
          'completed',
          user.name
        )

        alert(`✅ ラベル印刷完了: ${queueItem.management_id}`)
        await loadQueue()
      } catch (error) {
        console.error('印刷エラー:', error)
        const errorMessage = error instanceof Error ? error.message : '不明なエラー'

        // ステータスを「失敗」に更新
        await supabaseDb.updateLabelPrintQueueStatus(
          queueItem.id,
          'failed',
          undefined,
          errorMessage
        )

        alert(`❌ 印刷エラー: ${errorMessage}`)
        await loadQueue()
      }
    },
    {
      processType: ProcessType.DATA_SUBMISSION,
      debounceMs: 2000,
      preventConcurrent: true
    }
  )

  // 一括印刷
  const handleBatchPrint = async () => {
    if (!user) {
      alert('ユーザー情報が取得できません')
      return
    }

    if (selectedIds.size === 0) {
      alert('印刷するアイテムを選択してください')
      return
    }

    const itemsToPrint = queue.filter(item => selectedIds.has(item.id))

    if (!confirm(`${itemsToPrint.length}件のラベルを印刷しますか？`)) {
      return
    }

    let successCount = 0
    let failCount = 0

    for (const item of itemsToPrint) {
      try {
        await supabaseDb.updateLabelPrintQueueStatus(item.id, 'printing')

        await LabelPrinter.printLabel({
          managementId: item.management_id,
          productName: item.product_name,
          conditionNotes: item.condition_notes || '',
          qrCode: item.management_id
        })

        await supabaseDb.updateLabelPrintQueueStatus(
          item.id,
          'completed',
          user.name
        )

        successCount++
      } catch (error) {
        console.error('印刷エラー:', error)
        const errorMessage = error instanceof Error ? error.message : '不明なエラー'

        await supabaseDb.updateLabelPrintQueueStatus(
          item.id,
          'failed',
          undefined,
          errorMessage
        )

        failCount++
      }
    }

    alert(
      `印刷完了\n` +
      `成功: ${successCount}件\n` +
      `失敗: ${failCount}件`
    )

    setSelectedIds(new Set())
    await loadQueue()
  }

  // 全選択 / 全解除
  const toggleSelectAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(queue.map(item => item.id)))
    }
  }

  // 個別選択
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('この印刷待ちを削除しますか？')) {
      return
    }

    try {
      await supabaseDb.deleteLabelPrintQueue(id)
      alert('削除しました')
      await loadQueue()
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました')
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
      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ラベル印刷待ち</h1>
            <p className="text-muted-foreground mt-1">
              Brother QL-800 ラベルプリンター
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            戻る
          </Button>
        </div>

        {/* プリンター状態 */}
        <div className="mt-4 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-3 h-3 rounded-full ${
                printerAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="font-medium">
              {printerAvailable
                ? 'プリンター接続可能'
                : 'プリンター接続不可'}
            </span>
          </div>

          {!printerAvailable && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm space-y-2">
              <p className="font-semibold text-amber-900">印刷を行うには以下のセットアップが必要です：</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-800">
                <li>Brother b-PAC Client Component をインストール</li>
                <li>
                  ブラウザに b-PAC 拡張機能をインストール
                </li>
                <li>ブラウザを再起動してこのページにアクセス</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => LabelPrinter.openExtensionInstallPage()}
              >
                b-PAC 拡張機能をインストール
              </Button>
              <p className="text-xs text-amber-700 mt-2">
                ※ IEモードは不要です。Chrome / Edge で直接印刷できます。
              </p>
            </div>
          )}

          {printerAvailable && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
              <p className="text-green-800">
                b-PAC拡張機能が検出されました。ラベル印刷が可能です。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 一括操作 */}
      {queue.length > 0 && (
        <div className="mb-4 p-4 bg-secondary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === queue.length && queue.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                <span>全選択 ({selectedIds.size} / {queue.length})</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleBatchPrint}
                disabled={selectedIds.size === 0 || !printerAvailable || isPrinting}
              >
                選択したラベルを印刷 ({selectedIds.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 印刷待ちリスト */}
      {queue.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">印刷待ちはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <div
              key={item.id}
              className="p-4 border rounded-lg hover:bg-secondary/10 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* チェックボックス */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="w-5 h-5 mt-1"
                />

                {/* 情報 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{item.product_name}</h3>
                    <span className="font-mono text-lg font-bold">
                      {item.management_id}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>状態: {item.condition_notes || '(メモなし)'}</p>
                    <p>登録者: {item.created_by}</p>
                    <p>
                      登録日時:{' '}
                      {new Date(item.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </div>

                {/* アクション */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => executePrint(item)}
                    disabled={!printerAvailable || isPrinting}
                  >
                    印刷
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(item.id)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
