import { useState, useEffect, useMemo } from 'react'
import { Select } from '../components/ui/select'
import { useInventoryStore } from '../stores/useInventoryStore'
import { supabaseDb } from '../lib/supabase-database'
import type { ItemHistory } from '../types'

const ACTION_LABELS: Record<string, string> = {
  '消毒完了': '消毒',
  'メンテナンス完了': 'メンテ',
  '入庫処理': '入庫',
}

const WORK_TYPE_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: '消毒完了', label: '消毒のみ' },
  { value: 'メンテナンス完了', label: 'メンテのみ' },
  { value: '入庫処理', label: '入庫のみ' },
]

const BADGE_STYLES: Record<string, string> = {
  '消毒完了': 'bg-blue-100 text-blue-700',
  'メンテナンス完了': 'bg-purple-100 text-purple-700',
  '入庫処理': 'bg-green-100 text-green-700',
}

export function WorkManagement() {
  const { products, items } = useInventoryStore()
  const [selectedWorkType, setSelectedWorkType] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(new Date().getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState<number | ''>('')
  const [histories, setHistories] = useState<ItemHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // item_id → product_id マッピング
  const itemToProductMap = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach(item => map.set(item.id, item.product_id))
    return map
  }, [items])

  // product_id → product name マッピング
  const productNameMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach(p => map.set(p.id, p.name))
    return map
  }, [products])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const data = await supabaseDb.getWorkHistories(
          selectedYear,
          selectedMonth || undefined,
          selectedDay || undefined
        )
        setHistories(data)
      } catch (error) {
        console.error('Error fetching work histories:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [selectedYear, selectedMonth, selectedDay])

  // 作業種別フィルタ後のデータ
  const filteredHistories = useMemo(() => {
    if (!selectedWorkType) return histories
    return histories.filter(h => h.action === selectedWorkType)
  }, [histories, selectedWorkType])

  // サマリー集計（フィルタ後）
  const summary = useMemo(() => {
    const counts: Record<string, number> = { '消毒完了': 0, 'メンテナンス完了': 0, '入庫処理': 0 }
    filteredHistories.forEach(h => {
      if (h.action in counts) counts[h.action]++
    })
    return counts
  }, [filteredHistories])

  const getProductName = (itemId: string) => {
    const productId = itemToProductMap.get(itemId)
    if (!productId) return '-'
    return productNameMap.get(productId) || '-'
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">消毒作業管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            消毒・メンテナンス・入庫の作業完了記録
          </p>
        </div>

        {/* フィルタ */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">作業種別</label>
              <Select
                value={selectedWorkType}
                onChange={(e) => setSelectedWorkType(e.target.value)}
              >
                {WORK_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">年</label>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">月</label>
              <Select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value ? Number(e.target.value) : '')
                  setSelectedDay('')
                }}
              >
                <option value="">年間全件</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}月</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">日</label>
              <Select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedMonth}
              >
                <option value="">全日</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}日</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary['消毒完了']}</div>
            <div className="text-xs text-muted-foreground mt-1">消毒</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{summary['メンテナンス完了']}</div>
            <div className="text-xs text-muted-foreground mt-1">メンテ</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary['入庫処理']}</div>
            <div className="text-xs text-muted-foreground mt-1">入庫</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">データを読み込み中...</p>
            </div>
          </div>
        ) : filteredHistories.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">該当期間のデータがありません</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">日時</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">作業種別</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">商品名</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">管理番号</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistories.map((h) => (
                    <tr key={h.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-foreground whitespace-nowrap">
                        {new Date(h.timestamp).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BADGE_STYLES[h.action] || 'bg-gray-100 text-gray-700'}`}>
                          {ACTION_LABELS[h.action] || h.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">{getProductName(h.item_id)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground font-mono">{h.item_id}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{h.performed_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
