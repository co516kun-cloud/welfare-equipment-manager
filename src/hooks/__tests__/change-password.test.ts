/**
 * パスワード変更（changePassword）のテスト
 *
 * 背景（2026-09-25）:
 *  スタッフが各自のパスワードを自分で変えられるようにする。
 *  Supabase の updateUser は「今のパスワード」を確かめずに書き換えてしまうので、
 *  先に signInWithPassword で本人確認し、通ったときだけ更新する。
 *  （auth-js 2.71 には current_password を一緒に送る口が無い）
 *
 *  ここで固定するのは次の3つ。
 *   - 本人確認に通らなければ更新を呼ばない
 *   - Supabase の英語エラーを、スタッフが読める日本語にして投げる
 *   - デバッグモード（dummy URL）では Supabase に触らない
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))

import { changePassword } from '../useAuth'

/** Supabase が返すエラーの形（AuthApiError 相当） */
function authError(code: string | undefined, message: string, status = 400, name = 'AuthApiError') {
  return Object.assign(new Error(message), { code, status, name })
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'staff@example.com' } } }, error: null })
  auth.signInWithPassword.mockResolvedValue({ data: { user: {}, session: {} }, error: null })
  auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('changePassword', () => {
  it('今のパスワードで本人確認してから、新しいパスワードに更新する', async () => {
    await changePassword('old-pass-1', 'new-pass-123')

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.com', password: 'old-pass-1' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-pass-123' })
    // 順番が逆だと「確かめる前に書き換える」ことになる
    expect(auth.signInWithPassword.mock.invocationCallOrder[0])
      .toBeLessThan(auth.updateUser.mock.invocationCallOrder[0])
  })

  it('今のパスワードが違うと、更新を呼ばない', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('invalid_credentials', 'Invalid login credentials'),
    })

    await expect(changePassword('wrong-pass', 'new-pass-123')).rejects.toThrow('現在のパスワードが違います')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('エラーコードが付いていなくても、文言で「今のパスワードが違う」と分かる', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError(undefined, 'Invalid login credentials'),
    })

    await expect(changePassword('wrong-pass', 'new-pass-123')).rejects.toThrow('現在のパスワードが違います')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('ログイン状態が読めないときは、本人確認も更新もしない', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    await expect(changePassword('old-pass-1', 'new-pass-123')).rejects.toThrow(/もう一度ログイン/)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('ログイン状態の読み込みが通信エラーで失敗したら、「期限切れ」ではなく通信の問題として知らせる', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: authError(undefined, 'Failed to fetch', 0, 'AuthRetryableFetchError'),
    })

    const err = await changePassword('old-pass-1', 'new-pass-123').catch((e: Error) => e)
    expect((err as Error).message).toMatch(/通信/)
    expect((err as Error).message).not.toMatch(/有効期限/)
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it.each([
    ['same_password', 'New password should be different from the old password.', /今と同じ/],
    ['weak_password', 'Password should be at least 6 characters.', /弱すぎ/],
    ['over_request_rate_limit', 'Request rate limit reached', /しばらく待って/],
    ['reauthentication_needed', 'Password update requires reauthentication.', /管理者/],
    ['session_not_found', 'Session from session_id claim in JWT does not exist', /もう一度ログイン/],
  ])('更新で %s が返ったら、日本語で知らせる', async (code, message, expected) => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: authError(code, message, 422) })

    await expect(changePassword('old-pass-1', 'new-pass-123')).rejects.toThrow(expected)
  })

  it('本人確認の段階で回数制限に当たったら、そのことを知らせる（「違います」とは言わない）', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('over_request_rate_limit', 'Request rate limit reached', 429),
    })

    const err = await changePassword('old-pass-1', 'new-pass-123').catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/しばらく待って/)
    expect((err as Error).message).not.toMatch(/違います/)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('知らないエラーは、元の文言を添えて返す（原因を追えるように）', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: authError('unexpected_failure', 'boom', 500) })

    await expect(changePassword('old-pass-1', 'new-pass-123')).rejects.toThrow(/パスワードを変更できませんでした.*boom/)
  })

  it('通信できないときは、そう知らせる', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError(undefined, 'Failed to fetch', 0, 'AuthRetryableFetchError'),
    })

    await expect(changePassword('old-pass-1', 'new-pass-123')).rejects.toThrow(/通信/)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('デバッグモード（dummy URL）では Supabase を呼ばない', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy.supabase.co')

    await expect(changePassword('old-pass-1', 'new-pass-123')).rejects.toThrow(/この環境では/)
    expect(auth.getSession).not.toHaveBeenCalled()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})
