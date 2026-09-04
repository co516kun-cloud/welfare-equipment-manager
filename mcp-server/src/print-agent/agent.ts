/**
 * 印刷エージェントの本体（キュー消化ループ）
 *
 * Supabase と PowerShell は AgentDeps として外から渡す。
 * ここには「どの順で・何を・どこまでやるか」だけを書く。
 */
import { queueUpdateForResult, type PrintResult, type QueueUpdate } from './core.js'

export type QueueRow = {
  id: string
  management_id: string
  product_name: string | null
  condition_notes: string | null
  status: string
}

export interface AgentDeps {
  /** pending を古い順に取る */
  listPending(limit: number): Promise<QueueRow[]>
  /**
   * 行を自分のものにする。UPDATE ... WHERE id=? AND status='pending' の形で、
   * 別プロセス（MCP や別の PC）が先に取っていたら false。
   */
  claim(id: string, by: string): Promise<boolean>
  applyUpdate(id: string, update: QueueUpdate): Promise<void>
  print(row: QueueRow): Promise<PrintResult>
  now(): Date
  log(message: string): void
}

export interface AgentOptions {
  /** printed_by に入る名前 */
  by: string
  /** 1周で拾う上限（既定 20） */
  batch?: number
}

export function createAgent(deps: AgentDeps, opts: AgentOptions) {
  const batch = opts.batch ?? 20
  let running = false
  let requestedAgain = false

  /**
   * pending を全部処理する。戻り値は処理した件数。
   *
   * 実行中にもう一度呼ばれたら（Realtime と polling が重なる）、
   * 二重に走らせず「終わったらもう1周」に変換する。
   * そうしないと同じ行を2つのループが取り合う。
   */
  async function drain(): Promise<number> {
    if (running) {
      requestedAgain = true
      return 0
    }
    running = true
    let processed = 0
    try {
      do {
        requestedAgain = false
        const rows = await deps.listPending(batch)
        for (const row of rows) {
          const mine = await deps.claim(row.id, opts.by)
          if (!mine) {
            deps.log(`skip ${row.management_id}: 別のプロセスが先に取った`)
            continue
          }
          const res = await deps.print(row)
          const update = queueUpdateForResult(res, { by: opts.by, now: deps.now() })
          await deps.applyUpdate(row.id, update)
          deps.log(`${row.management_id}: ${update.status}${update.error_message ? ' — ' + update.error_message : ''}`)
          processed++
        }
      } while (requestedAgain)
    } finally {
      running = false
    }
    return processed
  }

  return { drain }
}
