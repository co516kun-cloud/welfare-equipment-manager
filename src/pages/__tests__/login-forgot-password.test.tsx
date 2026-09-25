/**
 * ログイン画面の「パスワードを忘れた場合」のテスト
 *
 * 背景（2026-09-25）: パスワードを忘れたスタッフが、ログイン画面で行き止まりになっていた。
 *  登録しているメールアドレスに再設定リンクを送り、本人が設定し直せるようにする。
 *  メールが届かないとき（設定前・迷惑メール扱いなど）の受け皿として、管理者への連絡も案内する。
 */
import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const requestPasswordReset = vi.hoisted(() => vi.fn())
const login = vi.hoisted(() => vi.fn())
const boot = vi.hoisted(() => ({ value: null as null | { kind: string; code?: string; description?: string } }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  login,
  requestPasswordReset,
}))
vi.mock('../../lib/auth-redirect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/auth-redirect')>()),
  getBootAuthRedirect: () => boot.value,
  // 本物と同じく、リンク切れの控えだけを消す
  clearBootLinkError: () => { if (boot.value?.kind === 'error') boot.value = null },
}))

import { Login } from '../login'

beforeEach(() => {
  requestPasswordReset.mockReset()
  login.mockReset()
  boot.value = null
})

function openResetForm() {
  fireEvent.click(screen.getByRole('button', { name: 'パスワードを忘れた場合' }))
}

describe('ログイン画面のパスワード再設定', () => {
  it('最初はログインフォームで、「パスワードを忘れた場合」の入口がある', () => {
    render(<Login />)
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'パスワードを忘れた場合' })).toBeInTheDocument()
  })

  it('入口を押すと、再設定メールを送るフォームになり、入力済みのメールアドレスを引き継ぐ', () => {
    render(<Login />)
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    openResetForm()

    expect(screen.getByRole('button', { name: '再設定メールを送る' })).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toHaveValue('staff@example.com')
    expect(screen.queryByRole('button', { name: 'ログイン' })).not.toBeInTheDocument()
  })

  it('送ると、メールを確認するよう伝える', async () => {
    requestPasswordReset.mockResolvedValue(undefined)
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/メールを送りました/))
    expect(requestPasswordReset).toHaveBeenCalledWith('staff@example.com')
  })

  it('送れなかったら理由を出す', async () => {
    requestPasswordReset.mockRejectedValue(new Error('しばらく待ってからやり直してください'))
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('しばらく待って')
  })

  it('処理中は送信ボタンを押せない（二重送信しない）', async () => {
    let resolve!: () => void
    requestPasswordReset.mockImplementation(() => new Promise<void>(r => { resolve = r }))
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))

    const button = await screen.findByRole('button', { name: '送信中...' })
    expect(button).toBeDisabled()
    resolve()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/メールを送りました/))
  })

  it('メールが届かないときは管理者に連絡すればよいと分かる', () => {
    render(<Login />)
    openResetForm()
    expect(screen.getByText(/届かない.*管理者/)).toBeInTheDocument()
  })

  it('ログインフォームに戻れる', () => {
    render(<Login />)
    openResetForm()
    fireEvent.click(screen.getByRole('button', { name: 'ログインに戻る' }))
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('期限切れのリンクから来たときは、理由を出して、すぐ送り直せるようにする', () => {
    boot.value = { kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' }
    render(<Login />)

    expect(screen.getByRole('alert')).toHaveTextContent(/有効期限/)
    expect(screen.getByRole('button', { name: '再設定メールを送る' })).toBeInTheDocument()
  })

  it('リンク切れの案内は一度だけ（ログアウトしてログイン画面に戻ったときには出さない）', () => {
    boot.value = { kind: 'error', code: 'otp_expired', description: '' }
    const first = render(<Login />)
    expect(screen.getByRole('alert')).toHaveTextContent(/有効期限/)
    first.unmount()

    render(<Login />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('開発時の StrictMode（画面を二重に描く）でも、リンク切れの案内は消えない', () => {
    boot.value = { kind: 'error', code: 'otp_expired', description: '' }
    render(<StrictMode><Login /></StrictMode>)
    expect(screen.getByRole('alert')).toHaveTextContent(/有効期限/)
  })

  it('ログインの処理中は「パスワードを忘れた場合」に切り替えられない（結果が別の画面に出ないように）', async () => {
    login.mockImplementation(() => new Promise(() => {}))
    render(<Login />)
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'パスワードを忘れた場合' })).toBeDisabled())
  })

  it('送信中は「ログインに戻る」を押せない', async () => {
    requestPasswordReset.mockImplementation(() => new Promise(() => {}))
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'ログインに戻る' })).toBeDisabled())
  })

  it('送ったあとにもう一度押して回数制限に当たっても、「送りました」の表示は残す', async () => {
    requestPasswordReset.mockResolvedValueOnce(undefined)
    requestPasswordReset.mockRejectedValueOnce(new Error('少し前に再設定メールを送っています。先に届いたメールを確認してください'))
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/メールを送りました/))

    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('先に届いたメール')
    expect(screen.getByRole('status')).toHaveTextContent(/メールを送りました/)
  })

  it('「送りました」の案内で、複数届いたら新しいメールのリンクを開くよう伝える', async () => {
    requestPasswordReset.mockResolvedValue(undefined)
    render(<Login />)
    openResetForm()
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '再設定メールを送る' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/新しいメール/))
  })

  describe('/reset-password のままログイン画面になったとき（リンクの確認に失敗・途中で読み込み直し）', () => {
    beforeEach(() => window.history.replaceState(null, '', '/reset-password'))
    afterEach(() => window.history.replaceState(null, '', '/'))

    it('送り直しのフォームを開き、何が起きたかを伝える', () => {
      render(<Login />)
      expect(screen.getByRole('button', { name: '再設定メールを送る' })).toBeInTheDocument()
      expect(screen.getByText(/再設定を続けられませんでした/)).toBeInTheDocument()
    })
  })
})
