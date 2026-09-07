/**
 * メニュー画面（PC版）のグリッドのテスト
 *
 * 背景（2026-09-07）:
 *  AI機能ページを廃止する（設計書 §9）。メニューからも導線を消す。
 *
 *  グリッドは 3行 × 3列 で、行ごとに違う色の帯に入っている。
 *  以前は同じ 35 行の JSX が 3 回コピペされ、それぞれ
 *  `menuItems.flatMap(...).filter(item => item.name !== 'AI機能').slice(0,3) / (3,6) / (6,9)`
 *  で切り出していた。AI機能を menuItems から消せば filter は不要になるので、
 *  同時に「3件ずつのまとまりに分けて map する」形へ整理する（見た目は変えない）。
 *
 *  ここで固定するのは「何が並ぶか」であって、色やクラス名ではない。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } }, loading: false }),
  logout: vi.fn(),
}))

const storeState = {
  orders: [] as unknown[],
  items: [] as unknown[],
  users: [] as unknown[],
  loadData: vi.fn(),
}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: () => storeState,
}))

import { Menu } from '../menu'

// PC 版を描画する（768px 未満だと /mypage へリダイレクトする）
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
})

function renderMenu() {
  return render(<MemoryRouter><Menu /></MemoryRouter>)
}

describe('メニュー画面のグリッド', () => {
  it('AI機能へのリンクが1つも無い', () => {
    renderMenu()
    const aiLinks = screen.queryAllByRole('link').filter(a => a.getAttribute('href') === '/ai-features')
    expect(aiLinks).toEqual([])
  })

  it('「AI機能」という項目名が出ない', () => {
    renderMenu()
    expect(screen.queryByText('AI機能')).not.toBeInTheDocument()
  })

  it('9つの業務メニューが並ぶ（3行×3列がちょうど埋まる）', () => {
    renderMenu()
    const expected = [
      'マイページ', '在庫一覧', 'QRスキャン',
      '発注管理', '承認', '準備商品',
      '履歴管理', 'デモ管理', '預かり物',
    ]
    for (const name of expected) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })

  it('グリッドの各項目が正しい行き先を持つ', () => {
    renderMenu()
    const hrefs: Record<string, string> = {
      'マイページ': '/mypage',
      '在庫一覧': '/inventory',
      'QRスキャン': '/scan',
      '発注管理': '/orders',
      '承認': '/approval',
      '準備商品': '/preparation',
      '履歴管理': '/history',
      'デモ管理': '/demo',
      '預かり物': '/deposits',
    }
    for (const [name, href] of Object.entries(hrefs)) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href)
    }
  })
})
