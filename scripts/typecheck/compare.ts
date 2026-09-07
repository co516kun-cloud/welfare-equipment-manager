/**
 * 型エラーのベースライン比較（I/O なし）
 *
 * 「今あるエラーは許すが、新しいエラーは止める」ためのロジック。
 * 実行は scripts/typecheck/gate.mjs から。
 */

export type TscError = {
  file: string
  line: number
  code: string
  message: string
}

/** `src/a.ts(12,3): error TS2339: Property 'x' does not exist.` を分解する */
const LINE_RE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*(.*)$/

export function parseTscOutput(stdout: string): TscError[] {
  const out: TscError[] = []
  for (const raw of stdout.split('\n')) {
    const m = LINE_RE.exec(raw.trim())
    if (!m) continue
    out.push({
      file: m[1].replace(/\\/g, '/'),
      line: Number(m[2]),
      code: m[4],
      message: m[5].trim(),
    })
  }
  return out
}

/**
 * エラーの identity。
 * 行番号は含めない — 上に1行足しただけで「新しいエラー」と誤検知してしまうため。
 * ファイル・エラーコード・メッセージが同じなら同じエラーとみなす。
 */
export function formatKey(e: TscError): string {
  return `${e.file}|${e.code}|${e.message}`
}

export type DiffResult = {
  ok: boolean
  /** ベースラインに無い（＝今回増えた）エラー */
  added: string[]
  /** ベースラインにあったが消えた（＝直った）エラー */
  fixed: string[]
}

/**
 * 現在のエラーキー列とベースラインを比べる。
 * 同じキーが複数あることもあるので、多重集合として扱う。
 */
export function diffAgainstBaseline(current: string[], baseline: string[]): DiffResult {
  const count = (keys: string[]) => {
    const m = new Map<string, number>()
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const cur = count(current)
  const base = count(baseline)

  const added: string[] = []
  for (const [k, n] of cur) {
    const extra = n - (base.get(k) ?? 0)
    for (let i = 0; i < extra; i++) added.push(k)
  }

  const fixed: string[] = []
  for (const [k, n] of base) {
    const gone = n - (cur.get(k) ?? 0)
    for (let i = 0; i < gone; i++) fixed.push(k)
  }

  return { ok: added.length === 0, added, fixed }
}
