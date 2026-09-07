/**
 * 未定義パスの受け皿のテスト
 *
 * 背景（2026-09-07）:
 *  App.tsx に catch-all（path="*"）が無く、未定義のパスは Layout の枠だけ描画されて本文が空になる。
 *  この状態は元からあったが、/manual-import・/csv-import・/import を廃止したことで
 *  「ブックマークから開いたら白い画面」が実際に起きうるようになった。
 *
 *  消えたページを開いた人が迷子にならないよう、案内を出してトップへ戻せるようにする。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))

import { NotFound } from '../not-found'

describe('NotFound', () => {
  it('ページが無いことを日本語で伝える', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>)
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument()
  })

  it('廃止された取込ページを開いた場合は、現役の /data-import を案内する', () => {
    render(
      <MemoryRouter initialEntries={['/manual-import']}>
        <NotFound />
      </MemoryRouter>
    )
    expect(screen.getByText(/データ取込/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /データ取込/ })).toHaveAttribute('href', '/data-import')
  })

  it('関係ないパスでは取込の案内を出さない', () => {
    render(
      <MemoryRouter initialEntries={['/nonexistent']}>
        <NotFound />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /データ取込/ })).not.toBeInTheDocument()
  })

  it('トップへ戻る導線がある', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /トップ/ })).toHaveAttribute('href', '/')
  })
})
