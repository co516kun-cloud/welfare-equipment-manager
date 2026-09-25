import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { login, requestPasswordReset } from '../hooks/useAuth'
import { getBootAuthRedirect, describeLinkError, clearBootLinkError } from '../lib/auth-redirect'

/**
 * ログイン画面
 *
 * 2026-09-25: 「パスワードを忘れた場合」を追加。登録しているメールアドレスに
 * 再設定リンクを送り、本人が設定し直せるようにした（リンクの先は reset-password.tsx）。
 * 期限切れのリンクから戻ってきたときは、理由を出して送り直しのフォームを開く。
 */

const INTERRUPTED_NOTICE = '再設定を続けられませんでした（リンクを確認できなかったか、途中で画面が読み込み直されました）。お手数ですが、もう一度メールを送ってください。'

export function Login() {
  // 期限切れ・使用済みのリンクから戻ってきたときは、最初から送り直しのフォームにする
  const [linkError] = useState(() => {
    const boot = getBootAuthRedirect()
    return boot?.kind === 'error' ? describeLinkError(boot) : ''
  })
  // /reset-password のままここに来た ＝ リンクからのログインに失敗したか、設定の途中で
  // 読み込み直された（ログイン状態は保存しない設定なので、読み込み直すと消える）
  const [interrupted] = useState(
    () => !linkError && typeof window !== 'undefined' && window.location.pathname === '/reset-password'
  )
  const [mode, setMode] = useState<'login' | 'reset'>(linkError || interrupted ? 'reset' : 'login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(linkError)
  const [notice, setNotice] = useState(interrupted ? INTERRUPTED_NOTICE : '')
  const [resetSent, setResetSent] = useState(false)

  // リンク切れの案内は一度だけ。StrictMode の二重実行でも消えないよう、初期値ではなく描画後に消す
  useEffect(() => {
    clearBootLinkError()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      // ログイン成功時は、useAuthの状態変化によって自動的にメインアプリが表示される
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    setNotice('')
    // 「送りました」は消さない。続けて押して回数制限に当たっても、前のメールは届いているため

    try {
      await requestPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メールを送れませんでした')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: 'login' | 'reset') => {
    // 処理中に切り替えると、片方の結果（エラーなど）がもう片方の画面に出てしまう
    if (loading) return
    setMode(next)
    setError('')
    setNotice('')
    setResetSent(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-2xl">福</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">福祉用具管理システム</h1>
            <p className="text-muted-foreground mt-2">
              {mode === 'login' ? 'ログインしてください' : 'パスワードの再設定'}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {mode === 'login' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? '処理中...' : 'ログイン'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  disabled={loading}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                >
                  パスワードを忘れた場合
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleResetRequest} className="space-y-6" noValidate>
                {notice && (
                  <p className="text-sm text-foreground bg-muted border border-border rounded-lg p-3">{notice}</p>
                )}

                <p className="text-sm text-muted-foreground">
                  ログインに使っているメールアドレスを入力してください。パスワードを設定し直すためのリンクを送ります。
                </p>

                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                {error && (
                  <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '送信中...' : '再設定メールを送る'}
                </Button>
              </form>

              {/* 読み上げソフトが確実に読むよう、欄は常に置いておき中身だけ入れ替える。
                  空のときに余白を作らないよう、フォームの外に置いて表示時だけ mt を付ける */}
              <div
                role="status"
                className={resetSent ? 'mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3' : undefined}
              >
                {resetSent && 'メールを送りました。届いたメールのリンクを開いて、新しいパスワードを設定してください。リンクの有効期限は1時間です。何通か届いたときは、いちばん新しいメールのリンクを開いてください。'}
              </div>

              <div className="mt-6 border-t border-border pt-4 space-y-3 text-xs text-muted-foreground">
                <p>数分たってもメールが届かないときは、迷惑メールのフォルダを確認してください。それでも届かないときは、事業所の管理者に連絡してください。</p>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    disabled={loading}
                    className="text-sm underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                  >
                    ログインに戻る
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 福祉用具管理システム</p>
        </div>
      </div>
    </div>
  )
}
