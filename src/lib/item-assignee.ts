import type { Order } from '../types'

/**
 * 個体の担当者/持出者を引く。
 *
 * product_items には担当者の列が無い。担当者は発注が持っている
 * （orders.assigned_to = 担当営業、orders.carried_by = 実際に運ぶ人）。
 * だから「その個体が割り当てられている発注」を経由して引く。
 *
 * 割り当ては order.items[].assigned_item_ids（数量分の配列。未割当の枠は null）。
 */
export function getItemAssignees(itemId: string, orders: Order[]): string[] {
  const names = new Set<string>()

  for (const order of orders) {
    const assigned = (order.items ?? []).some(oi =>
      (oi.assigned_item_ids ?? []).some(id => id === itemId)
    )
    if (!assigned) continue

    for (const name of [order.assigned_to, order.carried_by]) {
      if (name && name.trim()) names.add(name)
    }
  }

  return [...names]
}

/**
 * 検索フィルタ用。query が空なら絞り込まない（全部通す）。
 * 一致は部分一致・大文字小文字を区別しない。
 */
export function matchesAssignee(itemId: string, orders: Order[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return getItemAssignees(itemId, orders).some(name => name.toLowerCase().includes(q))
}
