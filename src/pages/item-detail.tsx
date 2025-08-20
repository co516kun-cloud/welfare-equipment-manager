import { Button } from '../components/ui/button'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabaseDb } from '../lib/supabase-database'
import type { ProductItem, Product, ItemHistory } from '../types'

export function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<ProductItem | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [histories, setHistories] = useState<ItemHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (itemId) {
      loadItemData(itemId)
    }
  }, [itemId])

  const loadItemData = async (id: string) => {
    setLoading(true)
    
    try {
      const itemData = await supabaseDb.getProductItemById(id)
      if (itemData) {
        setItem(itemData)
        
        const productData = await supabaseDb.getProductById(itemData.product_id)
        setProduct(productData)
        
        const itemHistories = await supabaseDb.getItemHistoriesByItemId(id)
        const sortedHistories = itemHistories.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        setHistories(sortedHistories)
      }
    } catch (error) {
      console.error('Error loading item data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success text-success-foreground'
      case 'rented': return 'bg-info text-info-foreground'
      case 'returned': return 'bg-secondary text-secondary-foreground'
      case 'cleaning': return 'bg-warning text-warning-foreground'
      case 'maintenance': return 'bg-warning text-warning-foreground'
      case 'demo_cancelled': return 'bg-info text-info-foreground'
      case 'out_of_order': return 'bg-destructive text-destructive-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '利用可能'
      case 'rented': return '貸与中'
      case 'returned': return '返却済み'
      case 'cleaning': return '消毒済み'
      case 'maintenance': return 'メンテナンス済み'
      case 'demo_cancelled': return 'デモキャンセル'
      case 'out_of_order': return '故障中'
      default: return status
    }
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-success text-success-foreground'
      case 'good': return 'bg-info text-info-foreground'
      case 'fair': return 'bg-warning text-warning-foreground'
      case 'caution': return 'bg-orange-500 text-white'
      case 'needs_repair': return 'bg-destructive text-destructive-foreground'
      case 'unknown': return 'bg-muted text-muted-foreground'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'excellent': return '優良'
      case 'good': return '良好'
      case 'fair': return '普通'
      case 'caution': return '注意'
      case 'needs_repair': return '要修理'
      case 'unknown': return '不明'
      default: return condition
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('返却')) return '📦'
    if (action.includes('貸与')) return '🏠'
    if (action.includes('消毒')) return '🧽'
    if (action.includes('メンテナンス')) return '🔧'
    if (action.includes('入庫')) return '📥'
    if (action.includes('デモ')) return '🎯'
    return '📋'
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <span className="mr-2">←</span>
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!item || !product) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <span className="mr-2">←</span>
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">商品が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">商品詳細</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <span className="mr-2">←</span>
          戻る
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">商品情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">商品名</p>
                <p className="font-medium text-foreground">{product.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">管理番号</p>
                <p className="font-medium text-foreground">{item.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">メーカー</p>
                <p className="font-medium text-foreground">{product.manufacturer}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">型番</p>
                <p className="font-medium text-foreground">{product.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">QRコード</p>
                <p className="font-medium text-foreground font-mono">{item.qr_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">現在の場所</p>
                <p className="font-medium text-foreground">{item.location}</p>
              </div>
            </div>
            
            {item.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">備考</p>
                <p className="text-foreground">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Status and Condition */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">現在の状態</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">ステータス</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">商品状態</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConditionColor(item.condition)}`}>
                  {getConditionText(item.condition)}
                </span>
              </div>
            </div>
          </div>

          {/* Loan Information */}
          {item.loan_start_date && (
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">貸与情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">貸与開始日</p>
                  <p className="font-medium text-foreground">{new Date(item.loan_start_date).toLocaleDateString('ja-JP')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">貸与期間</p>
                  <p className="font-medium text-foreground">
                    {(() => {
                      const startDate = new Date(item.loan_start_date)
                      const today = new Date()
                      const diffTime = Math.abs(today.getTime() - startDate.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return `${diffDays}日間`
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Timeline */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">業務フロー履歴</h2>
            
            {histories.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                履歴がありません
              </p>
            ) : (
              <div className="space-y-4">
                {histories.map((history, index) => (
                  <div key={history.id} className="relative">
                    {index !== histories.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-8 bg-border"></div>
                    )}
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm">{getActionIcon(history.action)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">
                            {history.action}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(history.timestamp).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.from_status)}`}>
                            {getStatusText(history.from_status)}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.to_status)}`}>
                            {getStatusText(history.to_status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          実行者: {history.performed_by}
                        </p>
                        {history.location && (
                          <p className="text-xs text-muted-foreground">
                            場所: {history.location}
                          </p>
                        )}
                        {history.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            備考: {history.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">クイックアクション</h2>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate(`/scan?item=${item.id}`)}
              >
                <span className="mr-2">📱</span>
                QRスキャン
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate(`/inventory?item=${item.id}`)}
              >
                <span className="mr-2">📦</span>
                在庫管理で表示
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate(`/history?item=${item.id}`)}
              >
                <span className="mr-2">📋</span>
                履歴で表示
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}