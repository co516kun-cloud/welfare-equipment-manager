import { describe, it, expect } from 'vitest'
import { applyRealtimeEvent, type SyncState } from '../realtime-sync'

/**
 * Realtime で届いた1行を、いまの状態にマージする（2026-09-08）
 *
 * 田口さん:
 *   「もともとリアルタイム同期にしてたんやけど、なんかうまくいかなかったんよね」
 *
 * 原因は2つあった。
 *  ・配信リスト（supabase_realtime）に orders / order_items が入っていなかった
 *    → 購読は成功するのにイベントが1件も来ない
 *  ・アプリ側が product_items の UPDATE しか購読していなかった
 *
 * 2025-08 に一度入れて撤退したときは、イベントのたびに全件を取り直していて重かった。
 * 今回は届いた1行だけをマージする。その差し替え処理をここに切り出して試験する。
 */

const item = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, product_id: 'PRD-1', status: 'available', qr_code: id, ...over }) as never

const orderItem = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, product_id: 'PRD-1', quantity: 1, assigned_item_ids: [], ...over }) as never

const order = (id: string, items: unknown[] = [], over: Record<string, unknown> = {}) =>
  ({ id, customer_name: '山田', status: 'approved', items, ...over }) as never

const base = (): SyncState => ({
  items: [item('WC-001'), item('WC-002')],
  orders: [order('ORD-1', [orderItem('OI-1'), orderItem('OI-2')]), order('ORD-2', [orderItem('OI-3')])],
})

describe('product_items', () => {
  it('UPDATE は該当の1件だけ差し替える', () => {
    const next = applyRealtimeEvent(base(), 'product_items', 'UPDATE', item('WC-001', { status: 'rented' }))!
    expect(next.items.find(i => i.id === 'WC-001')!.status).toBe('rented')
    expect(next.items.find(i => i.id === 'WC-002')!.status).toBe('available')
    expect(next.items).toHaveLength(2)
  })

  it('UPDATE は既存の値を保ちつつ上書きする（部分的なペイロードでも壊さない）', () => {
    const state: SyncState = { items: [item('WC-001', { customer_name: '田中', location: '倉庫A' })], orders: [] }
    const next = applyRealtimeEvent(state, 'product_items', 'UPDATE', { id: 'WC-001', status: 'rented' })!
    expect(next.items[0].status).toBe('rented')
    expect(next.items[0].location).toBe('倉庫A')
  })

  // 他の端末で新しく登録された個体が出てこなかった
  it('INSERT で末尾に増える', () => {
    const next = applyRealtimeEvent(base(), 'product_items', 'INSERT', item('WC-003'))!
    expect(next.items.map(i => i.id)).toEqual(['WC-001', 'WC-002', 'WC-003'])
  })

  it('INSERT が二重に届いても増えない', () => {
    const next = applyRealtimeEvent(base(), 'product_items', 'INSERT', item('WC-001'))
    expect(next?.items ?? base().items).toHaveLength(2)
  })

  it('DELETE で消える', () => {
    const next = applyRealtimeEvent(base(), 'product_items', 'DELETE', {}, { id: 'WC-001' })!
    expect(next.items.map(i => i.id)).toEqual(['WC-002'])
  })

  it('知らない個体の DELETE は何もしない', () => {
    expect(applyRealtimeEvent(base(), 'product_items', 'DELETE', {}, { id: 'NOPE' })).toBeNull()
  })
})

describe('orders', () => {
  it('INSERT で発注が増える', () => {
    const next = applyRealtimeEvent(base(), 'orders', 'INSERT', order('ORD-3'))!
    expect(next.orders.map(o => o.id)).toEqual(['ORD-1', 'ORD-2', 'ORD-3'])
  })

  it('items を持たない INSERT でも空配列で始まる（後から order_items が届く）', () => {
    const next = applyRealtimeEvent(base(), 'orders', 'INSERT', { id: 'ORD-3', customer_name: '佐藤' })!
    expect(next.orders.find(o => o.id === 'ORD-3')!.items).toEqual([])
  })

  // orders の UPDATE には items が入っていない。上書きすると明細が消える
  it('UPDATE で明細（items）を消さない', () => {
    const next = applyRealtimeEvent(base(), 'orders', 'UPDATE', { id: 'ORD-1', status: 'cancelled' })!
    const o = next.orders.find(x => x.id === 'ORD-1')!
    expect(o.status).toBe('cancelled')
    expect(o.items.map((i: { id: string }) => i.id)).toEqual(['OI-1', 'OI-2'])
  })

  it('DELETE で消える', () => {
    const next = applyRealtimeEvent(base(), 'orders', 'DELETE', {}, { id: 'ORD-2' })!
    expect(next.orders.map(o => o.id)).toEqual(['ORD-1'])
  })
})

