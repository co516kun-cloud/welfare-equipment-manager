/**
 * ヘッダーから「パスワード変更」（/account）へ行けることのテスト
 *
 * 背景（2026-09-25）: スタッフが各自のパスワードを変えられる画面を足した。
 *  画面があっても入口が無ければ誰も使えないので、入口を固定する。
 *   - PC: 右上のユーザー名を押すと /account
 *   - スマホ: ☰ のドロワーに「パスワード変更」
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout: vi.fn(),
}))
vi.mock('../../../lib/notification-generator', () => ({ generateNotifications: vi.fn() }))
vi.mock('../../../stores/useNotificationStore', () => ({
  useNotificationStore: () => ({ unreadCount: 0, notifications: [] }),
}))
vi.mock('../../../stores/useInventoryStore', () => ({
  useInventoryStore: () => ({ orders: [], items: [], users: [], forceSync: vi.fn() }),
}))
vi.mock('../../global-refresh-button', () => ({ GlobalRefreshButton: () => null }))

import { Header } from '../header'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderHeader(path = '/inventory') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
      <Where />
    </MemoryRouter>
  )
}

function setWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px })
}

describe('PC ヘッダー', () => {
  beforeEach(() => setWidth(1280))

  it('右上のユーザー名が /account へのリンクになっている', () => {
    renderHeader()
    const link = screen.getByRole('link', { name: /テスト太郎/ })
    expect(link).toHaveAttribute('href', '/account')
  })

  it('ログアウトボタンは今までどおり残っている', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  })
})

describe('スマホのドロワー', () => {
  beforeEach(() => setWidth(390))

  it('「パスワード変更」を押すと /account へ行き、ドロワーが閉じる', () => {
    renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /メニュー|☰/ }))
    fireEvent.click(screen.getByRole('button', { name: /パスワード変更/ }))

    // 部分一致だと '/account-settings' のような打ち間違いでも通ってしまう
    expect(screen.getByTestId('where').textContent).toBe('/account')
    expect(screen.queryByRole('button', { name: /パスワード変更/ })).not.toBeInTheDocument()
  })
})
