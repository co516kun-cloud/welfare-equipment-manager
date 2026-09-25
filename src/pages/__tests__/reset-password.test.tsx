/**
 * 新しいパスワードの設定画面（再設定メールのリンクから入ったとき）のテスト
 *
 * 背景（2026-09-25）: メールのリンクで本人確認が済んでいるので、今のパスワードは聞かない。
 *  設定が済んだら、そのままアプリを使い始められるようにする（onDone）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setNewPassword = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../hooks/useAuth', () => ({ setNewPassword }))

import { ResetPassword } from '../reset-password'

const onDone = vi.fn()

beforeEach(() => {
  setNewPassword.mockReset()
  onDone.mockReset()
})

function renderPage() {
  return render(<ResetPassword email="staff@example.com" onDone={onDone} />)
}

function fill(next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: confirm } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /パスワードを設定する|設定中/ }))
}

describe('新しいパスワードの設定画面', () => {
  it('誰のパスワードを設定するのか分かる。今のパスワードは聞かない', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '新しいパスワードの設定' })).toBeInTheDocument()
    expect(screen.getByText('staff@example.com')).toBeInTheDocument()
    expect(screen.queryByLabelText('現在のパスワード')).not.toBeInTheDocument()
    expect(screen.getByLabelText('新しいパスワード')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('確認用が一致しないときは送らない', () => {
    renderPage()
    fill('new-pass-123', 'new-pass-999')
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('確認用のパスワードが一致しません')
    expect(setNewPassword).not.toHaveBeenCalled()
  })

  it('8文字未満は送らない', () => {
    renderPage()
    fill('short7c', 'short7c')
    submit()
    expect(screen.getByRole('alert')).toHaveTextContent('8文字以上')
    expect(setNewPassword).not.toHaveBeenCalled()
  })

  it('設定できたら知らせて、「アプリを使い始める」でアプリに入れる', async () => {
    setNewPassword.mockResolvedValue(undefined)
    renderPage()
    fill('new-pass-123', 'new-pass-123')
    submit()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('新しいパスワードを設定しました'))
    expect(setNewPassword).toHaveBeenCalledWith('new-pass-123')
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'アプリを使い始める' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('失敗したら理由を出す', async () => {
    setNewPassword.mockRejectedValue(new Error('新しいパスワードが今と同じです。別のパスワードにしてください'))
    renderPage()
    fill('old-pass-12', 'old-pass-12')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('今と同じ')
    expect(screen.queryByRole('button', { name: 'アプリを使い始める' })).not.toBeInTheDocument()
  })

  it('処理中はボタンを押せない（二重送信しない）', async () => {
    let resolve!: () => void
    setNewPassword.mockImplementation(() => new Promise<void>(r => { resolve = r }))
    renderPage()
    fill('new-pass-123', 'new-pass-123')
    submit()

    const button = await screen.findByRole('button', { name: '設定中...' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(setNewPassword).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: 'アプリを使い始める' })).toBeInTheDocument())
  })
})
