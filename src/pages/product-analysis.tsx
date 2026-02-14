import { useState, useEffect, useMemo } from 'react'
import { Select } from '../components/ui/select'
import { useInventoryStore } from '../stores/useInventoryStore'
import { supabaseDb } from '../lib/supabase-database'
import type { ItemHistory } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const WORKING_DAYS = 22

interface AnalysisRow {
  productName: string
  productId: string
  rentalCount: number
  returnCount: number
  disinfectionPace: number // 返却数 ÷ 営業日数
}

export function ProductAnalysis() {
  const { categories, products, items } = useInventoryStore()
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(new Date().getMonth() + 1)
  const [histories, setHistories] = useState<ItemHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // カテゴリで絞り込んだ商品リスト
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products
    return products.filter(p => p.category_id === selectedCategory)
  }, [products, selectedCategory])

  // item_id → product_id マッピング
  const itemToProductMap = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach(item => {
      map.set(item.id, item.product_id)
    })
    return map
  }, [items])

  // product_id → product name マッピング
  const productNameMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach(p => {
      map.set(p.id, p.name)
    })
    return map
  }, [products])

  // product_id → category_id マッピング
  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach(p => {
      map.set(p.id, p.category_id)
    })
    return map
  }, [products])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const data = await supabaseDb.getHistoriesForAnalysis(
          selectedYear,
          selectedMonth || undefined
        )
        setHistories(data)
      } catch (error) {
        console.error('Error fetching analysis data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [selectedYear, selectedMonth])

  // 分析データ集計
  const analysisData = useMemo((): AnalysisRow[] => {
    const rentalCounts = new Map<string, number>()
    const returnCounts = new Map<string, number>()

    histories.forEach(h => {
      const productId = itemToProductMap.get(h.item_id)
      if (!productId) return

      // カテゴリフィルタ
      if (selectedCategory) {
        const catId = productCategoryMap.get(productId)
        if (catId !== selectedCategory) return
      }

      // 商品フィルタ
      if (selectedProduct && productId !== selectedProduct) return

      if (h.to_status === 'rented') {
        rentalCounts.set(productId, (rentalCounts.get(productId) || 0) + 1)
      } else if (h.to_status === 'returned') {
        returnCounts.set(productId, (returnCounts.get(productId) || 0) + 1)
      }
    })

    // 全product_idを集める
    const allProductIds = new Set([...rentalCounts.keys(), ...returnCounts.keys()])

    const rows: AnalysisRow[] = []
    allProductIds.forEach(productId => {
      const rentalCount = rentalCounts.get(productId) || 0
      const returnCount = returnCounts.get(productId) || 0
      const name = productNameMap.get(productId) || productId

      rows.push({
        productName: name,
        productId,
        rentalCount,
        returnCount,
        disinfectionPace: Math.round((returnCount / WORKING_DAYS) * 10) / 10
      })
    })

    // 返却数の多い順
    rows.sort((a, b) => b.returnCount - a.returnCount)
    return rows
  }, [histories, itemToProductMap, productNameMap, productCategoryMap, selectedCategory, selectedProduct])

  // グラフ用データ
  const chartData = useMemo(() => {
    return analysisData.map(row => ({
      name: row.productName.length > 10 ? row.productName.slice(0, 10) + '…' : row.productName,
      貸与数: row.rentalCount,
      返却数: row.returnCount
    }))
  }, [analysisData])

  // 合計
  const totals = useMemo(() => {
    return analysisData.reduce(
      (acc, row) => ({
        rental: acc.rental + row.rentalCount,
        return_: acc.return_ + row.returnCount
      }),
      { rental: 0, return_: 0 }
    )
  }, [analysisData])

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">商品別 貸与・返却分析</h1>
          <p className="text-sm text-muted-foreground mt-1">
            月別の貸与数・返却数から消毒ペースを把握できます
          </p>
        </div>

        {/* フィルタ */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">カテゴリ</label>
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setSelectedProduct('')
                }}
              >
                <option value="">すべて</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">商品名</label>
              <Select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">すべて</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
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
                onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">年間合計</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}月</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totals.rental}</div>
            <div className="text-xs text-muted-foreground mt-1">貸与数</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{totals.return_}</div>
            <div className="text-xs text-muted-foreground mt-1">返却数</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {selectedMonth
                ? (Math.round((totals.return_ / WORKING_DAYS) * 10) / 10)
                : '-'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedMonth ? '消毒ペース(台/日)' : '月を選択してください'}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">データを読み込み中...</p>
            </div>
          </div>
        ) : analysisData.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">該当期間のデータがありません</p>
          </div>
        ) : (
          <>
            {/* グラフ */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">貸与数・返却数グラフ</h2>
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(400, analysisData.length * 80), height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '13px' }} />
                      <Bar dataKey="貸与数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="返却数" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* テーブル */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">詳細データ</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">商品名</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">貸与数</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">返却数</th>
                      {selectedMonth && (
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">消毒ペース(台/日)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.map((row) => (
                      <tr key={row.productId} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">{row.productName}</td>
                        <td className="py-3 px-4 text-sm text-right text-blue-600 font-semibold">{row.rentalCount}</td>
                        <td className="py-3 px-4 text-sm text-right text-emerald-600 font-semibold">{row.returnCount}</td>
                        {selectedMonth && (
                          <td className="py-3 px-4 text-sm text-right text-amber-600 font-semibold">{row.disinfectionPace}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="py-3 px-4 text-sm text-foreground">合計</td>
                      <td className="py-3 px-4 text-sm text-right text-blue-600">{totals.rental}</td>
                      <td className="py-3 px-4 text-sm text-right text-emerald-600">{totals.return_}</td>
                      {selectedMonth && (
                        <td className="py-3 px-4 text-sm text-right text-amber-600">
                          {Math.round((totals.return_ / WORKING_DAYS) * 10) / 10}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
