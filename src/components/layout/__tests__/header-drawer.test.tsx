/**
 * モバイルヘッダーのドロワーメニューのテスト
 *
 * 背景（2026-09-07）: AI機能ページの廃止（設計書 §9）にともない、
 * ドロワーの項目と、その下に出る説明文の分岐からも「AI機能」を消す。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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

beforeEach(() => {
  // モバイル幅にしてドロワーを出す
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
})

describe('モバイルドロワー', () => {
  it('メニューを開いても AI機能 の項目が無い', () => {
    render(<MemoryRouter><Header /></MemoryRouter>)

    const menuButton = screen.getByRole('button', { name: /メニュー|☰/ })
    fireEvent.click(menuButton)

    expect(screen.queryByText('AI機能')).not.toBeInTheDocument()
    expect(screen.queryByText('AI支援ツール')).not.toBeInTheDocument()
  })

  it('残りの4項目は出る', () => {
    render(<MemoryRouter><Header /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /メニュー|☰/ }))

    for (const name of ['商品検索', '履歴管理', 'デモ管理', '預かり物']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })
})
