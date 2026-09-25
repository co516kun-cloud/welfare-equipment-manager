/**
 * 再設定メールのリンクから開いた直後の useAuth のテスト
 *
 * auth-js は PASSWORD_RECOVERY を setTimeout で送ってくるので、画面側の購読が
 * 間に合わないことがありうる。そのため起動時の URL（getBootAuthRedirect）も見て、
 * 最初の描画から isPasswordRecovery を true にする。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('../../lib/auth-redirect', () => ({
  getBootAuthRedirect: () => ({ kind: 'recovery' }),
}))

import { useAuth } from '../useAuth'

type Emit = (event: string, session: unknown) => void
let emit: Emit

beforeEach(() => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'staff@example.com' } } }, error: null })
  auth.onAuthStateChange.mockImplementation((cb: Emit) => {
    emit = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

describe('再設定リンクから開いた直後', () => {
  it('最初から isPasswordRecovery が true', async () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isPasswordRecovery).toBe(true)
    await waitFor(() => expect(result.current.user).toMatchObject({ email: 'staff@example.com' }))
    expect(result.current.isPasswordRecovery).toBe(true)
  })

  it('リンクからのログインに失敗したら（通信エラー・期限切れ）、再設定モードを解く。あとで普通にログインしても設定画面に閉じ込めない', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => emit('INITIAL_SESSION', null))
    expect(result.current.isPasswordRecovery).toBe(false)

    act(() => emit('SIGNED_IN', { user: { id: 'u1', email: 'staff@example.com' } }))
    expect(result.current.isPasswordRecovery).toBe(false)
  })

  it('ログアウトしたら再設定モードを解く', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).toBeTruthy())

    act(() => emit('SIGNED_OUT', null))
    expect(result.current.isPasswordRecovery).toBe(false)
  })

  it('リンクからのログインに成功したとき（INITIAL_SESSION にセッションあり）は再設定モードのまま', async () => {
    const { result } = renderHook(() => useAuth())
    act(() => emit('INITIAL_SESSION', { user: { id: 'u1', email: 'staff@example.com' } }))
    act(() => emit('TOKEN_REFRESHED', { user: { id: 'u1', email: 'staff@example.com' } }))
    expect(result.current.isPasswordRecovery).toBe(true)
  })
})
