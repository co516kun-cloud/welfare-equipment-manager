import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 楽観的更新のロールバックが、他の個体まで巻き戻さないことのテスト
 *
 * 背景（2026-09-08・Realtime を広げる作業中に発見）:
 *  updateItemStatus は保存に失敗すると「開始時点の items 配列」をそのまま
 *  書き戻していた。保存を待っている間に Realtime で別の個体の更新が届くと、
 *  それも一緒に巻き戻されて画面が古い状態に戻る。
 *  Realtime を product_items だけでなく orders / order_items にも広げると
 *  イベント量が増えるため、踏む確率が上がる。
 */
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}))

const saveProductItem = vi.fn()
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    saveProductItem: (...a: unknown[]) => saveProductItem(...a),
    getProductItems: vi.fn(async () => []),
    getOrders: vi.fn(async () => []),
  },
}))

const { useInventoryStore } = await import('../useInventoryStore')

const item = (id: string, status: string) =>
  ({ id, product_id: 'PRD-1', status, condition: 'good', location: '倉庫', qr_code: id }) as never

describe('保存に失敗したときのロールバック', () => {
  beforeEach(() => {
    saveProductItem.mockReset()
    useInventoryStore.setState({ items: [item('WC-001', 'available'), item('WC-002', 'available')] })
  })

  it('失敗した個体だけ元に戻す', async () => {
    saveProductItem.mockRejectedValue(new Error('通信エラー'))
    await expect(useInventoryStore.getState().updateItemStatus('WC-001', 'rented')).rejects.toThrow()

    const items = useInventoryStore.getState().items
    expect(items.find(i => i.id === 'WC-001')!.status).toBe('available')
  })

  // ここが本題
  it('待っている間に Realtime で届いた別の個体の更新を巻き戻さない', async () => {
    saveProductItem.mockImplementation(async () => {
      // 保存を待っている最中に、他の端末の変更が Realtime で届いた状況
      useInventoryStore.setState({
        items: useInventoryStore.getState().items.map(i =>
          i.id === 'WC-002' ? ({ ...i, status: 'cleaning' } as never) : i
        ),
      })
      throw new Error('通信エラー')
    })

    await expect(useInventoryStore.getState().updateItemStatus('WC-001', 'rented')).rejects.toThrow()

    const items = useInventoryStore.getState().items
    expect(items.find(i => i.id === 'WC-001')!.status).toBe('available')  // 失敗した分は戻る
    expect(items.find(i => i.id === 'WC-002')!.status).toBe('cleaning')   // 届いた分は残る
  })

  it('成功したときは戻さない', async () => {
    saveProductItem.mockResolvedValue(undefined)
    await useInventoryStore.getState().updateItemStatus('WC-001', 'rented')
    expect(useInventoryStore.getState().items.find(i => i.id === 'WC-001')!.status).toBe('rented')
  })
})
