/**
 * メニュー画面（PC版）下部の「ログアウト」ボタンのテスト
 *
 * 背景（2026-09-25）: このボタンには onClick が付いておらず、押しても何も起きなかった。
 *  パスワード変更の入口を足す作業中に見つけたので、ヘッダーのログアウトと同じ処理につなぐ。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const logout = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout,
}))
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: () => ({ orders: [], items: [], users: [], loadData: vi.fn() }),
}))

import { Menu } from '../menu'

beforeEach(() => {
  logout.mockReset()
  logout.mockResolvedValue(undefined)
  // PC 版を描画する（768px 未満だと /mypage へリダイレクトする）
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
})

describe('メニュー画面のログアウト', () => {
  it('押すとログアウトする', () => {
    render(<MemoryRouter><Menu /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('ログアウトに失敗しても画面は落ちない', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    logout.mockRejectedValue(new Error('network down'))
    render(<MemoryRouter><Menu /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /ログアウト/ }))
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /ログアウト/ })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
