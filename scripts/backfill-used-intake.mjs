#!/usr/bin/env node
/**
 * 中古で新規登録した個体に、消毒→メンテ→入庫 の履歴を後から足す（2026-10-23 追加）
 *
 * 田口さん「返却されたマットレスに新しく番号を振って登録すると、実際は 返却・消毒・メンテ を
 * しているのに新規登録扱いになって、1ヶ月の消毒数が正しく見れない」。
 * これからの登録はアプリ・MCP の両方で自動で足す（item-status.ts の needsUsedIntake）。
 * このスクリプトは**それより前に登録した分**を直す。
 *
 * 対象（すべて満たすもの）:
 *   - item_histories の「新規登録」で、--since 以降、to_status = available
 *   - 個体の状態メモ・その新規登録の履歴のどちらにも「新品」と書いていない
 *   - まだ「新規登録（中古）」の履歴が無い（2回流しても二重にならない）
 *
 * 足すもの: 1台につき 消毒完了 / メンテナンス完了 / 入庫処理 の3行。
 *   日時は新規登録の1・2・3秒後、実行者は新規登録した人。product_items は触らない。
 *
 * 使い方:
 *   node scripts/backfill-used-intake.mjs                       # 見るだけ（既定 --since 2026-08-01）
 *   node scripts/backfill-used-intake.mjs --since 2026-09-01    # 期間を変えて見る
 *   node scripts/backfill-used-intake.mjs --apply               # 実際に足す
 *
 * 認証情報は印刷エージェントと同じ経路（~/secrets/... の .env）から読む。値は表示しない。
 * 顧客名は読まない・出さない。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadLayeredEnv, defaultSecretsPath } from '../mcp-server/dist/env.js'
import { usedIntakeSteps, USED_INTAKE_NOTE } from '../mcp-server/dist/shared/item-status.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const sinceIdx = args.indexOf('--since')
const SINCE = sinceIdx >= 0 ? args[sinceIdx + 1] : '2026-08-01'
if (!/^\d{4}-\d{2}-\d{2}$/.test(SINCE || '')) {
  console.error('--since は YYYY-MM-DD で指定してください')
  process.exit(1)
}

loadLayeredEnv({
  secretsPath: defaultSecretsPath(),
  fallbackPath: path.join(REPO_ROOT, '.env'),
  watch: /^(VITE_SUPABASE_|MCP_USER_|PRINT_AGENT_)/,
})

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.MCP_USER_EMAIL ?? process.env.PRINT_AGENT_EMAIL
const PASSWORD = process.env.MCP_USER_PASSWORD ?? process.env.PRINT_AGENT_PASSWORD
if (!URL || !KEY || !EMAIL || !PASSWORD) {
  console.error('接続情報が足りません（VITE_SUPABASE_URL / ANON_KEY / MCP_USER_EMAIL / PASSWORD）')
  process.exit(1)
}

const supabase = createClient(URL, KEY)
const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authErr) {
  console.error('ログインに失敗:', authErr.message)
  process.exit(1)
}

const hasNew = (s) => (s ?? '').includes('新品')

// 1. 期間内の新規登録
const { data: regs, error: rErr } = await supabase
  .from('item_histories')
  .select('id, item_id, timestamp, to_status, performed_by, location, condition, notes, condition_notes')
  .eq('action', '新規登録')
  .gte('timestamp', `${SINCE}T00:00:00+09:00`)
  .order('timestamp')
if (rErr) { console.error('新規登録の取得に失敗:', rErr.message); process.exit(1) }

const itemIds = [...new Set(regs.map(r => r.item_id))]
if (itemIds.length === 0) { console.log(`${SINCE} 以降の新規登録はありません`); process.exit(0) }

// 2. 個体（状態メモ・商品名・カテゴリ）と、既に足した印
const { data: items, error: iErr } = await supabase
  .from('product_items')
  .select('id, condition_notes, products(name, category_id)')
  .in('id', itemIds)
if (iErr) { console.error('個体の取得に失敗:', iErr.message); process.exit(1) }
const itemMap = new Map(items.map(i => [i.id, i]))

const { data: done, error: dErr } = await supabase
  .from('item_histories')
  .select('item_id')
  .in('item_id', itemIds)
  .ilike('notes', `%${USED_INTAKE_NOTE}%`)
if (dErr) { console.error('既存の印の取得に失敗:', dErr.message); process.exit(1) }
const doneSet = new Set(done.map(d => d.item_id))

// 3. 振り分け
const targets = []
const skipped = { 新品: 0, 足し済み: 0, 在庫以外で登録: 0, 個体なし: 0 }
for (const r of regs) {
  const item = itemMap.get(r.item_id)
  if (!item) { skipped.個体なし++; continue }
  if (r.to_status !== 'available') { skipped.在庫以外で登録++; continue }
  if (hasNew(item.condition_notes) || hasNew(r.notes) || hasNew(r.condition_notes)) { skipped.新品++; continue }
  if (doneSet.has(r.item_id)) { skipped.足し済み++; continue }
  targets.push({ reg: r, item })
}

// 4. 表示（月 × カテゴリの件数と一覧）
const jstMonth = (ts) => new Date(new Date(ts).getTime() + 9 * 3600e3).toISOString().slice(0, 7)
const jstDate = (ts) => new Date(new Date(ts).getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')
const byMonth = new Map()
for (const t of targets) {
  const m = jstMonth(t.reg.timestamp)
  const c = t.item.products?.category_id ?? '(不明)'
  const row = byMonth.get(m) ?? new Map()
  row.set(c, (row.get(c) ?? 0) + 1)
  byMonth.set(m, row)
}

console.log(`\n${SINCE} 以降の新規登録 ${regs.length}件 → 中古として履歴を足す対象 ${targets.length}台`)
console.log(`対象外: 新品 ${skipped.新品} / 足し済み ${skipped.足し済み} / 在庫以外で登録 ${skipped.在庫以外で登録} / 個体なし ${skipped.個体なし}\n`)
for (const [m, row] of [...byMonth].sort()) {
  console.log(`  ${m}: ` + [...row].map(([c, n]) => `${c} ${n}台`).join(' / '))
}
console.log('\n  登録日時          管理番号      商品名                          登録した人')
for (const t of targets) {
  console.log(`  ${jstDate(t.reg.timestamp)}  ${t.reg.item_id.padEnd(12)}  ${(t.item.products?.name ?? '-').padEnd(30)}  ${t.reg.performed_by ?? '-'}`)
}

if (!APPLY) {
  console.log(`\n（見るだけ。書き込んでいません。足すときは --apply を付けて流してください。1台につき3行、合計 ${targets.length * 3}行）`)
  process.exit(0)
}

// 5. 書き込み（item_histories への追加だけ。product_items は触らない）
const steps = usedIntakeSteps()
const rows = targets.flatMap(({ reg }) => steps.map((s, i) => ({
  item_id: reg.item_id,
  action: s.action,
  from_status: s.from,
  to_status: s.to,
  performed_by: reg.performed_by,
  timestamp: new Date(new Date(reg.timestamp).getTime() + (i + 1) * 1000).toISOString(),
  location: reg.location,
  condition: reg.condition,
  notes: `${USED_INTAKE_NOTE}（後から追加 2026-10-23）`,
})))

let ok = 0
// 1台の3行が2回に割れないよう、3の倍数ずつ送る（途中で落ちても1台が半端に残らない）
for (let i = 0; i < rows.length; i += 99) {
  const chunk = rows.slice(i, i + 99)
  const { error } = await supabase.from('item_histories').insert(chunk)
  if (error) {
    console.error(`\n🔴 ${i + 1}行目からの書き込みで失敗: ${error.message}（ここまで ${ok}行は書き込み済み。もう一度流せば足し済みは飛ばします）`)
    process.exit(1)
  }
  ok += chunk.length
}
console.log(`\n✅ ${targets.length}台に ${ok}行の履歴を足しました`)
