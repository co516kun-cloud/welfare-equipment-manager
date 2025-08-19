import type { Product, ProductItem, Order, OrderItem } from '../types'

/**
 * 予約枠情報
 */
export interface ReservationInfo {
  productId: string
  totalReserved: number  // 予約済み数量
  orders: {
    orderId: string
    customerName: string
    quantity: number
    orderDate: string
  }[]
}

/**
 * 在庫サマリー情報
 */
export interface InventorySummary {
  productId: string
  productName: string
  physicalStock: number      // 物理在庫（利用可能な商品数）
  reservedCount: number      // 予約枠数
  availableStock: number     // 実質在庫数
  rentedCount: number        // 貸出中数
  maintenanceCount: number   // メンテナンス中数
}

/**
 * 承認済みで未割当の予約枠を計算
 */
export function calculateReservations(orders: Order[]): Map<string, ReservationInfo> {
  const reservations = new Map<string, ReservationInfo>()

  orders.forEach(order => {
    // 承認済みの注文のみ対象
    if (order.status !== 'approved') return
    
    order.items?.forEach(item => {
      // 未割当のアイテムのみカウント
      if (item.item_processing_status === 'waiting' && 
          (!item.assigned_item_ids || item.assigned_item_ids.length === 0)) {
        
        const existing = reservations.get(item.product_id) || {
          productId: item.product_id,
          totalReserved: 0,
          orders: []
        }
        
        existing.totalReserved += item.quantity
        existing.orders.push({
          orderId: order.id,
          customerName: order.customer_name,
          quantity: item.quantity,
          orderDate: order.created_at
        })
        
        reservations.set(item.product_id, existing)
      }
    })
  })

  return reservations
}

/**
 * 商品ごとの在庫サマリーを計算
 */
export function calculateInventorySummary(
  products: Product[],
  items: ProductItem[],
  orders: Order[]
): InventorySummary[] {
  const reservations = calculateReservations(orders)
  
  return products.map(product => {
    // 商品に関連するアイテムを取得
    const productItems = items.filter(item => item.product_id === product.id)
    
    // ステータス別にカウント
    const statusCounts = productItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // 予約情報を取得
    const reservation = reservations.get(product.id)
    const reservedCount = reservation?.totalReserved || 0
    
    // 物理在庫（利用可能な商品数）
    const physicalStock = statusCounts['available'] || 0
    
    // 実質在庫数 = 物理在庫 - 予約枠
    const availableStock = Math.max(0, physicalStock - reservedCount)
    
    return {
      productId: product.id,
      productName: product.name,
      physicalStock,
      reservedCount,
      availableStock,
      rentedCount: statusCounts['rented'] || 0,
      maintenanceCount: statusCounts['maintenance'] || 0
    }
  })
}

/**
 * 特定商品の実質在庫数を取得
 */
export function getAvailableStock(
  productId: string,
  items: ProductItem[],
  orders: Order[]
): number {
  const reservations = calculateReservations(orders)
  const productItems = items.filter(item => 
    item.product_id === productId && item.status === 'available'
  )
  
  const physicalStock = productItems.length
  const reservedCount = reservations.get(productId)?.totalReserved || 0
  
  return Math.max(0, physicalStock - reservedCount)
}

/**
 * 発注可能かチェック
 */
export function canFulfillOrder(
  productId: string,
  requestedQuantity: number,
  items: ProductItem[],
  orders: Order[]
): boolean {
  const availableStock = getAvailableStock(productId, items, orders)
  return availableStock >= requestedQuantity
}