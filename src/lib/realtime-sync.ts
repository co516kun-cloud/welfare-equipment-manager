/**
 * Realtime で届いた1行を、いまの状態にマージする（2026-09-08）
 *
 * 田口さん:
 *   「もともとリアルタイム同期にしてたんやけど、なんかうまくいかなかったんよね」
 *
 * 原因は2つあった。
 *  ・配信リスト（supabase_realtime）に orders / order_items が入っていなかった。
 *    テーブルが入っていないと、購読は SUBSCRIBED になるのにイベントが1件も来ない
 *  ・アプリ側が product_items の UPDATE しか購読していなかった
 *
 * 2025-08 に一度入れて撤退したときは、イベントのたびに全件を取り直していて重かった
 * （`b21597d` `8a1fcc6`）。今回は届いた1行だけをマージする。
 *
 * 画面から切り離してあるのは、Realtime そのものが試験しにくいから。
 * 差し替えの正しさはここで確かめ、購読の配線だけをストアに残す。
 */
import type { ProductItem, Order, OrderItem } from '../types'

export type RealtimeTable = 'product_items' | 'orders' | 'order_items'
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface SyncState {
  items: ProductItem[]
  orders: Order[]
}

type Row = Record<string, unknown>

const idOf = (row: Row | undefined): string | null => {
  const id = row?.id
  return typeof id === 'string' && id ? id : null
}

/**
 * 届いた行を状態にマージした結果を返す。
 * 何も変わらないときは null を返す。毎回新しいオブジェクトを返すと、
 * イベントのたびに画面全体が再描画されるため。
 */
export function applyRealtimeEvent(
  state: SyncState,
  table: RealtimeTable,
  eventType: RealtimeEventType,
  row: Row,
  oldRow?: Row
): SyncState | null {
  // DELETE のペイロードは payload.new が空で、payload.old に主キーだけが入る
  const id = eventType === 'DELETE' ? idOf(oldRow) : idOf(row)
  if (!id) return null

  switch (table) {
    case 'product_items':
      return applyProductItem(state, eventType, id, row, oldRow)
    case 'orders':
      return applyOrder(state, eventType, id, row)
    case 'order_items':
      return applyOrderItem(state, eventType, id, row, oldRow)
    default:
      return null
  }
}

function applyProductItem(
  state: SyncState,
  eventType: RealtimeEventType,
  id: string,
  row: Row,
  _oldRow?: Row
): SyncState | null {
  const found = state.items.some(i => i.id === id)

  if (eventType === 'DELETE') {
    if (!found) return null
    return { ...state, items: state.items.filter(i => i.id !== id) }
  }

  if (eventType === 'INSERT') {
    // 同じイベントが二重に届くことがある
    if (found) return null
    return { ...state, items: [...state.items, row as unknown as ProductItem] }
  }

  if (eventType === 'UPDATE') {
    if (!found) {
      // 読み込んだ後に増えた個体。取り込んでおく
      return { ...state, items: [...state.items, row as unknown as ProductItem] }
    }
    // ペイロードに載っていない列を消さないよう、既存に重ねる
    return {
      ...state,
      items: state.items.map(i => (i.id === id ? { ...i, ...(row as Partial<ProductItem>) } : i)),
    }
  }

  return null
}

function applyOrder(
  state: SyncState,
  eventType: RealtimeEventType,
  id: string,
  row: Row
): SyncState | null {
  const found = state.orders.some(o => o.id === id)

  if (eventType === 'DELETE') {
    if (!found) return null
    return { ...state, orders: state.orders.filter(o => o.id !== id) }
  }

  if (eventType === 'INSERT') {
    if (found) return null
    // orders テーブルの行に明細は入っていない。明細は order_items のイベントで届く
    return { ...state, orders: [...state.orders, { ...(row as unknown as Order), items: [] }] }
  }

  if (eventType === 'UPDATE') {
    if (!found) {
      return { ...state, orders: [...state.orders, { ...(row as unknown as Order), items: [] }] }
    }
    return {
      ...state,
      // ⚠️ items は order_items 側が持つ。ここで上書きすると明細が全部消える
      orders: state.orders.map(o =>
        o.id === id ? { ...o, ...(row as Partial<Order>), items: o.items } : o
      ),
    }
  }

  return null
}

function applyOrderItem(
  state: SyncState,
  eventType: RealtimeEventType,
  id: string,
  row: Row,
  oldRow?: Row
): SyncState | null {
  const payload = eventType === 'DELETE' ? (oldRow ?? {}) : row
  const orderId = typeof payload.order_id === 'string' ? payload.order_id : null

  // order_id が来ないことがある（DELETE のペイロードは主キーだけのことが多い）。
  // その場合は明細IDを持つ発注を探す
  const parent = orderId
    ? state.orders.find(o => o.id === orderId)
    : state.orders.find(o => (o.items ?? []).some(i => i.id === id))

  // 親が手元に無い＝まだ読み込んでいない発注。次の全件読み込みで拾う
  if (!parent) return null

  const current = parent.items ?? []
  const found = current.some(i => i.id === id)

  let nextItems: OrderItem[]
  if (eventType === 'DELETE') {
    if (!found) return null
    nextItems = current.filter(i => i.id !== id)
  } else if (eventType === 'INSERT') {
    if (found) return null
    nextItems = [...current, row as unknown as OrderItem]
  } else if (eventType === 'UPDATE') {
    nextItems = found
      ? current.map(i => (i.id === id ? { ...i, ...(row as Partial<OrderItem>) } : i))
      : [...current, row as unknown as OrderItem]
  } else {
    return null
  }

  return {
    ...state,
    orders: state.orders.map(o => (o.id === parent.id ? { ...o, items: nextItems } : o)),
  }
}
