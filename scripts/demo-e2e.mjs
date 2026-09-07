#!/usr/bin/env node
/**
 * デモモードで業務フローを実際に操作して確かめる（2026-09-07 追加）
 *
 * ブラウザを自動で動かし、人がやるのと同じようにボタンを押して、
 * 期待どおりデータが動くかを見る。本番の Supabase には一切つながらない
 * （データは localStorage 上のモック。vite.config.demo.ts 参照）。
 *
 * 前提: 別のターミナルで `npm run dev:demo` が動いていること
 *
 * 使い方:
 *   node scripts/demo-e2e.mjs              # 全シナリオ
 *   node scripts/demo-e2e.mjs scan         # 指定シナリオだけ
 *   HEADED=1 node scripts/demo-e2e.mjs     # ブラウザを表示して見ながら
 *
 * 失敗が1つでもあれば exit 1。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.BASE ?? 'http://localhost:5199').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/demo-e2e'
const HEADED = process.env.HEADED === '1'

// デモモードでは Realtime の接続先が dummy になり必ず失敗する。仕様なので数えない
const EXPECTED_IN_DEMO = /dummy\.supabase\.co|ERR_NAME_NOT_RESOLVED|WebSocket connection/

function resolvePlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require.resolve('playwright')
  } catch {
    const npxRoot = path.join(process.env.HOME ?? '', '.npm', '_npx')
    if (!fs.existsSync(npxRoot)) return null
    for (const dir of fs.readdirSync(npxRoot)) {
      const p = path.join(npxRoot, dir, 'node_modules', 'playwright', 'index.mjs')
      if (fs.existsSync(p)) return p
    }
    return null
  }
}

const pwPath = resolvePlaywright()
if (!pwPath) {
  console.error('playwright が見つかりません。`npx playwright install chromium` を実行してください')
  process.exit(1)
}
const { chromium } = await import(`file://${pwPath}`)

fs.mkdirSync(OUT, { recursive: true })

// --- 記録 ---------------------------------------------------------------
const results = []
function record(scenario, step, ok, detail = '') {
  results.push({ scenario, step, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`)
}

// --- ヘルパ -------------------------------------------------------------

/** ページを開いて、アプリの初期ロードが終わるまで待つ */
async function open(context, route) {
  const page = await context.newPage()
  const errors = []
  page.on('console', m => {
    if (m.type() === 'error' && !EXPECTED_IN_DEMO.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', e => {
    if (!EXPECTED_IN_DEMO.test(e.message)) errors.push(e.message)
  })
  page.on('dialog', d => d.accept()) // confirm / alert は全部OKで進める
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(1200)
  page.__errors = errors
  return page
}

/** localStorage のモックDBから個体を1件読む（画面の裏で何が起きたかを確認する） */
async function readItem(page, id) {
  return page.evaluate(itemId => {
    const raw = localStorage.getItem('mock_product_items')
    return raw ? JSON.parse(raw).find(i => i.id === itemId) ?? null : null
  }, id)
}

async function readHistories(page, id) {
  return page.evaluate(itemId => {
    const raw = localStorage.getItem('mock_item_histories')
    return raw ? JSON.parse(raw).filter(h => h.item_id === itemId) : []
  }, id)
}

/**
 * QRスキャン画面で1手進める。
 * ⚠️ デスクトップでは ScanActionDialog が2箇所で描画されるため、
 *    ボタンは必ず .first() で掴む（scan.tsx:465 と :506）
 */
async function scanAndAct(page, qr, buttonLabel) {
  // 前の操作のダイアログが残っていたら閉じる。
  // ⚠️ 入庫処理のあとは「ラベル印刷」ダイアログが入れ子で開いたままになるので、
  //    次のスキャンに進む前に必ず片付ける（scan-action-dialog.tsx:292-293）
  await dismissOpenDialogs(page)

  const input = page.getByPlaceholder(/QRコードを入力/).first()
  await input.fill('')
  await input.fill(qr)
  await input.press('Enter')
  await page.waitForTimeout(600)

  const btn = page.getByRole('button', { name: buttonLabel }).first()
  await btn.waitFor({ state: 'visible', timeout: 10_000 })
  await btn.click()
  await page.waitForTimeout(500)

  const submit = page.getByRole('button', { name: '処理実行' }).first()
  await submit.waitFor({ state: 'visible', timeout: 10_000 })
  await submit.click()
  await page.waitForTimeout(1200)
}

/** 開いているダイアログを閉じる（キャンセル / 印刷しない / Escape の順に試す） */
async function dismissOpenDialogs(page) {
  for (let i = 0; i < 3; i++) {
    const closers = ['印刷しない', 'キャンセル']
    let closed = false
    for (const label of closers) {
      const b = page.getByRole('button', { name: label }).first()
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {})
        await page.waitForTimeout(400)
        closed = true
        break
      }
    }
    if (!closed) return
  }
}

// --- シナリオ -----------------------------------------------------------

