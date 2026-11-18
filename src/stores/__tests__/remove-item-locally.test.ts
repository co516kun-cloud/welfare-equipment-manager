/**
 * 完全消去した個体をストアから即座に除く removeItemLocally のテスト
 *
 * 背景（2026-11-18）: 個体の完全消去（管理者限定）が成功した直後、在庫一覧・カテゴリ別・商品別の
 *  キャッシュからもその台を消す。Realtime の DELETE でも消えるが、購読直後の 1 発目は
 *  取りこぼすことがあるので待たない。DB は触らない。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProductItem } from '../../types'

// optimistic-rollback.test.ts と同じ: ストアが import する supabase / supabase-database を切る
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: { getProductItems: vi.fn(async () => []), getOrders: vi.fn(async () => []) },
}))

const { useInventoryStore } = await import('../useInventoryStore')

const item = (id: string, product_id: string): ProductItem =>
  ({ id, product_id, status: 'available', condition: 'good', location: '倉庫', qr_code: id })

beforeEach(() => {
  useInventoryStore.setState({
    items: [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')],
    itemsCache: {
      categories: { wheelchair: [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')] },
      products: { 'PRD-1': [item('WC-001', 'PRD-1'), item('WC-002', 'PRD-1')] },
    },
  })
})

describe('removeItemLocally', () => {
  it('items とキャッシュの両方からその ID だけを除く', () => {
    useInventoryStore.getState().removeItemLocally('WC-001')
    const s = useInventoryStore.getState()
    expect(s.items.map(i => i.id)).toEqual(['WC-002'])
    expect(s.itemsCache.categories.wheelchair.map(i => i.id)).toEqual(['WC-002'])
    expect(s.itemsCache.products['PRD-1'].map(i => i.id)).toEqual(['WC-002'])
  })
  it('無い ID なら何も変わらない（Realtime の DELETE が後から届いても安全）', () => {
    useInventoryStore.getState().removeItemLocally('NOPE')
    expect(useInventoryStore.getState().items.length).toBe(2)
  })
})
