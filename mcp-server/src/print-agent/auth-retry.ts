/**
 * 印刷エージェントのログイン再試行（2026-09-08）
 *
 * 田口さんの見立て:
 *   「落ちているのは私がPCの電源を落としているか、外に持ち出して
 *     インターネットが切れているからじゃないですか？」
 *
 * そのとおりだった。signIn() が失敗したら process.exit(1) していたため、
 * ネットの無い場所で Windows を起動すると、その場でエージェントが終了していた。
 * Windows のタスクは「ログオン時」しか起動しないので、事務所に戻って
 * ネットが復帰しても、再ログオンするまで死んだままになる（実際に3日間気づかず止まっていた）。
 *
 * ここでは「ネットが無いだけ」と「認証情報が間違っている」を分ける。
 * 前者は待って何度でもやり直す。後者は人が直すしかないので止める。
 */

/** ログイン失敗のうち、待てば直る見込みがあるもの */
export function isRetryableAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true

  const e = error as { name?: unknown; status?: unknown; message?: unknown }

  // supabase-js が「再試行可能」と分類したもの
  if (e.name === 'AuthRetryableFetchError') return true

  // 認証情報そのものが違う場合は、何度やっても直らない
  if (typeof e.status === 'number') {
    if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 422) return false
    if (e.status >= 500 || e.status === 429 || e.status === 408) return true
  }

  const message = typeof e.message === 'string' ? e.message.toLowerCase() : ''
  const NETWORK_HINTS = [
    'fetch failed',
    'network',
    'enotfound',
    'econnrefused',
    'econnreset',
    'etimedout',
    'eai_again',
    'timed out',
    'timeout',
    'socket hang up',
    'offline',
  ]
  if (NETWORK_HINTS.some(hint => message.includes(hint))) return true

  // 判断がつかないものは粘る。起動しないより待つ方がまし
  return true
}

const MIN_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 300_000

/**
 * 何回目の失敗で何ミリ秒待つか。
 * 上限を5分にしているのは、事務所に戻ってきたら遅くとも5分で復帰してほしいから。
 */
export function backoffMs(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt))
  return Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** (n - 1))
}
