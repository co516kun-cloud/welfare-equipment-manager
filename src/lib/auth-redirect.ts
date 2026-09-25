/**
 * メールのリンクから戻ってきたときの URL を読む（2026-09-25 追加）
 *
 * パスワード再設定メールのリンクを開くと、Supabase はアプリの URL の # 以降に結果を付けて戻す。
 *   成功: #access_token=...&type=recovery...
 *   失敗: #error=access_denied&error_code=otp_expired&error_description=...
 *
 * auth-js は成功時にこの # を消してしまい、再設定だったことを知らせるイベント
 * （PASSWORD_RECOVERY）も setTimeout 越しに送ってくる。画面側の購読が間に合わないと
 * 再設定モードに入り損ねるので、起動直後に自分でも読んでおく。
 *
 * ⚠️ supabase.ts が createClient より先にこのファイルを import している。
 *    順番を入れ替えると、読む前に auth-js が # を消してしまう。
 */

export type AuthRedirect =
  | { kind: 'recovery' }
  | { kind: 'error'; code: string; description: string }

/** URL の # と ? から、再設定リンクの結果を取り出す。関係ない URL なら null */
export function parseAuthRedirect(hash: string, search: string): AuthRedirect | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''))
  const fromQuery = new URLSearchParams(search.replace(/^\?/, ''))

  for (const p of [fromHash, fromQuery]) {
    const code = p.get('error_code') || p.get('error')
    if (code || p.get('error_description')) {
      // ⚠️ ここを 'unknown' にすると、既存の ItemStatus 型エラーの表示順が変わり、
      //    npm run type-check のゲートが既存の4件を「新規」と誤判定する（2026-09-25 に踏んだ）
      return { kind: 'error', code: code || 'unspecified', description: p.get('error_description') || '' }
    }
  }

  if (fromHash.get('type') === 'recovery' && fromHash.get('access_token')) {
    return { kind: 'recovery' }
  }
  return null
}

/** リンクが使えなかった理由を、スタッフが読める日本語にする */
export function describeLinkError(e: Extract<AuthRedirect, { kind: 'error' }>): string {
  if (e.code === 'otp_expired') {
    return 'メールのリンクの有効期限が切れているか、すでに使われています。もう一度メールを送ってください。（メールが何通か届いているときは、いちばん新しいメールのリンクを開いてください）'
  }
  return `メールのリンクを確認できませんでした（${e.description || e.code}）。もう一度メールを送ってください。`
}

let bootAuthRedirect: AuthRedirect | null =
  typeof window === 'undefined' ? null : parseAuthRedirect(window.location.hash, window.location.search)

/** 起動したときの URL から読んだ結果（auth-js が URL を書き換える前に読んだもの） */
export function getBootAuthRedirect(): AuthRedirect | null {
  return bootAuthRedirect
}

/**
 * リンク切れの控えを消す。ログイン画面が一度見せたら呼ぶ。
 * 消さないと、同じタブであとでログアウトしたときにも「期限切れ」の案内がまた出る
 * （本番のログアウトはページを読み込み直さないので、控えが残り続ける）。
 * 再設定モード（recovery）の控えは useAuth が使うので残す。
 */
export function clearBootLinkError(): void {
  if (bootAuthRedirect?.kind === 'error') bootAuthRedirect = null
}
