/**
 * メールのリンクから戻ってきたときの URL の読み取り（parseAuthRedirect）のテスト
 *
 * 背景（2026-09-25）: パスワード再設定メールのリンクを開くと、Supabase は
 *  アプリの URL の # 以降に結果を付けて戻してくる。
 *   成功: #access_token=...&type=recovery...
 *   失敗: #error=access_denied&error_code=otp_expired&error_description=...
 *  auth-js は成功時にこの # を消してしまうので、アプリ側は起動直後に自分で読んでおく。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseAuthRedirect, describeLinkError } from '../auth-redirect'

describe('parseAuthRedirect', () => {
  it('再設定リンクから戻ってきたことが分かる', () => {
    expect(parseAuthRedirect('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery', ''))
      .toEqual({ kind: 'recovery' })
  })

  it('リンク切れ（使用済み・期限切れ）を読み取る', () => {
    expect(parseAuthRedirect('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', ''))
      .toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' })
  })

  it('エラーが # ではなく ? の側に付いてきても読み取る', () => {
    expect(parseAuthRedirect('', '?error=access_denied&error_code=otp_expired&error_description=expired'))
      .toMatchObject({ kind: 'error', code: 'otp_expired' })
  })

  it('ふつうに開いたときは何もしない', () => {
    expect(parseAuthRedirect('', '')).toBeNull()
    expect(parseAuthRedirect('#section-2', '?tab=1')).toBeNull()
  })

  it('再設定以外のリンク（招待など）は再設定扱いにしない', () => {
    expect(parseAuthRedirect('#access_token=abc&type=invite', '')).toBeNull()
  })

  it('access_token の無い type=recovery は再設定扱いにしない', () => {
    expect(parseAuthRedirect('#type=recovery', '')).toBeNull()
  })
})

describe('describeLinkError', () => {
  it('期限切れ・使用済みは、もう一度送ればよいと伝える', () => {
    expect(describeLinkError({ kind: 'error', code: 'otp_expired', description: '' }))
      .toMatch(/有効期限.*もう一度/)
    expect(describeLinkError({ kind: 'error', code: 'otp_expired', description: '' }))
      .toMatch(/いちばん新しいメール/)
  })

  it('知らないエラーは元の説明を添える', () => {
    expect(describeLinkError({ kind: 'error', code: 'something_else', description: 'boom' }))
      .toMatch(/boom/)
  })
})

describe('起動時の URL の控え', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    vi.resetModules()
  })

  it('リンク切れのエラーは clearBootLinkError で消える（あとでログアウトしたときに再表示しない）', async () => {
    window.history.replaceState(null, '', '/reset-password#error=access_denied&error_code=otp_expired&error_description=x')
    vi.resetModules()
    const m = await import('../auth-redirect')

    expect(m.getBootAuthRedirect()).toMatchObject({ kind: 'error', code: 'otp_expired' })
    m.clearBootLinkError()
    expect(m.getBootAuthRedirect()).toBeNull()
  })

  it('再設定リンク（recovery）の控えは clearBootLinkError では消えない', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=abc&type=recovery')
    vi.resetModules()
    const m = await import('../auth-redirect')

    m.clearBootLinkError()
    expect(m.getBootAuthRedirect()).toEqual({ kind: 'recovery' })
  })
})
