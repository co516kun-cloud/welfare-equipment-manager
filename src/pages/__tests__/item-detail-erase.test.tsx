/**
 * 個体詳細の「管理者操作」（完全消去）のテスト
 *
 * 背景（2026-11-18・田口さん依頼）: 登録ミス・重複の個体を、管理者（田口さんだけ）が個体詳細から
 *  履歴・印刷キューごと DB から消せるようにする。画面の役目は
 *   - 管理者にだけ枠を出す（他スタッフには存在すら見せない）
 *   - 消せないステータスではボタンを非活性にして理由を出す
 *   - 管理番号を打ち込ませてから実行し、失敗の理由はダイアログの中に出す
 *   - 貸与の記録があれば赤字で警告する（止めはしない）
 *  消す処理そのものは supabaseDb.eraseProductItem（→ DB 関数）なのでここではモックする。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ProductItem, ItemHistory } from '../../types'

const authUser = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
const goBack = vi.hoisted(() => vi.fn())
const db = vi.hoisted(() => ({
  getProductItemById: vi.fn(),
  getProductById: vi.fn(),
  getItemHistoriesByItemId: vi.fn(),
  getOrders: vi.fn(async () => []),
  eraseProductItem: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: authUser.current, loading: false, isPasswordRecovery: false }) }))
vi.mock('../../hooks/useGoBack', () => ({ useGoBack: () => goBack }))
vi.mock('../../lib/supabase-database', () => ({ supabaseDb: db }))

import { ItemDetail } from '../item-detail'
import { useInventoryStore } from '../../stores/useInventoryStore'

const baseItem: ProductItem = { id: 'WC-001', product_id: 'PRD-1', status: 'available', condition: 'good', location: '倉庫A', qr_code: 'WC-001' }
const history = (from: ItemHistory['from_status'], to: ItemHistory['to_status']): ItemHistory =>
  ({ id: `${from}-${to}`, item_id: 'WC-001', action: 'x', from_status: from, to_status: to, timestamp: '2026-11-01T00:00:00Z', performed_by: '田中' } as ItemHistory)

function setup(item: Partial<ProductItem> = {}, histories: ItemHistory[] = [], role?: 'admin') {
  authUser.current = { email: 'x@example.com', user_metadata: {}, ...(role ? { app_metadata: { role } } : {}) }
  db.getProductItemById.mockResolvedValue({ ...baseItem, ...item })
  db.getProductById.mockResolvedValue({ id: 'PRD-1', name: 'デモ車いす', category_id: 'wheelchair' })
  db.getItemHistoriesByItemId.mockResolvedValue(histories)
  useInventoryStore.setState({ items: [{ ...baseItem, ...item }], users: [] })
  render(
    <MemoryRouter initialEntries={['/item/WC-001']}>
      <Routes><Route path="item/:itemId" element={<ItemDetail />} /></Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('個体詳細の管理者操作（完全消去）', () => {
  it('管理者でなければ枠そのものが出ない', async () => {
    setup()
    await screen.findAllByText('WC-001')
    expect(screen.queryByText('管理者操作')).toBeNull()
  })

  it('管理者なら枠とボタンが出る', async () => {
    setup({}, [], 'admin')
    expect(await screen.findByRole('button', { name: 'この個体を完全に消去' })).toBeEnabled()
  })

  it('貸与中はボタンが非活性で理由が出る', async () => {
    setup({ status: 'rented' }, [], 'admin')
    expect(await screen.findByRole('button', { name: 'この個体を完全に消去' })).toBeDisabled()
    expect(screen.getByText(/貸与中のため消去できません/)).toBeInTheDocument()
  })

  it('空白を除いて一致すれば実行でき、成功したらストアから消えて元の画面へ戻る', async () => {
    db.eraseProductItem.mockResolvedValue({ histories: 2, label_queue: 0, preparation_tasks: 0 })
    setup({}, [history('unknown', 'available'), history('available', 'cleaning')], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    expect(screen.getByText('本当に完全消去しますか？')).toBeInTheDocument()
    expect(screen.getByText(/消える履歴 2 件/)).toBeInTheDocument()
    expect(screen.queryByText(/貸与の記録/)).toBeNull()

    const run = screen.getByRole('button', { name: '完全に消去する' })
    expect(run).toBeDisabled()
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: ' WC-001 ' } })
    expect(run).toBeEnabled()
    fireEvent.click(run)

    await waitFor(() => expect(db.eraseProductItem).toHaveBeenCalledWith('WC-001'))
    await waitFor(() => expect(goBack).toHaveBeenCalled())
    expect(useInventoryStore.getState().items.find(i => i.id === 'WC-001')).toBeUndefined()
    expect(window.alert).toHaveBeenCalledWith('WC-001 を消去しました（履歴 2 件）')
  })

  it('貸与の記録があれば赤字で警告するが、止めはしない', async () => {
    setup({}, [history('available', 'rented'), history('rented', 'returned'), history('returned', 'cleaning')], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    expect(screen.getByText(/貸与の記録が 2 件あります/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    expect(screen.getByRole('button', { name: '完全に消去する' })).toBeEnabled()
  })

  it('失敗したらダイアログ内に理由を出し、閉じない', async () => {
    db.eraseProductItem.mockRejectedValue(new Error('この個体はすでに存在しません'))
    setup({}, [], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    fireEvent.click(screen.getByRole('button', { name: '完全に消去する' }))
    expect(await screen.findByText('この個体はすでに存在しません')).toBeInTheDocument()
    expect(screen.getByText('本当に完全消去しますか？')).toBeInTheDocument()
    expect(goBack).not.toHaveBeenCalled()
  })

  it('消去中は二度押しできない', async () => {
    let resolve!: (v: unknown) => void
    db.eraseProductItem.mockReturnValue(new Promise(r => { resolve = r }))
    setup({}, [], 'admin')
    fireEvent.click(await screen.findByRole('button', { name: 'この個体を完全に消去' }))
    fireEvent.change(screen.getByLabelText('確認のため管理番号を入力'), { target: { value: 'WC-001' } })
    const run = screen.getByRole('button', { name: '完全に消去する' })
    fireEvent.click(run)
    fireEvent.click(screen.getByRole('button', { name: '消去中…' }))
    expect(db.eraseProductItem).toHaveBeenCalledTimes(1)
    resolve({ histories: 0, label_queue: 0, preparation_tasks: 0 })
    await waitFor(() => expect(goBack).toHaveBeenCalled())
  })
})
