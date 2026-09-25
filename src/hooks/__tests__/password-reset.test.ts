/**
 * パスワード再設定（メールのリンクで本人が設定し直す）のテスト
 *
 * 背景（2026-09-25）: パスワードを忘れたスタッフが、管理者を待たずに自分で戻せるようにする。
 *  - requestPasswordReset: 再設定メールを送る（戻り先は /reset-password）
 *  - setNewPassword: リンクから入ったあと、新しいパスワードを設定する
 *  - useAuth: リンクから入ったことを isPasswordRecovery で知らせる
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))

import { requestPasswordReset, setNewPassword, useAuth } from '../useAuth'

function authError(code: string | undefined, message: string, status = 400, name = 'AuthApiError') {
  return Object.assign(new Error(message), { code, status, name })
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requestPasswordReset', () => {
  it('入力したアドレスに、/reset-password へ戻るリンクを送る', async () => {
    await requestPasswordReset('  staff@example.com ')

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('staff@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('空欄なら送らない', async () => {
    await expect(requestPasswordReset('   ')).rejects.toThrow(/メールアドレスを入力/)
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('続けて送ろうとして回数制限に当たったら、先に届いたメールを見るよう伝える', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('over_email_send_rate_limit', 'For security purposes, you can only request this after 45 seconds.', 429) })
    await expect(requestPasswordReset('staff@example.com')).rejects.toThrow(/先に届いたメール.*待って/)
  })

  it('メール送信の設定が済んでいないときは、管理者に知らせるよう伝える', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('email_address_not_authorized', 'Email address not authorized', 400) })
    await expect(requestPasswordReset('staff@example.com')).rejects.toThrow(/管理者/)
  })

  it('知らないエラーは「メールを送れませんでした」に元の文言を添える', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: authError('unexpected_failure', 'boom', 500) })
    await expect(requestPasswordReset('staff@example.com')).rejects.toThrow(/メールを送れませんでした.*boom/)
  })

  it('デバッグモード（dummy URL）では送らない', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy.supabase.co')
    await expect(requestPasswordReset('staff@example.com')).rejects.toThrow(/この環境では/)
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe('setNewPassword', () => {
  it('今のパスワードを聞かずに、新しいパスワードを設定する（メールのリンクで本人確認済み）', async () => {
    await setNewPassword('new-pass-123')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-pass-123' })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('前と同じパスワードなら、日本語で知らせる', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: authError('same_password', 'New password should be different from the old password.', 422) })
    await expect(setNewPassword('old-pass-1')).rejects.toThrow(/今と同じ/)
  })

  it('知らないエラーは「設定できませんでした」に元の文言を添える', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: authError('unexpected_failure', 'boom', 500) })
    await expect(setNewPassword('new-pass-123')).rejects.toThrow(/設定できませんでした.*boom/)
  })

  it('デバッグモード（dummy URL）では Supabase を呼ばない', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy.supabase.co')
    await expect(setNewPassword('new-pass-123')).rejects.toThrow(/この環境では/)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('useAuth の isPasswordRecovery', () => {
  it('ふだんは false', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isPasswordRecovery).toBe(false)
  })

  it('Supabase から PASSWORD_RECOVERY が届いたら true になる', async () => {
    let emit!: (event: string, session: unknown) => void
    auth.onAuthStateChange.mockImplementation((cb: typeof emit) => {
      emit = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => emit('PASSWORD_RECOVERY', { user: { id: 'u1', email: 'staff@example.com' } }))

    expect(result.current.isPasswordRecovery).toBe(true)
    expect(result.current.user).toMatchObject({ email: 'staff@example.com' })
  })
})
