/**
 * 再設定メールのリンクから入ったときの App の振る舞いのテスト
 *
 * 背景（2026-09-25）: リンクを開くと Supabase はそのままログイン状態にする。
 *  何もしなければ、新しいパスワードを決めないまま普段の画面に入ってしまう。
 *  そこで再設定モードの間は「新しいパスワードの設定」画面だけを出し、
 *  約2000件の初期データ読み込みも始めない。設定が済んだら普段どおりに戻す。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLocation, Outlet } from 'react-router-dom'

const authState = vi.hoisted(() => ({
  value: { user: { id: 'u1', email: 'staff@example.com' } as unknown, loading: false, isPasswordRecovery: true },
}))
const store = vi.hoisted(() => ({
  loadInitialData: vi.fn(async () => {}),
  enableRealtimeSync: vi.fn(),
  disableRealtimeSync: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState.value,
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  setNewPassword: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../stores/useInventoryStore', () => ({
  useInventoryStore: () => store,
}))
// 画面の中身は重いので、今どこにいるかだけ出す（子の画面は Outlet で描く。本物の Layout と同じ）
vi.mock('../components/layout/layout', () => ({
  Layout: () => <><div data-testid="layout">{useLocation().pathname}</div><Outlet /></>,
}))
vi.mock('../pages/home', () => ({ Home: () => null }))
vi.mock('../pages/inventory', () => ({ Inventory: () => null }))
vi.mock('../pages/reset-password', () => ({
  ResetPassword: ({ email, onDone }: { email: string; onDone: () => void }) => (
    <div>
      <p>RESET for {email}</p>
      <button onClick={onDone}>done</button>
    </div>
  ),
}))

import App from '../App'

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  store.loadInitialData.mockClear()
  authState.value = { user: { id: 'u1', email: 'staff@example.com' }, loading: false, isPasswordRecovery: true }
  window.history.replaceState(null, '', '/reset-password')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('App（再設定リンクから入ったとき）', () => {
  it('新しいパスワードの設定画面だけを出し、初期データを読み込まない', () => {
    render(<App />)
    expect(screen.getByText('RESET for staff@example.com')).toBeInTheDocument()
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument()
    expect(store.loadInitialData).not.toHaveBeenCalled()
  })

  it('設定が済んだら普段の画面に戻り、トップ（/）へ移る', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    await waitFor(() => expect(screen.getByTestId('layout').textContent).toBe('/'))
    expect(store.loadInitialData).toHaveBeenCalledTimes(1)
  })

  it('ふだんのログインでは設定画面を出さない', async () => {
    authState.value = { ...authState.value, isPasswordRecovery: false }
    window.history.replaceState(null, '', '/inventory')
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('layout').textContent).toBe('/inventory'))
    expect(screen.queryByText(/RESET for/)).not.toBeInTheDocument()
    expect(store.loadInitialData).toHaveBeenCalledTimes(1)
  })
})
