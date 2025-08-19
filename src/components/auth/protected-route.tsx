import { useAuth } from '../../hooks/useAuth'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      // 認証されていない場合はログインページへリダイレクト
      window.location.href = '/login'
    }
  }, [user, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">認証情報を確認中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-destructive text-xl">🔒</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">認証が必要です</h2>
          <p className="text-muted-foreground">
            この機能をご利用いただくには、ログインが必要です。
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}