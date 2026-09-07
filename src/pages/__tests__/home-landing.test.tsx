/**
 * トップ（/）をPCとモバイルで出し分けるテスト
 *
 * 背景（2026-09-07 田口さん）:
 *  「PCで起動したときにマイページからではなく、全体のメニュー画面から始まるようにしてほしい。
 *    モバイル版は今のままでいい」
 *
 *  これまで App.tsx:122 の <Route index> は幅に関係なく MyPage を出していた。
 *  メニューへはヘッダーの「☰ メニュー」を押す必要があった。
 *
 *  モバイルは下部タブで移動する作りで、menu.tsx 自体もモバイルなら /mypage へ
 *  転送する実装になっている（menu.tsx:234-237）。だからモバイルは今のまま MyPage。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout: vi.fn(),
}))
const storeState = {
  orders: [] as unknown[], items: [] as unknown[], users: [] as unknown[],
  products: [] as unknown[], loadData: vi.fn(), isDataInitialized: true,
}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState }),
}))

import { Home } from '../home'

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: w })
}

beforeEach(() => setWidth(1440))

describe('トップ（/）の出し分け', () => {
  it('PC幅ではメニュー画面を出す', async () => {
    setWidth(1440)
    render(<MemoryRouter><Home /></MemoryRouter>)
    // メニュー画面にしか無いタイル
    await waitFor(() => expect(screen.getByRole('link', { name: /在庫一覧/ })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /QRスキャン/ })).toBeInTheDocument()
  })

  it('モバイル幅ではマイページを出す（今のまま）', async () => {
    setWidth(390)
    render(<MemoryRouter><Home /></MemoryRouter>)
    // マイページの見出し。メニューのタイルは出ない
    await waitFor(() => expect(screen.queryByRole('link', { name: /QRスキャン/ })).not.toBeInTheDocument())
  })

  it('境界（768px）はPC扱い', async () => {
    setWidth(768)
    render(<MemoryRouter><Home /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('link', { name: /在庫一覧/ })).toBeInTheDocument())
  })
})
