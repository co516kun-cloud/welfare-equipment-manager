import { useInventoryStore } from '../stores/useInventoryStore'
import { useNotificationStore } from '../stores/useNotificationStore'
import type { ProductItem, Order } from '../types'

// 通知生成の間隔を管理
const notificationCache = new Map<string, string>()

export const generateNotifications = () => {
  const inventoryStore = useInventoryStore.getState()
  const notificationStore = useNotificationStore.getState()
  
  const { items, orders, products } = inventoryStore
  const now = new Date()
  
  // 1. 準備作業リマインダー
  checkPreparationReminders(orders, items, products, notificationStore, now)
  
  // 2. 異常ステータス通知
  checkAnomalousStatuses(items, products, notificationStore, now)
  
  // 3. システム通知（リアルタイム同期など）
  checkSystemStatus(inventoryStore, notificationStore)
}

// 準備作業リマインダー
function checkPreparationReminders(
  orders: Order[], 
  items: ProductItem[], 
  products: any[], 
  notificationStore: any, 
  now: Date
) {
  // 本日配送予定の未準備商品をチェック
  const today = now.toISOString().split('T')[0]
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const urgentOrders = orders.filter(order => {
    if (!order.items || order.status !== 'approved') return false
    
    const requiredDate = order.required_date
    const hasUnpreparedItems = order.items.some(item => 
      item.item_processing_status === 'waiting'
    )
    
    return hasUnpreparedItems && (requiredDate === today || requiredDate === tomorrow)
  })
  
  urgentOrders.forEach(order => {
    const unpreparedCount = order.items?.filter(item => 
      item.item_processing_status === 'waiting'
    ).length || 0
    
    const cacheKey = `prep-${order.id}-${order.required_date}`
    if (!notificationCache.has(cacheKey)) {
      const isToday = order.required_date === today
      
      notificationStore.addNotification({
        type: 'preparation',
        priority: isToday ? 'high' : 'medium',
        title: isToday ? '🚨 本日配送分の準備未完了' : '⚡ 明日配送分の準備催促',
        message: `${order.customer_name}様の発注（${unpreparedCount}点）が未準備です`,
        actionUrl: '/preparation',
        actionLabel: '準備画面へ',
        metadata: { orderId: order.id, customerName: order.customer_name }
      })
      
      // 24時間はキャッシュ
      notificationCache.set(cacheKey, now.toISOString())
      setTimeout(() => notificationCache.delete(cacheKey), 24 * 60 * 60 * 1000)
    }
  })
}

// 異常ステータス通知
function checkAnomalousStatuses(
  items: ProductItem[], 
  products: any[], 
  notificationStore: any, 
  now: Date
) {
  // 7日以上「返却済み」のまま消毒されていない商品
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const longReturnedItems = items.filter(item => {
    if (item.status !== 'returned') return false
    
    // updated_atがある場合はそれを使用、なければ作成日を使用
    const lastUpdate = item.updated_at || item.created_at
    if (!lastUpdate) return false
    
    const updateDate = new Date(lastUpdate)
    return updateDate < sevenDaysAgo
  })
  
  if (longReturnedItems.length > 0) {
    const cacheKey = `returned-anomaly-${now.toISOString().split('T')[0]}`
    if (!notificationCache.has(cacheKey)) {
      notificationStore.addNotification({
        type: 'status_anomaly',
        priority: 'medium',
        title: '⚠️ 長期間未消毒の返却商品',
        message: `${longReturnedItems.length}点の商品が7日以上返却済みのまま消毒されていません`,
        actionUrl: '/inventory',
        actionLabel: '在庫管理へ',
        metadata: { 
          itemIds: longReturnedItems.map(i => i.id),
          count: longReturnedItems.length 
        }
      })
      
      notificationCache.set(cacheKey, now.toISOString())
      setTimeout(() => notificationCache.delete(cacheKey), 24 * 60 * 60 * 1000)
    }
  }
  
  // 14日以上「故障中」の商品
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  
  const longBrokenItems = items.filter(item => {
    if (item.status !== 'out_of_order') return false
    
    const lastUpdate = item.updated_at || item.created_at
    if (!lastUpdate) return false
    
    const updateDate = new Date(lastUpdate)
    return updateDate < fourteenDaysAgo
  })
  
  if (longBrokenItems.length > 0) {
    const cacheKey = `broken-anomaly-${now.toISOString().split('T')[0]}`
    if (!notificationCache.has(cacheKey)) {
      const productNames = longBrokenItems.map(item => {
        const product = products.find(p => p.id === item.product_id)
        return product?.name || '不明'
      }).filter((v, i, a) => a.indexOf(v) === i) // 重複を除去
      
      notificationStore.addNotification({
        type: 'status_anomaly',
        priority: 'low',
        title: '🔧 長期故障中の商品',
        message: `${longBrokenItems.length}点が2週間以上故障中です（${productNames.slice(0, 3).join('、')}${productNames.length > 3 ? '他' : ''}）`,
        actionUrl: '/inventory',
        actionLabel: '詳細を確認',
        metadata: { 
          itemIds: longBrokenItems.map(i => i.id),
          count: longBrokenItems.length 
        }
      })
      
      notificationCache.set(cacheKey, now.toISOString())
      setTimeout(() => notificationCache.delete(cacheKey), 24 * 60 * 60 * 1000)
    }
  }
}

// システム通知
function checkSystemStatus(inventoryStore: any, notificationStore: any) {
  // リアルタイム同期の状態をチェック
  if (!inventoryStore.isRealtimeEnabled) {
    const cacheKey = 'realtime-disabled'
    if (!notificationCache.has(cacheKey)) {
      notificationStore.addNotification({
        type: 'system',
        priority: 'low',
        title: 'ℹ️ リアルタイム同期が無効',
        message: 'リアルタイム同期が無効になっています。手動で更新が必要です。',
        actionUrl: '/settings',
        actionLabel: '設定を確認',
        metadata: { type: 'realtime_sync' }
      })
      
      notificationCache.set(cacheKey, new Date().toISOString())
      setTimeout(() => notificationCache.delete(cacheKey), 60 * 60 * 1000) // 1時間
    }
  }
  
  // 最後の同期から1時間以上経過している場合
  const lastSync = inventoryStore.lastSyncTime
  if (lastSync) {
    const lastSyncDate = new Date(lastSync)
    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceSync > 1) {
      const cacheKey = 'sync-delay'
      if (!notificationCache.has(cacheKey)) {
        notificationStore.addNotification({
          type: 'system',
          priority: 'medium',
          title: '🔄 データ同期の遅延',
          message: `最後の同期から${Math.floor(hoursSinceSync)}時間経過しています`,
          actionUrl: '/mypage',
          actionLabel: '手動同期',
          metadata: { type: 'sync_delay', hours: hoursSinceSync }
        })
        
        notificationCache.set(cacheKey, new Date().toISOString())
        setTimeout(() => notificationCache.delete(cacheKey), 30 * 60 * 1000) // 30分
      }
    }
  }
}