#!/usr/bin/env node
/**
 * Realtime が本当に届いているかを確かめる（2026-09-09 追加）
 *
 * 田口さん「リアルタイムのテストってあなたがすることは無理なん？」
 *
 * product_items / orders / order_items を購読して、届いたイベントを表示する。
 * **このスクリプトは1行も書き込まない。** 誰かがアプリを操作した分を見るだけ。
 *
 * テーブルが supabase_realtime の publication に入っていないと、
 * 購読は SUBSCRIBED になるのにイベントが1件も来ない。その切り分けに使う。
 *
 * 認証情報は印刷エージェントと同じ経路（~/secrets/... の .env）から読む。
 * 値は一切表示しない。顧客名などの中身も出さず、テーブル名・種別・IDだけ出す。
 *
 * 使い方:
 *   node scripts/realtime-check.mjs            # 60秒待つ
 *   SECONDS=180 node scripts/realtime-check.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// supabase-js はリポジトリ直下のものを使う（アプリと同じ版）
import { createClient } from '@supabase/supabase-js'
// .env の読み方は印刷エージェントと同じ（~/secrets 優先・直下は補助）
import { loadLayeredEnv, defaultSecretsPath } from '../mcp-server/dist/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const WAIT_SECONDS = Number(process.env.SECONDS ?? 60)

loadLayeredEnv({
  secretsPath: defaultSecretsPath(),
  fallbackPath: path.join(REPO_ROOT, '.env'),
  watch: /^(VITE_SUPABASE_|MCP_USER_|PRINT_AGENT_)/,
})

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.PRINT_AGENT_EMAIL ?? process.env.MCP_USER_EMAIL
const PASSWORD = process.env.PRINT_AGENT_PASSWORD ?? process.env.MCP_USER_PASSWORD

if (!URL || !KEY) { console.error('Supabase の接続情報が見つかりません'); process.exit(1) }
if (!EMAIL || !PASSWORD) { console.error('ログイン用の認証情報が見つかりません'); process.exit(1) }

const TABLES = ['product_items', 'orders', 'order_items']
const received = Object.fromEntries(TABLES.map(t => [t, []]))

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

const { error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authError) { console.error(`ログイン失敗: ${authError.message}`); process.exit(1) }
console.log('ログイン成功（認証済みユーザーとして購読します。RLS も同じ条件で効きます）\n')

const channel = supabase.channel('realtime-check')
for (const table of TABLES) {
  channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
    // 顧客名などは出さない。テーブル・種別・ID だけ
    const id = payload.new?.id ?? payload.old?.id ?? '(id不明)'
    const stamp = new Date().toISOString().slice(11, 19)
    received[table].push(payload.eventType)
    console.log(`  📨 ${stamp}  ${table.padEnd(13)} ${String(payload.eventType).padEnd(6)} id=${id}`)
  })
}

const status = await new Promise(resolve => {
  channel.subscribe(s => {
    if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') resolve(s)
  })
  setTimeout(() => resolve('NO_RESPONSE'), 20_000)
})

if (status !== 'SUBSCRIBED') {
  console.error(`購読に失敗しました: ${status}`)
  process.exit(1)
}

console.log(`購読開始: ${TABLES.join(' / ')}`)
console.log('⚠️ 購読が成功しても、publication に入っていないテーブルはイベントが来ません。')
console.log(`   ${WAIT_SECONDS} 秒待ちます。この間にアプリを操作してください。\n`)
console.log('   例) 在庫一覧で個体のステータスを変える → product_items')
console.log('       発注を新しく作る                   → orders と order_items')
console.log('       発注を承認する                     → order_items\n')

await new Promise(r => setTimeout(r, WAIT_SECONDS * 1000))

console.log('\n' + '─'.repeat(56))
let anySilent = false
for (const t of TABLES) {
  const n = received[t].length
  if (n > 0) {
    const kinds = [...new Set(received[t])].join(', ')
    console.log(`  ✅ ${t.padEnd(13)} ${String(n).padStart(3)}件  (${kinds})`)
  } else {
    console.log(`  ⬜ ${t.padEnd(13)}   0件  （操作していないだけかも）`)
    anySilent = true
  }
}
console.log('─'.repeat(56))
if (anySilent) {
  console.log('\n0件のテーブルは「操作しなかった」か「publication に入っていない」かの')
  console.log('どちらかです。操作したのに0件なら publication を疑ってください。')
}

await supabase.removeChannel(channel)
await supabase.auth.signOut()
process.exit(0)