/** 消毒ライン: 貸与中 → 返却 → 消毒済み → メンテ済み → 利用可能 */
async function scenarioScan(context) {
  const name = 'QRスキャンで消毒ラインを1周'
  console.log(`\n=== ${name} ===`)
  const page = await open(context, '/scan')

  const before = await readItem(page, 'WC-003')
  record(name, '開始時 WC-003 は貸与中', before?.status === 'rented', `status=${before?.status}`)

  const steps = [
    ['返却', 'returned'],
    ['消毒完了', 'cleaning'],
    ['メンテナンス完了', 'maintenance'],
    ['入庫処理', 'available'],
  ]
  for (const [label, expected] of steps) {
    try {
      await scanAndAct(page, 'WC-003', label)
      const after = await readItem(page, 'WC-003')
      record(name, `「${label}」を押すと ${expected} になる`, after?.status === expected, `status=${after?.status}`)
    } catch (e) {
      record(name, `「${label}」を押す`, false, e.message.split('\n')[0])
      break
    }
  }

  // 入庫のあとはラベル印刷の確認ダイアログが入れ子で開く（scan-action-dialog.tsx:292）。
  // ⚠️ ここで dismissOpenDialogs を先に呼ぶと「印刷しない」を押してしまうので触らない
  const print = page.getByRole('button', { name: 'ラベルを印刷する' }).first()
  const labelDialog = await print.isVisible().catch(() => false)
  record(name, '入庫のあとラベル印刷の確認が出る', labelDialog)
  if (labelDialog) {
    await print.click()
    await page.waitForTimeout(1200)
    const queue = await page.evaluate(() => {
      const raw = localStorage.getItem('mock_label_print_queue')
      return raw ? JSON.parse(raw) : []
    })
    record(name, 'ラベル印刷の指示がキューに入る', queue.length > 0, `${queue.length}件`)
    record(
      name,
      'キューの中身が正しい（管理番号・pending）',
      queue[0]?.management_id === 'WC-003' && queue[0]?.status === 'pending',
      `management_id=${queue[0]?.management_id} status=${queue[0]?.status}`
    )
  }

  await dismissOpenDialogs(page)

  // 履歴が各段で残っているか（消毒記録は法令上の保存義務がある）
  const hist = await readHistories(page, 'WC-003')
  const actions = hist.map(h => h.action)
  for (const a of ['返却', '消毒完了', 'メンテナンス完了', '入庫処理']) {
    record(name, `履歴に「${a}」が残る`, actions.includes(a))
  }

  // 返却時に貸与先が消えること（scan-action-dialog.tsx:221-225 の仕様）
  const finalItem = await readItem(page, 'WC-003')
  record(name, '返却で貸与先がクリアされる', !finalItem?.customer_name, `customer_name=${finalItem?.customer_name ?? '(なし)'}`)

  record(name, 'JSエラーが出ていない', page.__errors.length === 0, page.__errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'scan.png') })
  await page.close()
}

/** 発注の承認 */
async function scenarioApproval(context) {
  const name = '承認待ちの発注を承認する'
  console.log(`\n=== ${name} ===`)
  const page = await open(context, '/approval')

  const shown = await page.getByText('デモ利用者C').first().isVisible().catch(() => false)
  record(name, '承認待ちの発注が一覧に出る', shown)

  if (shown) {
    const approveBtn = page.getByRole('button', { name: /承認/ }).first()
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click()
      await page.waitForTimeout(600)
      const submit = page.getByRole('button', { name: /実行|承認する|確定/ }).first()
      if (await submit.isVisible().catch(() => false)) {
        await submit.click()
        await page.waitForTimeout(1200)
      }
      const order = await page.evaluate(() => {
        const raw = localStorage.getItem('mock_orders')
        return raw ? JSON.parse(raw).find(o => o.id === 'ORD-DEMO-1') : null
      })
      record(name, '発注が承認済みになる', order?.status === 'approved', `status=${order?.status}`)
    }
  }
  record(name, 'JSエラーが出ていない', page.__errors.length === 0, page.__errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'approval.png') })
  await page.close()
}

/** 主要画面が開くか（描画の回帰） */
async function scenarioScreens(context) {
  const name = '主要画面が開く'
  console.log(`\n=== ${name} ===`)
  const routes = ['/menu', '/inventory', '/orders', '/preparation', '/history', '/search', '/label-queue', '/work-management', '/product-analysis', '/deposits', '/demo']
  for (const r of routes) {
    const page = await open(context, r)
    const text = (await page.locator('body').innerText().catch(() => '')).trim()
    const ok = text.length > 50 && page.__errors.length === 0
    record(name, r, ok, page.__errors.length ? page.__errors[0].slice(0, 90) : `${text.length}文字`)
    await page.screenshot({ path: path.join(OUT, r.replace(/\//g, '_') + '.png') })
    await page.close()
  }
}

// --- 実行 ---------------------------------------------------------------

const SCENARIOS = {
  scan: scenarioScan,
  approval: scenarioApproval,
  screens: scenarioScreens,
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS)

const browser = await chromium.launch({ headless: !HEADED })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

// デモモードのログイン状態を作る（useAuth.ts:16 が localStorage の auth_user を見る）
await context.addInitScript(() => {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' } })
  )
})

for (const key of wanted) {
  const fn = SCENARIOS[key]
  if (!fn) {
    console.error(`不明なシナリオ: ${key}（${Object.keys(SCENARIOS).join(', ')}）`)
    continue
  }
  try {
    await fn(context)
  } catch (e) {
    record(key, 'シナリオ全体', false, e.message.split('\n')[0])
  }
  // 次のシナリオに前の結果を持ち越さない
  const reset = await context.newPage()
  await reset.goto(BASE + '/menu', { waitUntil: 'domcontentloaded' })
  await reset.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mock_') || k.startsWith('wem_')) localStorage.removeItem(k)
  })
  await reset.close()
}

await browser.close()

const failed = results.filter(r => !r.ok)
console.log(`\n${'─'.repeat(60)}`)
console.log(`合計 ${results.length} 項目 / 成功 ${results.length - failed.length} / 失敗 ${failed.length}`)
if (failed.length) {
  console.log('\n失敗した項目:')
  for (const f of failed) console.log(`  ✗ [${f.scenario}] ${f.step}${f.detail ? ` — ${f.detail}` : ''}`)
}
console.log(`スクリーンショット: ${OUT}`)
process.exit(failed.length ? 1 : 0)
