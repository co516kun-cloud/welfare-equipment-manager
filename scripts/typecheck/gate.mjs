#!/usr/bin/env node
/**
 * 型チェックのゲート
 *
 * 2026-09-07 まで `npm run type-check`（= tsc --noEmit）は **1ファイルも検査していなかった**。
 * ルートの tsconfig.json が `"files": []` + references のソリューション形式で、
 * -b を付けない tsc は参照先を見ずに即成功するため。
 * その結果「存在しないモジュールの import」「未定義変数の参照」が本番まで残った。
 *
 * 実際に検査すると 100件超のエラーが出る（strict:false でこの数）。
 * 全部直すのは別作業なので、ここでは
 *   「いま在るエラーは通す・新しく増えたエラーは止める」
 * というゲートにする。
 *
 *   npm run type-check          … このゲート（新規エラーがあれば exit 1）
 *   npm run type-check:all      … 生の tsc。今あるエラーを全部見たいとき
 *   npm run type-check:accept   … 直した結果をベースラインに反映する
 *
 * ベースラインは scripts/typecheck/baseline.txt（行番号を含まないので行ずれに強い）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const BASELINE = path.join(__dirname, 'baseline.txt')
const ACCEPT = process.argv.includes('--accept')

// compare.ts と同じロジック（.mjs から .ts は読めないので最小限を写す。
// 本体のテストは scripts/typecheck/compare.test.ts にある）
const LINE_RE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*(.*)$/

function parseTscOutput(stdout) {
  const out = []
  for (const raw of stdout.split('\n')) {
    const m = LINE_RE.exec(raw.trim())
    if (!m) continue
    out.push(`${m[1].replace(/\\/g, '/')}|${m[4]}|${m[5].trim()}`)
  }
  return out
}

function diff(current, baseline) {
  const count = keys => {
    const m = new Map()
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const cur = count(current)
  const base = count(baseline)
  const added = []
  for (const [k, n] of cur) for (let i = 0; i < n - (base.get(k) ?? 0); i++) added.push(k)
  const fixed = []
  for (const [k, n] of base) for (let i = 0; i < n - (cur.get(k) ?? 0); i++) fixed.push(k)
  return { ok: added.length === 0, added, fixed }
}

function runTsc() {
  try {
    // 🔴 -p tsconfig.app.json を明示する。ルートの tsconfig.json では何も検査されない
    execFileSync('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return '' // エラー0件
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

const current = parseTscOutput(runTsc())

if (ACCEPT) {
  fs.writeFileSync(BASELINE, current.length ? current.slice().sort().join('\n') + '\n' : '')
  console.log(`ベースラインを更新しました: ${current.length} 件`)
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE)
  ? fs.readFileSync(BASELINE, 'utf8').split('\n').filter(Boolean)
  : []

const r = diff(current, baseline)

if (r.fixed.length > 0) {
  console.log(`✅ ${r.fixed.length} 件のエラーが解消しています:`)
  for (const k of r.fixed.slice(0, 10)) console.log(`   - ${k}`)
  if (r.fixed.length > 10) console.log(`   … 他 ${r.fixed.length - 10} 件`)
  console.log('   反映するには: npm run type-check:accept')
  console.log('')
}

if (!r.ok) {
  console.error(`❌ 新しい型エラーが ${r.added.length} 件増えています（ベースライン ${baseline.length} 件 → 現在 ${current.length} 件）:`)
  for (const k of r.added) console.error(`   - ${k.split('|').join('  ')}`)
  console.error('')
  console.error('   直してから再実行してください。全エラーを見る: npm run type-check:all')
  process.exit(1)
}

console.log(`✅ 型チェック: 新規エラーなし（既存 ${current.length} 件は据え置き）`)
