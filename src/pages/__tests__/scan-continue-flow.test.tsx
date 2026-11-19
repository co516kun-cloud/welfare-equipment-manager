/**
 * QRスキャン画面で、1 回のスキャンから工程を続けて進められることのテスト（2026-11-19・田口さん依頼）
 *
 * 背景: 入庫処理をしようとしたらまだ返却済みだった、のように前の工程を忘れていて複数の工程を
 *  続けて行いたいとき、今は 1 工程ごとにスキャンし直す必要がある。処理ダイアログの完了ビューから
 *  次の工程を押すと、同じダイアログがその工程のフォームになり、選択中の台のステータスも最新になる。
 *  設計書: docs/superpowers/specs/2026-11-19-scan-continue-design.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { getProductItemById } = vi.hoisted(() => ({ getProductItemById: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout: vi.fn(),
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    getProductItemById,
    saveProductItem: vi.fn(async () => undefined),
    createItemHistory: vi.fn(async () => undefined),
    getOrderById: vi.fn(),
    saveOrder: vi.fn(),
    addLabelPrintQueue: vi.fn(),
  },
}))

const returnedItem = {
  id: 'WC-004', product_id: 'PRD-1', status: 'returned', condition: 'good',
  location: '倉庫', qr_code: 'WC-004',
}
const storeState = {
  loadData: vi.fn(),
  orders: [] as unknown[],
  users: [] as unknown[],
  items: [returnedItem],
  products: [{ id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair', description: '', manufacturer: '', model: '' }],
}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState, setState: vi.fn() }),
}))

import { Scan } from '../scan'

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 })
  storeState.loadData.mockClear()
  getProductItemById.mockReset()
  // 1 回目は実行前の確認（同じステータス）、2 回目は成功後の取り直し（新しいステータス）
  getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce({ ...returnedItem, status: 'cleaning' })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

async function scanAndClean() {
  render(<MemoryRouter><Scan /></MemoryRouter>)
  const input = screen.getByPlaceholderText(/QRコードを入力/)
  fireEvent.change(input, { target: { value: 'WC-004' } })
  fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
  fireEvent.click(await screen.findByRole('button', { name: '消毒完了' }))
  fireEvent.click(await screen.findByRole('button', { name: '処理実行' }))
  await screen.findByText('処理が完了しました')
}

describe('QRスキャン画面: 続けて処理する', () => {
  it('消毒完了のあと、同じダイアログでメンテナンス完了のフォームに進める', async () => {
    await scanAndClean()
    // 個体カード（ダイアログの奥）も最新のステータスのボタンに変わるので、ダイアログの中だけで探す
    const dialog = within(document.querySelector('.scan-action-dialog') as HTMLElement)
    fireEvent.click(dialog.getByRole('button', { name: 'メンテナンス完了' }))
    expect(await screen.findByText('メンテナンス完了処理')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '処理実行' })).toHaveLength(1)
    expect(storeState.loadData).not.toHaveBeenCalled()
    // 個体カードのステータスも最新になっている
    expect(screen.getAllByText('消毒済み').length).toBeGreaterThanOrEqual(1)
  })

  it('「続けない」で閉じると店舗データの再読込が 1 回走る', async () => {
    await scanAndClean()
    fireEvent.click(screen.getByRole('button', { name: '続けない（次の台をスキャン）' }))
    await waitFor(() => expect(screen.queryByText('処理が完了しました')).toBeNull())
    expect(storeState.loadData).toHaveBeenCalledTimes(1)
  })
})
