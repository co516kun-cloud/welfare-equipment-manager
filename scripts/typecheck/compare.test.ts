/**
 * 型エラーのベースライン比較のテスト
 *
 * 背景（2026-09-07）:
 *  `npm run type-check` は `tsc --noEmit` で、ルートの tsconfig.json が
 *  `"files": []` + references のみ（ソリューション形式）のため **1ファイルも検査せず必ず成功**していた。
 *  そのせいで「存在しないモジュールの import」「未定義変数」が本番まで残っていた。
 *
 *  実際に検査すると 100件超のエラーが出る。全部直すのは別作業なので、
 *  「今あるエラーは許すが、新しいエラーは止める」ゲートにする。
 *  件数だけの比較だと「1件直して1件増やす」を見逃すので、エラーの identity で比較する。
 */
import { describe, it, expect } from 'vitest'
import { parseTscOutput, diffAgainstBaseline, formatKey } from './compare'

const OUT = `
src/pages/search.tsx(126,19): error TS2339: Property 'assigned_to' does not exist on type 'ProductItem'.
src/lib/mock-database.ts(18,5): error TS2322: Type 'string' is not assignable.
Found 2 errors in 2 files.
`.trim()

describe('parseTscOutput', () => {
  it('tsc の出力からファイル・行・コードを取り出す', () => {
    const errs = parseTscOutput(OUT)
    expect(errs).toHaveLength(2)
    expect(errs[0]).toMatchObject({ file: 'src/pages/search.tsx', line: 126, code: 'TS2339' })
    expect(errs[1]).toMatchObject({ file: 'src/lib/mock-database.ts', line: 18, code: 'TS2322' })
  })

  it('サマリ行や空行は拾わない', () => {
    expect(parseTscOutput('Found 2 errors in 2 files.\n\n')).toEqual([])
  })

  it('エラーが無ければ空', () => {
    expect(parseTscOutput('')).toEqual([])
  })
})

describe('formatKey', () => {
  it('行番号は identity に含めない（無関係な行ずれで誤検知しないため）', () => {
    const a = formatKey({ file: 'src/a.ts', line: 10, code: 'TS2339', message: 'x' })
    const b = formatKey({ file: 'src/a.ts', line: 99, code: 'TS2339', message: 'x' })
    expect(a).toBe(b)
  })

  it('ファイルかコードかメッセージが違えば別物', () => {
    const base = { file: 'src/a.ts', line: 1, code: 'TS2339', message: 'x' }
    expect(formatKey(base)).not.toBe(formatKey({ ...base, file: 'src/b.ts' }))
    expect(formatKey(base)).not.toBe(formatKey({ ...base, code: 'TS2322' }))
    expect(formatKey(base)).not.toBe(formatKey({ ...base, message: 'y' }))
  })
})

describe('diffAgainstBaseline', () => {
  const baseline = [
    'src/a.ts|TS2339|Property x does not exist',
    'src/b.ts|TS2322|Type mismatch',
  ]

  it('ベースラインどおりなら合格', () => {
    const r = diffAgainstBaseline(baseline, baseline)
    expect(r.ok).toBe(true)
    expect(r.added).toEqual([])
  })

  it('新しいエラーが増えたら不合格で、増えた分だけを返す', () => {
    const r = diffAgainstBaseline([...baseline, 'src/c.ts|TS7006|Implicit any'], baseline)
    expect(r.ok).toBe(false)
    expect(r.added).toEqual(['src/c.ts|TS7006|Implicit any'])
  })

  it('エラーが減ったら合格。減った分を報告する（ベースライン更新の材料）', () => {
    const r = diffAgainstBaseline([baseline[0]], baseline)
    expect(r.ok).toBe(true)
    expect(r.fixed).toEqual(['src/b.ts|TS2322|Type mismatch'])
  })

  it('同じエラーが複数あってもよい（件数の増減も見る）', () => {
    const dup = ['src/a.ts|TS2339|Property x does not exist']
    const r = diffAgainstBaseline([...dup, ...dup], dup)
    expect(r.ok).toBe(false)
    expect(r.added).toEqual(dup)
  })
})
