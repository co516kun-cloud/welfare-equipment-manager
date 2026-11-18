// 個体の完全消去（管理者限定）— DB 関数との受け渡しの形（2026-11-18）
//
// 消す処理そのものは Postgres 関数 erase_product_item（sql/add-erase-product-item.sql）。
// ここには、その関数が返す件数の形と、関数が投げるエラーコードを画面の日本語にする変換だけを置く。
// supabase-database.ts（本番は rpc、デモはモック）の両方がこの変換を通すので、画面は常に日本語を受け取る。
//
// ⚠️ このファイルに ItemStatus と同じ文字列リテラル（'rented' など）を書かないこと。
//    型チェックゲートがユニオンの表示順の変化を「新規エラー」と誤判定する（CLAUDE.md「罠」）。

/**
 * DB 関数が raise exception で返すコード。
 * 🔴 sql/add-erase-product-item.sql と mock-database.ts の 3 か所で完全一致させる。
 */
export const ERASE_ERROR = {
  NOT_ADMIN: 'ERASE_NOT_ADMIN',
  NOT_FOUND: 'ERASE_NOT_FOUND',
  IN_USE: 'ERASE_IN_USE',
  ASSIGNED: 'ERASE_ASSIGNED',
} as const

/** 消去で一緒に消えた行数。DB 関数の jsonb 戻り値と同じキー */
export type EraseResult = {
  histories: number
  label_queue: number
  preparation_tasks: number
}

const ERROR_MESSAGE: Record<(typeof ERASE_ERROR)[keyof typeof ERASE_ERROR], string> = {
  ERASE_NOT_ADMIN: '管理者だけが実行できます',
  ERASE_NOT_FOUND: 'この個体はすでに存在しません',
  ERASE_IN_USE: '貸与中・予約済み・配送準備完了の個体は消去できません。先に返却や取り消しを済ませてください',
  ERASE_ASSIGNED: '進行中の発注に割り当てられている個体は消去できません。先にその発注（明細）を取り消すか、配送を済ませてください',
}

const FUNCTION_MISSING_MESSAGE = '消去機能が DB 側にまだ入っていません。管理者に SQL の適用を確認してください'

/** rpc の jsonb を数値に揃える。欠けていれば 0（null や文字列の数字が来ても落とさない） */
export function toEraseResult(data: unknown): EraseResult {
  const row = (data ?? {}) as Record<string, unknown>
  const count = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return {
    histories: count(row.histories),
    label_queue: count(row.label_queue),
    preparation_tasks: count(row.preparation_tasks),
  }
}

/**
 * DB 関数・PostgREST・モックのエラーを、画面にそのまま出せる日本語にする。
 * 判定順: ① 4 つのコード ② 関数が無い（SQL 未適用）③ それ以外は元の文言を添える
 */
export function toEraseErrorMessage(
  error: { message?: string; code?: string } | null | undefined
): string {
  const message = error?.message ?? ''
  for (const code of Object.values(ERASE_ERROR)) {
    if (message.includes(code)) return ERROR_MESSAGE[code]
  }
  // PostgREST はスキーマキャッシュに関数が無いと PGRST202、Postgres 自体に無いと 42883
  if (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    /Could not find the function|does not exist/.test(message)
  ) {
    return FUNCTION_MISSING_MESSAGE
  }
  return `消去に失敗しました（${message || '原因不明のエラー'}）`
}