describe('order_items', () => {
  it('UPDATE で親の明細が差し替わる', () => {
    const next = applyRealtimeEvent(base(), 'order_items', 'UPDATE',
      orderItem('OI-1', { order_id: 'ORD-1', item_processing_status: 'ready' }))!
    const o = next.orders.find(x => x.id === 'ORD-1')!
    expect(o.items.find((i: { id: string }) => i.id === 'OI-1')!.item_processing_status).toBe('ready')
    expect(o.items).toHaveLength(2)
  })

  it('INSERT で親に明細が増える', () => {
    const next = applyRealtimeEvent(base(), 'order_items', 'INSERT', orderItem('OI-9', { order_id: 'ORD-2' }))!
    expect(next.orders.find(x => x.id === 'ORD-2')!.items.map((i: { id: string }) => i.id)).toEqual(['OI-3', 'OI-9'])
  })

  // DELETE のペイロードは主キーしか来ないことがある（REPLICA IDENTITY 既定）
  it('order_id が来ない DELETE でも、明細IDから親を探して消す', () => {
    const next = applyRealtimeEvent(base(), 'order_items', 'DELETE', {}, { id: 'OI-2' })!
    expect(next.orders.find(x => x.id === 'ORD-1')!.items.map((i: { id: string }) => i.id)).toEqual(['OI-1'])
  })

  it('親が見つからない明細は何もしない（次の全件読み込みで拾う）', () => {
    expect(applyRealtimeEvent(base(), 'order_items', 'UPDATE', orderItem('OI-X', { order_id: 'ORD-99' }))).toBeNull()
  })

  it('親を跨いで同じIDを消さない', () => {
    const state: SyncState = {
      items: [],
      orders: [order('ORD-1', [orderItem('OI-1')]), order('ORD-2', [orderItem('OI-1')])],
    }
    const next = applyRealtimeEvent(state, 'order_items', 'DELETE', {}, { id: 'OI-1', order_id: 'ORD-2' })!
    expect(next.orders.find(o => o.id === 'ORD-1')!.items).toHaveLength(1)
    expect(next.orders.find(o => o.id === 'ORD-2')!.items).toHaveLength(0)
  })
})

describe('変化が無いときは何も返さない', () => {
  // 毎回新しいオブジェクトを返すと、届くたびに画面全体が再描画される
  it('知らないテーブルは null', () => {
    expect(applyRealtimeEvent(base(), 'unknown_table' as never, 'UPDATE', item('WC-001'))).toBeNull()
  })

  it('知らないイベントは null', () => {
    expect(applyRealtimeEvent(base(), 'product_items', 'TRUNCATE' as never, item('WC-001'))).toBeNull()
  })

  it('id が無い行は null', () => {
    expect(applyRealtimeEvent(base(), 'product_items', 'UPDATE', { status: 'rented' })).toBeNull()
  })

  it('知らない個体の UPDATE は取り込む（読み込み後に増えた分）', () => {
    const next = applyRealtimeEvent(base(), 'product_items', 'UPDATE', item('WC-099'))!
    expect(next.items.map(i => i.id)).toContain('WC-099')
  })

  it('元の状態は書き換えない（別物を返す）', () => {
    const state = base()
    const next = applyRealtimeEvent(state, 'product_items', 'UPDATE', item('WC-001', { status: 'rented' }))!
    expect(state.items.find(i => i.id === 'WC-001')!.status).toBe('available')
    expect(next.items).not.toBe(state.items)
  })
})
