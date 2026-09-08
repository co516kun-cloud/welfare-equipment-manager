import { describe, it, expect } from 'vitest'
import { isRetryableAuthError, backoffMs } from './auth-retry.js'

/**
 * 印刷エージェントがネットの無い所で起動しても死なないようにする判定
 *
 * 田口さんの見立て（2026-09-08）:
 *   「落ちているのは私がPCの電源を落としているか、外に持ち出して
 *     インターネットが切れているからじゃないですか？」
 *
 * そのとおりで、signIn() が失敗すると process.exit(1) していた。
 * Windows のタスクは「ログオン時」しか起動しないので、
 * 持ち出し先で起動 → 事務所に戻ってネットが復帰 しても、
 * 再ログオンするまでエージェントは死んだままだった。
 */

describe('isRetryableAuthError', () => {
  it('ネットにつながらないだけなら待って再試行する', () => {
    expect(isRetryableAuthError({ message: 'fetch failed' })).toBe(true)
    expect(isRetryableAuthError({ message: 'getaddrinfo ENOTFOUND xxx.supabase.co' })).toBe(true)
    expect(isRetryableAuthError({ message: 'connect ECONNREFUSED 127.0.0.1:443' })).toBe(true)
    expect(isRetryableAuthError({ message: 'network request timed out' })).toBe(true)
  })

  it('Supabase が再試行可能と言っているものは再試行する', () => {
    expect(isRetryableAuthError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe(true)
  })

  it('サーバ側の一時的な失敗は再試行する', () => {
    expect(isRetryableAuthError({ status: 503, message: 'Service Unavailable' })).toBe(true)
    expect(isRetryableAuthError({ status: 429, message: 'Too Many Requests' })).toBe(true)
    expect(isRetryableAuthError({ status: 500, message: 'Internal Server Error' })).toBe(true)
  })

  // ここは人が直すしかないので、黙って再試行し続けない
  it('メールアドレスやパスワードが違う場合は再試行しない', () => {
    expect(isRetryableAuthError({ status: 400, message: 'Invalid login credentials' })).toBe(false)
    expect(isRetryableAuthError({ status: 401, message: 'Unauthorized' })).toBe(false)
    expect(isRetryableAuthError({ status: 403, message: 'Forbidden' })).toBe(false)
  })

  it('判断がつかないものは再試行する（起動しないより粘る方がまし）', () => {
    expect(isRetryableAuthError({ message: 'なにか未知のエラー' })).toBe(true)
    expect(isRetryableAuthError({})).toBe(true)
  })
})

describe('backoffMs', () => {
  it('だんだん間隔を空ける', () => {
    expect(backoffMs(1)).toBeLessThan(backoffMs(2))
    expect(backoffMs(2)).toBeLessThan(backoffMs(3))
  })

  it('1回目でも最低5秒は待つ', () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(5_000)
  })

  // 事務所に戻ってきたら5分以内に自分で復帰してほしい
  it('どれだけ失敗しても5分を超えて待たない', () => {
    expect(backoffMs(99)).toBe(300_000)
    expect(backoffMs(1000)).toBe(300_000)
  })
})
