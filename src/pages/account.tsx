import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth, changePassword } from '../hooks/useAuth'
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../lib/password-rules'

/**
 * パスワード変更画面（/account）
 *
 * 2026-09-25 追加。スタッフが各自で自分のパスワードを変える。
 * 本人確認（今のパスワード）と更新は changePassword（useAuth.ts）が行う。
 * この画面は、送る前に入力の食い違いを止めることと、結果をはっきり見せることが役目。
 */

/** 送る前のチェック。問題があれば、画面に出す文言を返す */
function validate(current: string, next: string, confirm: string): string | null {
  if (!current || !next || !confirm) return '3つの欄をすべて入力してください'
  const problem = checkNewPassword(next, confirm)
  if (problem) return problem
  if (next === current) return '新しいパスワードが今と同じです。別のパスワードにしてください'
  return null
}

export function Account() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError('')
    setDone(false)

    const problem = validate(current, next, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワードを変更できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-md mx-auto">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-foreground">パスワード変更</h1>
          <p className="text-sm text-muted-foreground mt-1">ログイン中のアカウント</p>
          {/* メールアドレスは1行に収め、収まらないときだけ折り返す（単語の途中で切れないように） */}
          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{user?.email}</p>
          {/* サーバーは変更と同時にほかの端末のログインを切る。入力中の作業が消えないよう先に知らせる */}
          <p className="text-xs text-muted-foreground mt-3">
            変更すると、ほかの端末（事務所のPC・ほかのスマホなど）はしばらくして自動でログアウトされます。入力中の作業があれば、先に保存してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              aria-describedby="current-password-hint"
              required
            />
            <p id="current-password-hint" className="text-xs text-muted-foreground">
              今のパスワードが分からないときは、ログイン画面の「パスワードを忘れた場合」から設定し直せます
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-describedby="new-password-hint"
              required
            />
            <p id="new-password-hint" className="text-xs text-muted-foreground">
              {PASSWORD_MIN_LENGTH}文字以上。英字と数字を混ぜると安全です
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
            <Input
              id="confirm-password"
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
            {saving ? '変更中...' : 'パスワードを変更する'}
          </Button>
        </form>

        {/* 読み上げソフトが確実に読むよう、欄は常に置いておき中身だけ入れ替える。
            空のときに余白を作らないよう、フォームの外に置いて表示時だけ mt を付ける */}
        <div
          role="status"
          className={done ? 'mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3' : undefined}
        >
          {done && 'パスワードを変更しました。ほかの端末はしばらくすると自動でログアウトされるので、新しいパスワードでログインし直してください。'}
        </div>
      </div>
    </div>
  )
}
