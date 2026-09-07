/**
 * スキャン時にスクロール位置の復元で例外を投げないことのテスト
 *
 * 背景（2026-09-07・デモモードのE2Eで実証）:
 *  scan.tsx の handleScanResult 末尾に「スクロール位置を復元」という処理があるが、
 *  参照している scrollPosition がファイル内のどこにも定義されていなかった。
 *
 *  setTimeout の中なので同期的には落ちず、スキャンそのものは進む。
 *  しかし **スキャンのたびに ReferenceError が投げられ**、
 *  コメントが言う「スクロール位置の復元」は一度も行われていなかった。
 *  （2026-09-03 の全体読解で指摘していたが、E2E で実際に発火することを確認した）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout: vi.fn(),
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    getProductItemById: vi.fn(), saveProductItem: vi.fn(), createItemHistory: vi.fn(),
    getOrderById: vi.fn(), saveOrder: vi.fn(), addLabelPrintQueue: vi.fn(),
  },
}))

const item = {
  id: 'WC-003', product_id: 'PRD-1', status: 'rented', condition: 'good',
  location: '顧客先', qr_code: 'WC-003', customer_name: 'デモ利用者A',
}
const storeState = {
  loadData: vi.fn(), orders: [], users: [], items: [item],
  products: [{ id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair', description: '', manufacturer: '', model: '' }],
}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState }),
}))

import { Scan } from '../scan'

let unhandled: Error[] = []
const onError = (e: ErrorEvent) => unhandled.push(e.error ?? new Error(e.message))

beforeEach(() => {
  unhandled = []
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 })
  window.addEventListener('error', onError)
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})
afterEach(() => {
  window.removeEventListener('error', onError)
  vi.useRealTimers()
})

describe('スキャン時のスクロール位置', () => {
  it('スキャンしても ReferenceError を投げない', async () => {
    render(<MemoryRouter><Scan /></MemoryRouter>)

    const input = screen.getByPlaceholderText(/QRコードを入力/)
    fireEvent.change(input, { target: { value: 'WC-003' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

    await waitFor(() => expect(screen.getByRole('button', { name: '返却' })).toBeInTheDocument())

    // 復元は setTimeout(0) の中なので、タイマーを進めて実際に走らせる
    await vi.advanceTimersByTimeAsync(50)

    expect(unhandled.map(e => e.message)).toEqual([])
  })

  it('スキャン前のスクロール位置に戻す', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 420 })
    render(<MemoryRouter><Scan /></MemoryRouter>)

    const input = screen.getByPlaceholderText(/QRコードを入力/)
    fireEvent.change(input, { target: { value: 'WC-003' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

    await waitFor(() => expect(screen.getByRole('button', { name: '返却' })).toBeInTheDocument())
    await vi.advanceTimersByTimeAsync(50)

    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)
  })
})
