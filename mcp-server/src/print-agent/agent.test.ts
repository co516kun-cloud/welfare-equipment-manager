/**
 * 印刷エージェントの drain（キュー消化）ループのテスト
 *
 * Supabase と PowerShell は依存注入で差し替える。ここで固定するのは:
 *   - pending を古い順に拾い、1件ずつ claim → 印刷 → 結果を書く
 *   - claim に負けた行（別プロセスが先に取った）は印刷しない
 *   - 1件失敗しても止まらず次へ進む
 *   - 同時に drain が2回呼ばれても二重処理しない（Realtime と polling が重なる）
 */
import { describe, it, expect, vi } from 'vitest'
import { createAgent, type AgentDeps, type QueueRow } from './agent.js'

function row(id: string): QueueRow {
  return { id, management_id: id, product_name: '車いす', condition_notes: null, status: 'pending' }
}

function makeDeps(over: Partial<AgentDeps> = {}): AgentDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    listPending: vi.fn(async () => []),
    claim: vi.fn(async (id: string) => { calls.push(`claim:${id}`); return true }),
    applyUpdate: vi.fn(async (id: string, u) => { calls.push(`update:${id}:${u.status}`) }),
    print: vi.fn(async (r: QueueRow) => { calls.push(`print:${r.id}`); return { ok: true, stage: 'printed' } }),
    now: () => new Date('2026-09-04T00:00:00Z'),
    log: () => {},
    ...over,
  }
}

describe('createAgent().drain', () => {
  it('pending を順に claim → 印刷 → completed に更新する', async () => {
    let first = true
    const deps = makeDeps({
      listPending: vi.fn(async () => { if (first) { first = false; return [row('A'), row('B')] } return [] }),
    })
    const agent = createAgent(deps, { by: 'print-agent' })

    const n = await agent.drain()

    expect(n).toBe(2)
    expect(deps.calls).toEqual([
      'claim:A', 'print:A', 'update:A:completed',
      'claim:B', 'print:B', 'update:B:completed',
    ])
  })

  it('claim に負けた行は印刷しない', async () => {
    let first = true
    const deps = makeDeps({
      listPending: vi.fn(async () => { if (first) { first = false; return [row('A'), row('B')] } return [] }),
      claim: vi.fn(async (id: string) => id === 'B'),
    })
    const agent = createAgent(deps, { by: 'print-agent' })

    await agent.drain()

    expect(deps.print).toHaveBeenCalledTimes(1)
    expect((deps.print as ReturnType<typeof vi.fn>).mock.calls[0][0].id).toBe('B')
  })

  it('1件が失敗しても failed を書いて次へ進む', async () => {
    let first = true
    const deps = makeDeps({
      listPending: vi.fn(async () => { if (first) { first = false; return [row('A'), row('B')] } return [] }),
      print: vi.fn(async (r: QueueRow) =>
        r.id === 'A' ? { ok: false, stage: 'spool', message: '止まっています' } : { ok: true, stage: 'printed' }),
    })
    const agent = createAgent(deps, { by: 'print-agent' })

    await agent.drain()

    const updates = (deps.applyUpdate as ReturnType<typeof vi.fn>).mock.calls.map(c => [c[0], c[1].status])
    expect(updates).toEqual([['A', 'failed'], ['B', 'completed']])
  })

  it('drain 実行中にもう一度呼ばれても二重処理せず、終わったらもう1周だけ見に行く', async () => {
    let listCount = 0
    let release!: () => void
    const gate = new Promise<void>(r => { release = r })
    const deps = makeDeps({
      listPending: vi.fn(async () => { listCount++; return listCount === 1 ? [row('A')] : [] }),
      print: vi.fn(async () => { await gate; return { ok: true, stage: 'printed' } }),
    })
    const agent = createAgent(deps, { by: 'print-agent' })

    const p1 = agent.drain()
    const p2 = agent.drain() // 1回目が印刷中に来た（Realtime と polling の重なり）
    release()
    const [n1, n2] = await Promise.all([p1, p2])

    expect(deps.print).toHaveBeenCalledTimes(1)
    expect(n1 + n2).toBe(1)
    // 2回目の要求は捨てずに「1回目が終わったらもう1周」に変換される
    expect(listCount).toBeGreaterThanOrEqual(2)
  })
})
