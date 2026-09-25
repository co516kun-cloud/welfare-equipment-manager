import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getBootAuthRedirect } from '../lib/auth-redirect'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  /**
   * パスワード再設定メールのリンクから入ってきたか（2026-09-25 追加）。
   * true の間、App は「新しいパスワードの設定」画面だけを出す。
   */
  isPasswordRecovery: boolean
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // auth-js のイベントより先に、起動時の URL で分かる（イベントの取りこぼし対策）
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => getBootAuthRedirect()?.kind === 'recovery'
  )

  useEffect(() => {
    // デバッグモードかチェック
    const isDebugMode = import.meta.env.VITE_SUPABASE_URL?.includes('dummy')
    
    if (isDebugMode) {
      // デバッグモードではローカルストレージから認証状態を取得
      const getDebugSession = () => {
        try {
          const debugUser = localStorage.getItem('auth_user')
          if (debugUser) {
            const userData = JSON.parse(debugUser)
            setUser(userData as User)
          } else {
            setUser(null)
          }
          setLoading(false)
        } catch (error) {
          console.error('Debug auth error:', error)
          setUser(null)
          setLoading(false)
        }
      }
      
      getDebugSession()
      return
    }
    
    // 現在の認証状態をチェック
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        setLoading(false)
      } catch (error) {
        console.error('Auth session error:', error)
        setUser(null)
        setLoading(false)
      }
    }

    getSession()

    // 認証状態の変化を監視
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setUser(session?.user ?? null)
          if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
          // リンクからのログインに失敗した（通信エラー・期限切れ）ときや、ログアウトしたときは解く。
          // 解かないと、あとで普通にログインしても設定画面に閉じ込められる。
          // 成功時の INITIAL_SESSION はセッション付きで届くので、ここには当たらない
          if ((event === 'INITIAL_SESSION' && !session) || event === 'SIGNED_OUT') setIsPasswordRecovery(false)
          setLoading(false)
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('Auth subscription error:', error)
      setLoading(false)
    }
  }, [])

  return { user, loading, isPasswordRecovery }
}

// ログイン機能
export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    console.error('Login error:', error)
    throw error
  }
  
  return data
}

// ログアウト機能
export const logout = async () => {
  const isDebugMode = import.meta.env.VITE_SUPABASE_URL?.includes('dummy')
  
  if (isDebugMode) {
    // デバッグモードではローカルストレージから認証情報を削除
    localStorage.removeItem('auth_user')
    window.location.reload()
    return
  }
  
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Logout error:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────
// パスワード変更（2026-09-25 追加）
//
// スタッフが各自で自分のパスワードを変えるための処理。
// Supabase の updateUser は「今のパスワード」を確かめずに書き換えるので、
// 席を離れたすきに他人が変えてしまえる。そこで先に signInWithPassword で
// 本人確認し、通ったときだけ更新する（auth-js 2.71 には current_password を
// 一緒に送る口が無い）。
//
// - 本人確認に失敗しても、今のログイン状態は消えない（auth-js は失敗時に
//   セッションを書き換えない）
// - この端末のログインは続く（本人確認の signIn で作った新しいセッションが残る）
// - ほかの端末のログインはサーバー側で切られる。GoTrue はパスワード更新時に
//   このセッション以外をすべて削除する（UpdatePassword → LogoutAllExceptMe）。
//   ほかの端末は次のトークン更新（最長で約1時間後）でログイン画面に戻る
// - この確認が効くのは画面から変えるときだけ。ログイン中の端末を触れる人が
//   トークンを抜き出して /auth/v1/user を直接呼べば、今のパスワード無しでも
//   変えられる（Supabase Auth の仕様で、アプリ側では塞げない）
// - ダッシュボードの「Secure password change」を ON にしても、この流れは動く。
//   サーバーが再認証を求めるのはセッションが24時間より古いときだけで、ここでは
//   直前の signIn で新しいセッションを作っているため（2026-09 時点の supabase/auth で確認）
// ─────────────────────────────────────────────────────────────

/** Supabase のエラーから、見分けに使う部分だけを取り出した形 */
type AuthErrorLike = { code?: string; status?: number; name?: string; message?: string }

const RELOGIN_MESSAGE = 'ログインの有効期限が切れました。いったんログアウトして、もう一度ログインしてください'

/** Supabase の英語エラーを、スタッフが読める日本語にする。知らないエラーは fallback に元の文言を添える */
function toJapaneseAuthMessage(error: AuthErrorLike, fallback = 'パスワードを変更できませんでした'): string {
  switch (error.code) {
    case 'over_email_send_rate_limit':
      return 'メールの送信回数の上限に達しました。しばらく待ってからやり直してください'
    case 'email_address_not_authorized':
      return 'メールを送れませんでした。メール送信の設定が済んでいない可能性があります。管理者に連絡してください'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'メールアドレスの形式が正しくありません'
    case 'same_password':
      return '新しいパスワードが今と同じです。別のパスワードにしてください'
    case 'weak_password':
      return 'パスワードが弱すぎます。もっと長くするか、英字と数字を混ぜてください'
    case 'over_request_rate_limit':
      return '試行回数が多すぎます。しばらく待ってからやり直してください'
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return 'この設定ではパスワードを変更できません。管理者に連絡してください（メールでの再認証が必要な設定になっています）'
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
      return RELOGIN_MESSAGE
  }
  if (error.name === 'AuthSessionMissingError') return RELOGIN_MESSAGE
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return '通信できませんでした。電波の良い場所でやり直してください'
  }
  return `${fallback}（${error.message || '原因不明のエラー'}）`
}

