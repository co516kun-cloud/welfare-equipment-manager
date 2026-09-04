/**
 * 印刷エージェントの判断部分（I/O なし）
 *
 * index.ts（Supabase・PowerShell を触る側）から呼ぶ。
 * ここに Supabase や child_process を import しないこと — テストが素で回せなくなる。
 */

export type PrintResult = {
  ok: boolean
  stage: string
  message?: string
  states?: string[]
  jobs?: number
}

export type QueueRowForPrint = {
  management_id: string
  product_name: string | null
  condition_notes: string | null
}

export type QueueUpdate = {
  status: 'completed' | 'printing' | 'failed'
  printed_at?: string
  printed_by?: string
  error_message?: string | null
}

/**
 * PowerShell の stdout から結果 JSON を取り出す。
 * BOM・WARNING 行・CRLF が混ざるので、最初の `{` から最後の `}` までを JSON と見なす
 * （mcp-server/src/index.ts の printOne と同じ扱い）。
 */
export function parsePrintOutput(stdout: string): PrintResult {
  const m = stdout.match(/\{[\s\S]*\}/)
  if (!m) {
    return { ok: false, stage: 'parse', message: `想定外の出力: ${stdout.slice(0, 200)}` }
  }
  try {
    return JSON.parse(m[0]) as PrintResult
  } catch (e) {
    return { ok: false, stage: 'parse', message: `JSON 解釈失敗: ${(e as Error).message}` }
  }
}

/**
 * 印刷結果 → label_print_queue の更新内容。
 *
 *   printed  → completed（出た）
 *   queued   → printing のまま（スプーラに渡したが出たか未確定。電源が入れば出る）
 *   それ以外 → failed
 *
 * "送った" と "出た" を分けるのは scripts/print-label.ps1 の設計と同じ。
 */
export function queueUpdateForResult(res: PrintResult, opts: { by: string; now: Date }): QueueUpdate {
  if (!res.ok) {
    return {
      status: 'failed',
      error_message: `${res.stage}: ${res.message ?? ''}`.slice(0, 500),
    }
  }
  if (res.stage === 'queued') {
    return { status: 'printing', printed_by: opts.by }
  }
  return {
    status: 'completed',
    printed_at: opts.now.toISOString(),
    printed_by: opts.by,
    error_message: null,
  }
}

/** powershell.exe に渡す引数配列。execFile に配列で渡すのでシェル展開はされない。 */
export function buildPrintArgs(scriptPath: string, row: QueueRowForPrint): string[] {
  return [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-ManagementId', row.management_id,
    '-ProductName', row.product_name ?? '',
    '-ConditionNotes', row.condition_notes ?? '',
  ]
}
