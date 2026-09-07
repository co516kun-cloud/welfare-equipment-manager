/**
 * QRスキャン画面で操作ダイアログが二重に描画されていないことのテスト
 *
 * 背景（2026-09-07・デモモードのE2Eで発見）:
 *  デスクトップ版で ScanActionDialog が2箇所から描画されていた
 *  （scan.tsx:465 の DesktopScanUI 内と、scan.tsx:506 のトップレベル）。
 *
 *  ダイアログは position:fixed / zIndex:999999 で同じ座標に重なるため、
 *  「処理実行」ボタンが完全に同じ位置に2つ存在し、**奥側は前面のボタンに遮られて
 *  永久に押せない**状態になっていた。人が操作する分には手前が押せるので気づきにくいが、
 *  自動操作では奥を掴んでタイムアウトする。二重に onSuccess が走る危険もある。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    getProductItemById: vi.fn(),
    saveProductItem: vi.fn(),
    createItemHistory: vi.fn(),
    getOrderById: vi.fn(),
    saveOrder: vi.fn(),
    addLabelPrintQueue: vi.fn(),
  },
}))

const item = {
  id: 'WC-003', product_id: 'PRD-1', status: 'rented', condition: 'good',
  location: '顧客先', qr_code: 'WC-003', customer_name: 'デモ利用者A',
}
const storeState = {
  loadData: vi.fn(),
  orders: [] as unknown[],
  users: [] as unknown[],
  items: [item],
  products: [{ id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair', description: '', manufacturer: '', model: '' }],
}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState }),
}))

import { Scan } from '../scan'

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 })
})

describe('QRスキャン画面（デスクトップ）', () => {
  it('管理番号を入力して操作を選ぶと、ダイアログのボタンが1つだけになる', async () => {
    render(<MemoryRouter><Scan /></MemoryRouter>)

    const input = screen.getByPlaceholderText(/QRコードを入力/)
    fireEvent.change(input, { target: { value: 'WC-003' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

    const returnBtn = await screen.findByRole('button', { name: '返却' })
    fireEvent.click(returnBtn)

    // 二重描画だと同じボタンが2つ出る。1つであること
    const submits = await screen.findAllByRole('button', { name: '処理実行' })
    expect(submits).toHaveLength(1)

    const cancels = screen.getAllByRole('button', { name: 'キャンセル' })
    expect(cancels).toHaveLength(1)
  })
})
