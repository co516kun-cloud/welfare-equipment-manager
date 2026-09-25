/**
 * パスワード変更画面（/account）のテスト
 *
 * 背景（2026-09-25）: スタッフが各自のパスワードを自分で変えられるようにする。
 *  画面の役目は「入力の食い違いを送る前に止める」ことと
 *  「結果（成功・失敗の理由）をはっきり見せる」こと。
 *  本人確認と更新そのものは changePassword（useAuth.ts）の役目なので、ここではモックする。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const changePassword = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'staff@example.com', user_metadata: {} }, loading: false }),
  changePassword,
  logout: vi.fn(),
}))

import { Account } from '../account'

beforeEach(() => {
  changePassword.mockReset()
})

function renderAccount() {
  return render(<MemoryRouter><Account /></MemoryRouter>)
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: confirm } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /パスワードを変更する|変更中/ }))
}

describe('パスワード変更画面', () => {
  it('ログイン中のメールアドレスを出す（誰のパスワードを変えるのか分かるように）', () => {
    renderAccount()
    expect(screen.getByText('staff@example.com')).toBeInTheDocument()
  })

  it('パスワード欄は伏せ字で、ブラウザのパスワード管理が正しく働く autocomplete が付いている', () => {
    renderAccount()
    const current = screen.getByLabelText('現在のパスワード')
    const next = screen.getByLabelText('新しいパスワード')
    const confirm = screen.getByLabelText('新しいパスワード（確認）')

    for (const el of [current, next, confirm]) expect(el).toHaveAttribute('type', 'password')
    expect(current).toHaveAttribute('autocomplete', 'current-password')
    expect(next).toHaveAttribute('autocomplete', 'new-password')
    expect(confirm).toHaveAttribute('autocomplete', 'new-password')
  })

  it('今のパスワードが分からない人には、ログイン画面の「パスワードを忘れた場合」を案内する', () => {
    renderAccount()
    const current = screen.getByLabelText('現在のパスワード')
    const hintId = current.getAttribute('aria-describedby')
    expect(hintId).toBeTruthy()
    expect(document.getElementById(hintId!)).toHaveTextContent(/分からない.*パスワードを忘れた場合/)
  })

  it('確認用が一致しないときは送らない', () => {
    renderAccount()
    fill('old-pass-1', 'new-pass-123', 'new-pass-999')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('確認用のパスワードが一致しません')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('8文字未満は送らない', () => {
    renderAccount()
    fill('old-pass-1', 'short7c', 'short7c')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('8文字以上')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('ちょうど8文字なら送る（「8文字以上」の境界）', async () => {
    changePassword.mockResolvedValue(undefined)
    renderAccount()
    fill('old-pass-1', 'abcd1234', 'abcd1234')
    submit()

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('old-pass-1', 'abcd1234'))
  })

  it('結果を知らせる欄は最初から置いてある（あとから中身が入ると読み上げソフトが確実に読む）', () => {
    renderAccount()
    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(status).toBeEmptyDOMElement()
  })

  it('今と同じパスワードは送らない', () => {
    renderAccount()
    fill('same-pass-1', 'same-pass-1', 'same-pass-1')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('今と同じ')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('空欄があると送らない', () => {
    renderAccount()
    fill('', 'new-pass-123', 'new-pass-123')
    fireEvent.submit(screen.getByRole('button', { name: 'パスワードを変更する' }).closest('form')!)

    expect(screen.getByRole('alert')).toHaveTextContent('すべて入力')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('成功したら知らせて、入力欄を空にする', async () => {
    changePassword.mockResolvedValue(undefined)
    renderAccount()
    fill('old-pass-1', 'new-pass-123', 'new-pass-123')
    submit()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('パスワードを変更しました'))
    // サーバーはほかの端末のログインを切る。「そのまま使える」と誤解させない
    expect(screen.getByRole('status')).toHaveTextContent(/ほかの端末.*ログアウト/)
    expect(changePassword).toHaveBeenCalledWith('old-pass-1', 'new-pass-123')
    expect(screen.getByLabelText('現在のパスワード')).toHaveValue('')
    expect(screen.getByLabelText('新しいパスワード')).toHaveValue('')
    expect(screen.getByLabelText('新しいパスワード（確認）')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('失敗したら理由を出す（成功表示は出さない）', async () => {
    changePassword.mockRejectedValue(new Error('現在のパスワードが違います'))
    renderAccount()
    fill('wrong-pass', 'new-pass-123', 'new-pass-123')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('現在のパスワードが違います')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('処理中はボタンを押せない（二重送信しない）', async () => {
    let resolve!: () => void
    changePassword.mockImplementation(() => new Promise<void>(r => { resolve = r }))
    renderAccount()
    fill('old-pass-1', 'new-pass-123', 'new-pass-123')
    submit()

    const button = await screen.findByRole('button', { name: '変更中...' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(changePassword).toHaveBeenCalledTimes(1)

    resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: 'パスワードを変更する' })).toBeEnabled())
  })

  it('前回の成功表示は、次に送るときに消える', async () => {
    changePassword.mockResolvedValueOnce(undefined)
    renderAccount()
    fill('old-pass-1', 'new-pass-123', 'new-pass-123')
    submit()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('パスワードを変更しました'))

    fill('new-pass-123', 'x', 'x')
    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('8文字以上')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
