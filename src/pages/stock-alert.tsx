import { useState, useMemo, useEffect } from 'react'
import { useInventoryStore } from '../stores/useInventoryStore'
import { Button } from '../components/ui/button'
import { supabaseDb } from '../lib/supabase-database'

export function StockAlert() {
  const { items, products, categories, loadData } = useInventoryStore()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)

  // 全アイテムデータをカテゴリ別に読み込み
  useEffect(() => {
    const loadAllItemsByCategories = async () => {
      setLoading(true)
      try {
        // 基本データがない場合は読み込み
        if (products.length === 0 || categories.length === 0) {
          await loadData()
        }
        
        // 少し待ってから categories が更新されるのを確認
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 最新のカテゴリデータを取得
        const currentCategories = await supabaseDb.getCategories()
        
        
        // 各カテゴリのアイテムを並行して読み込み
        const categoryItemsPromises = currentCategories.map(category => 
          supabaseDb.getProductItemsByCategoryId(category.id)
        )
        
        const categoryItemsResults = await Promise.all(categoryItemsPromises)
        
        // 全てのアイテムを統合
        const allItemsData = categoryItemsResults.flat()
        
        setAllItems(allItemsData)
      } catch (error) {
        console.error('Error loading items for stock alert:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAllItemsByCategories()
  }, [])

  // 在庫2以下の商品をフィルタリング
  const lowStockItems = useMemo(() => {
    if (loading || allItems.length === 0) return []
    
    // 商品ごとにグループ化して在庫数を計算
    const stockByProduct = allItems.reduce((acc, item) => {
      const key = item.product_id
      if (!acc[key]) {
        acc[key] = {
          product_id: item.product_id,
          available_count: 0,
          total_count: 0
        }
      }
      acc[key].total_count++
      if (item.status === 'available') {
        acc[key].available_count++
      }
      return acc
    }, {} as Record<string, {
      product_id: string
      available_count: number
      total_count: number
    }>)

    // 在庫2以下の商品のみフィルタリング
    const lowStockProducts = Object.values(stockByProduct)
      .filter(stock => stock.available_count <= 2)
      .map(stock => {
        const product = products.find(p => p.id === stock.product_id)
        const category = categories.find(c => c.id === product?.category_id)
        
        return {
          product_id: stock.product_id,
          product_name: product?.name || '不明な商品',
          category: category?.name || '不明なカテゴリ',
          stock_count: stock.available_count
        }
      })
    
    return lowStockProducts.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.stock_count - b.stock_count
      } else {
        return b.stock_count - a.stock_count
      }
    })
  }, [allItems, products, categories, sortOrder, loading])

  // 在庫数に応じた色を取得
  const getStockColor = (count: number) => {
    switch (count) {
      case 0:
        return 'bg-gradient-to-r from-red-500 to-red-600 border-red-300'
      case 1:
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600 border-yellow-300'
      case 2:
        return 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-300'
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-300'
    }
  }

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const refreshData = async () => {
    setLoading(true)
    try {
      await loadData() // 基本データを再読み込み
      
      // 最新のカテゴリデータを取得
      const currentCategories = await supabaseDb.getCategories()
      
      
      // 各カテゴリのアイテムを並行して読み込み
      const categoryItemsPromises = currentCategories.map(category => 
        supabaseDb.getProductItemsByCategoryId(category.id)
      )
      
      const categoryItemsResults = await Promise.all(categoryItemsPromises)
      
      // 全てのアイテムを統合
      const allItemsData = categoryItemsResults.flat()
      
      setAllItems(allItemsData)
    } catch (error) {
      console.error('Error refreshing stock alert data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white">在庫アラート</h1>
          <div className="flex space-x-3">
            <Button
              onClick={refreshData}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              disabled={loading}
            >
              {loading ? '🔄' : '🔄'} 更新
            </Button>
            <Button
              onClick={toggleSort}
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              在庫数順 {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>
        <p className="text-slate-300">在庫が2以下の商品を表示しています</p>
      </div>

      {/* コンテンツ */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            <p className="text-white text-lg">在庫データを読み込み中...</p>
          </div>
        </div>
      ) : lowStockItems.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
              <span className="text-4xl text-white">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">在庫不足の商品はありません。</h2>
            <p className="text-slate-300">すべての商品が適正在庫を保っています。</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lowStockItems.map((item) => (
            <div
              key={item.product_id}
              className={`${getStockColor(item.stock_count)} backdrop-blur-xl rounded-2xl p-6 border-2 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105`}
            >
              {/* 在庫数（大きく表示） */}
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-white mb-2">
                  {item.stock_count}
                </div>
                <div className="text-white/80 text-sm font-medium">
                  在庫数
                </div>
              </div>
              
              {/* 商品名（大きく表示） */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-white truncate" title={item.product_name}>
                  {item.product_name}
                </h3>
                <p className="text-white/70 text-sm mt-2">
                  {item.category}
                </p>
              </div>

              {/* 緊急度インジケーター */}
              <div className="mt-4 text-center">
                {item.stock_count === 0 && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                    🚨 緊急
                  </div>
                )}
                {item.stock_count === 1 && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                    ⚠️ 注意
                  </div>
                )}
                {item.stock_count === 2 && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                    📝 要確認
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}