/** 本人確認（signInWithPassword）で「パスワードが違う」と言われたか */
function isWrongPassword(error: AuthErrorLike): boolean {
  if (error.code === 'invalid_credentials') return true
  // 古い GoTrue はコードを付けずに文言だけ返す
  return !error.code && /invalid login credentials/i.test(error.message ?? '')
}

/**
 * ログイン中の本人のパスワードを変える。
 * 失敗したときは、画面にそのまま出せる日本語の Error を投げる。
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('dummy')) {
    throw new Error('この環境ではパスワードを変更できません（デバッグモード）')
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    // 期限切れのトークンを更新しようとして通信に失敗した、など。「期限切れ」と決めつけない
    console.error('Password change (session) error:', sessionError)
    throw new Error(toJapaneseAuthMessage(sessionError))
  }
  const email = session?.user?.email
  if (!email) {
    throw new Error(RELOGIN_MESSAGE)
  }

  // 1. 今のパスワードで本人確認
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) {
    if (isWrongPassword(verifyError)) {
      throw new Error('現在のパスワードが違います')
    }
    console.error('Password change (verify) error:', verifyError)
    throw new Error(toJapaneseAuthMessage(verifyError))
  }

  // 2. 新しいパスワードに更新
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    console.error('Password change (update) error:', updateError)
    throw new Error(toJapaneseAuthMessage(updateError))
  }
}

// ─────────────────────────────────────────────────────────────
// パスワード再設定（忘れたとき。2026-09-25 追加）
//
// 1. ログイン画面で requestPasswordReset → Supabase が再設定リンクをメールで送る
// 2. リンクを開くと /reset-password に戻り、auth-js がそのままログイン状態にする
//    （このとき useAuth の isPasswordRecovery が true になる）
// 3. 「新しいパスワードの設定」画面で setNewPassword → 普段の画面へ
//
// 前提（Supabase ダッシュボード側。手順は docs/password-reset.md）
// - 独自のメール送信（SMTP）を設定していること。標準のメール送信は
//   プロジェクトのメンバー以外に届かず、1時間に2通まで
// - Redirect URLs に https://<本番>/reset-password が登録されていること
// ─────────────────────────────────────────────────────────────

/** 再設定リンクをメールで送る。アドレスが登録されていなくても Supabase は成功を返す */
export const requestPasswordReset = async (email: string): Promise<void> => {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('dummy')) {
    throw new Error('この環境ではメールを送れません（デバッグモード）')
  }
  const address = email.trim()
  if (!address) {
    throw new Error('メールアドレスを入力してください')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) {
    console.error('Password reset request error:', error)
    if (error.code === 'over_email_send_rate_limit') {
      // 同じ人への再送は約1分あける決まり。続けて押した人に「上限」とだけ言うと、
      // 前のメールまで届いていないと誤解される
      throw new Error('少し前に再設定メールを送っています。先に届いたメールを確認してください。届かないときは、1分ほど待ってから送り直してください')
    }
    throw new Error(toJapaneseAuthMessage(error, 'メールを送れませんでした'))
  }
}

/**
 * 再設定リンクから入ったあと、新しいパスワードを設定する。
 * メールのリンクで本人確認が済んでいるので、今のパスワードは聞かない。
 */
export const setNewPassword = async (newPassword: string): Promise<void> => {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('dummy')) {
    throw new Error('この環境ではパスワードを設定できません（デバッグモード）')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    console.error('Password recovery (update) error:', error)
    throw new Error(toJapaneseAuthMessage(error, 'パスワードを設定できませんでした'))
  }
}
