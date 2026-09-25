import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { setNewPassword } from '../hooks/useAuth'
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../lib/password-rules'

/**
 * 新しいパスワードの設定画面（2026-09-25 追加）
 *
 * パスワード再設定メールのリンクから入ったときだけ、App が普段の画面の代わりに出す。
 * メールのリンクで本人確認が済んでいるので、今のパスワードは聞かない。
 * 設定が済んだら onDone で普段の画面に戻す。
 */
interface ResetPasswordProps {
  email: string
  onDone: () => void
}

export function ResetPassword({ email, onDone }: ResetPasswordProps) {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || done) return
    setError('')

    const problem = checkNewPassword(next, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    try {
      await setNewPassword(next)
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードを設定できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-2xl">福</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">新しいパスワードの設定</h1>
            <p className="text-muted-foreground mt-2 [overflow-wrap:anywhere]">{email}</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {!done && (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">新しいパスワード</Label>
                <Input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  aria-describedby="reset-new-password-hint"
                  required
                />
                <p id="reset-new-password-hint" className="text-xs text-muted-foreground">
                  {PASSWORD_MIN_LENGTH}文字以上。英字と数字を混ぜると安全です
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">新しいパスワード（確認）</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? '設定中...' : 'パスワードを設定する'}
              </Button>
            </form>
          )}

          {/* 読み上げソフトが確実に読むよう、欄は常に置いておき中身だけ入れ替える。
              空のときに余白を作らないよう、間隔は表示時だけ付ける */}
          <div
            role="status"
            className={done ? 'text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3' : undefined}
          >
            {done && '新しいパスワードを設定しました。次からはこのパスワードでログインしてください。'}
          </div>

          {done && (
            <Button type="button" className="w-full mt-4" onClick={onDone}>
              アプリを使い始める
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
