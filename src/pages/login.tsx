import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { login, signUp } from '../hooks/useAuth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // デバッグモード用の認証情報
  const debugCredentials = {
    email: 'claude.test@gmail.com',
    password: 'test123456'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // デバッグモード用の簡易認証
      const isDebugMode = import.meta.env.VITE_SUPABASE_URL?.includes('dummy')
      
      if (isDebugMode) {
        // デバッグモードでは固定の認証情報でログイン可能
        if (email === debugCredentials.email && password === debugCredentials.password) {
          // ローカルストレージにログイン状態を保存
          localStorage.setItem('auth_user', JSON.stringify({
            id: 'debug-user-1',
            email: debugCredentials.email,
            name: 'テストユーザー'
          }))
          // ページをリロードして認証状態を反映
          window.location.reload()
          return
        } else {
          throw new Error('デバッグモードでは claude.test@gmail.com / test123456 でログインしてください')
        }
      }
      
      // 通常のSupabase認証
      if (isSignUp) {
        await signUp(email, password, name)
        setError('サインアップが完了しました。メールを確認してください。')
      } else {
        await login(email, password)
        // ログイン成功時は、useAuthの状態変化によって自動的にメインアプリが表示される
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
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
            <h1 className="text-2xl font-bold text-foreground">福祉用具管理システム</h1>
            <p className="text-muted-foreground mt-2">
              {isSignUp ? 'アカウントを作成' : 'ログインしてください'}
            </p>
            {import.meta.env.VITE_SUPABASE_URL?.includes('dummy') && (
              <div className="mt-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                <p className="text-sm text-info font-medium">🔧 デバッグモード</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Email: {debugCredentials.email}<br/>
                  Password: {debugCredentials.password}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">お名前</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="田中太郎"
                  required={isSignUp}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? '処理中...' : isSignUp ? 'アカウント作成' : 'ログイン'}
            </Button>
            
            {import.meta.env.VITE_SUPABASE_URL?.includes('dummy') && !isSignUp && (
              <Button 
                type="button"
                variant="outline"
                className="w-full" 
                onClick={() => {
                  setEmail(debugCredentials.email)
                  setPassword(debugCredentials.password)
                }}
                disabled={loading}
              >
                🔧 デバッグ用認証情報を入力
              </Button>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp ? 'すでにアカウントをお持ちですか？ログイン' : 'アカウントをお持ちでない方はこちら'}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 福祉用具管理システム</p>
        </div>
      </div>
    </div>
  )
}