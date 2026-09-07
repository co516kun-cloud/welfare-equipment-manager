/**
 * モックDB（デモモード用）のテスト
 *
 * 背景（2026-09-07）:
 *  デモモード（VITE_SUPABASE_URL に 'dummy' が含まれる）では localStorage 上の
 *  作り物のデータで動く。本番DBに触らずに UI と業務フローを自動で確認するための土台。
 *
 *  ところが実装が古く、以下が欠けていた:
 *   - 履歴（item_histories）を扱うメソッドが getItemHistories すら無い。
 *     deleteItemHistory は存在しない STORAGE_KEYS.ITEM_HISTORIES に書き、
 *     未定義の this.getItemHistories() を呼ぶので、呼べば必ず落ちる
 *   - 個体の初期データが condition:'excellent' と notes を持つ（どちらも型から削除済み）
 *   - 発注が空なので、承認・準備・配送のフローを流せない
 *
 *  ここでは「デモモードで業務フローが最後まで通ること」に必要な振る舞いを固定する。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mockDb } from '../mock-database'

beforeEach(() => {
  localStorage.clear()
  // 各テストが同じ初期状態から始まるよう作り直す
  mockDb.resetForTest()
})

describe('初期データ', () => {
  it('個体は現在の型に沿っている（削除済みの excellent / notes を持たない）', async () => {
    const items = await mockDb.getProductItems()
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(['good', 'fair', 'caution', 'needs_repair', 'unknown']).toContain(item.condition)
      expect(item).not.toHaveProperty('notes')
    }
  })

  it('カテゴリIDがメンテ点検設定と噛み合う（beds / wheelchair など）', async () => {
    const categories = await mockDb.getCategories()
    const ids = categories.map(c => c.id)
    // maintenance-checklist-config.ts のキーと同じ体系であること
    expect(ids).toContain('wheelchair')
    expect(ids).toContain('beds')
  })

  it('業務フローを流せるだけの個体が各ステータスに用意されている', async () => {
    const items = await mockDb.getProductItems()
    const statuses = new Set(items.map(i => i.status))
    // 貸与中→返却→消毒→メンテ→入庫 を試せるよう、途中の状態の個体も置く
    for (const s of ['available', 'rented', 'returned', 'cleaning', 'maintenance']) {
      expect(statuses).toContain(s)
    }
  })

  it('承認待ちと承認済みの発注が用意されている', async () => {
    const orders = await mockDb.getOrders()
    expect(orders.some(o => o.status === 'pending')).toBe(true)
    expect(orders.some(o => o.status === 'approved')).toBe(true)
  })
})

describe('個体の取得と保存', () => {
  it('IDで1件引ける', async () => {
    const item = await mockDb.getProductItemById('WC-001')
    expect(item?.id).toBe('WC-001')
  })

  it('存在しないIDなら null', async () => {
    expect(await mockDb.getProductItemById('NOPE-999')).toBeNull()
  })

  it('保存すると次の取得に反映される（既存は上書き、新規は追加）', async () => {
    const item = await mockDb.getProductItemById('WC-001')
    await mockDb.saveProductItem({ ...item!, status: 'rented', customer_name: '山田様' })

    const after = await mockDb.getProductItemById('WC-001')
    expect(after?.status).toBe('rented')
    expect(after?.customer_name).toBe('山田様')

    const before = (await mockDb.getProductItems()).length
    await mockDb.saveProductItem({
      id: 'WC-999', product_id: 'PRD-1', status: 'available',
      condition: 'good', location: '倉庫', qr_code: 'WC-999',
    })
    expect((await mockDb.getProductItems()).length).toBe(before + 1)
  })
})

describe('履歴', () => {
  it('作成した履歴を読み出せる（新しい順）', async () => {
    await mockDb.createItemHistory('WC-001', '返却', 'rented', 'returned', 'テスト太郎', {
      notes: '玄関先で受け取り',
    })
    await mockDb.createItemHistory('WC-001', '消毒完了', 'returned', 'cleaning', 'テスト太郎')

    const all = await mockDb.getItemHistoriesByItemId('WC-001')
    expect(all).toHaveLength(2)
    expect(all[0].action).toBe('消毒完了') // 新しい順
    expect(all[1].notes).toBe('玄関先で受け取り')
  })

  it('別の個体の履歴は混ざらない', async () => {
    await mockDb.createItemHistory('WC-001', '返却', 'rented', 'returned', 'テスト')
    await mockDb.createItemHistory('BD-001', '返却', 'rented', 'returned', 'テスト')
    expect(await mockDb.getItemHistoriesByItemId('WC-001')).toHaveLength(1)
  })

  it('削除できる（以前は存在しないキーを見て必ず落ちていた）', async () => {
    await mockDb.createItemHistory('WC-001', '返却', 'rented', 'returned', 'テスト')
    const [h] = await mockDb.getItemHistoriesByItemId('WC-001')

    await expect(mockDb.deleteItemHistory(h.id)).resolves.toBeUndefined()
    expect(await mockDb.getItemHistoriesByItemId('WC-001')).toHaveLength(0)
  })

  it('ページングで取れる（総件数つき）', async () => {
    for (let i = 0; i < 5; i++) {
      await mockDb.createItemHistory('WC-001', `操作${i}`, 'available', 'available', 'テスト')
    }
    // 戻り値の形は本番側（supabase-database.ts）に合わせている
    const page = await mockDb.getItemHistoriesPaginated(1, 2)
    expect(page.data).toHaveLength(2)
    expect(page.totalCount).toBeGreaterThanOrEqual(5)
    expect(page.currentPage).toBe(1)
    expect(page.totalPages).toBeGreaterThanOrEqual(3)
  })
})

describe('ラベル印刷キュー', () => {
  it('追加すると pending として一覧に出る', async () => {
    await mockDb.addLabelPrintQueue({
      item_id: 'WC-001', product_name: '標準車椅子', management_id: 'WC-001',
      condition_notes: '', status: 'pending', created_by: 'テスト',
    })
    const pending = await mockDb.getLabelPrintQueueByStatus('pending')
    expect(pending).toHaveLength(1)
    expect(pending[0].management_id).toBe('WC-001')
  })

  it('状態を更新できる', async () => {
    await mockDb.addLabelPrintQueue({
      item_id: 'WC-001', product_name: '標準車椅子', management_id: 'WC-001',
      condition_notes: '', status: 'pending', created_by: 'テスト',
    })
    const [row] = await mockDb.getLabelPrintQueueByStatus('pending')
    await mockDb.updateLabelPrintQueueStatus(row.id, 'completed', 'テスト太郎')

    expect(await mockDb.getLabelPrintQueueByStatus('pending')).toHaveLength(0)
    const done = await mockDb.getLabelPrintQueueByStatus('completed')
    expect(done[0].printed_by).toBe('テスト太郎')
  })
})

describe('発注', () => {
  it('IDで1件引ける', async () => {
    const orders = await mockDb.getOrders()
    const found = await mockDb.getOrderById(orders[0].id)
    expect(found?.id).toBe(orders[0].id)
  })

  it('保存すると反映される', async () => {
    const orders = await mockDb.getOrders()
    const target = orders.find(o => o.status === 'pending')!
    await mockDb.saveOrder({ ...target, status: 'approved', approved_by: 'テスト太郎' })

    const after = await mockDb.getOrderById(target.id)
    expect(after?.status).toBe('approved')
    expect(after?.approved_by).toBe('テスト太郎')
  })
})
