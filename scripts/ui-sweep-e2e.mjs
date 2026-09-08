#!/usr/bin/env node
/**
 * 全画面のボタンを実際に押して回る（2026-09-08 追加）
 *
 * 「表示できる」ではなく「押して壊れないか」を見る。
 * 各画面のボタンを1つずつ押し、JSエラー・白画面・未処理の例外を拾う。
 * 押したら画面を開き直して次のボタンへ行くので、状態は持ち越さない。
 *
 * 消す系のボタン（削除・リセット・全消し）は押さない。
 *
 * 前提: `npm run dev:demo`
 * 使い方: BASE=http://localhost:5202 node scripts/ui-sweep-e2e.mjs [/route ...]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.BASE ?? 'http://localhost:5202').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/ui-sweep'
const WIDTH = Number(process.env.WIDTH ?? 1440)
const HEIGHT = Number(process.env.HEIGHT ?? 1000)
const MAX_BUTTONS = Number(process.env.MAX_BUTTONS ?? 14)

const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/menu', '/mypage', '/inventory', '/orders', '/preparation', '/approval',
  '/history', '/search', '/scan', '/deposits', '/demo', '/label-queue',
  '/work-management', '/product-analysis', '/notifications', '/stock-alert', '/data-import',
]

/**
 * ボタン名の照合パターン。
 * innerText は span の境目に空白を入れるが、実際の DOM には無いことがある
 * （「➕新規発注」が innerText では「➕ 新規発注」になる）。
 * そのまま照合すると1つも見つからず、押していないのに素通りしてしまうので、
 * 空白は「あってもなくてもよい」として扱う。
 */
function labelPattern(label) {
  return new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'))
}

/** 押すと消える・戻せないものは触らない */
const DESTRUCTIVE = /削除|消去|リセット|全消し|クリア|取消|キャンセル|ログアウト|廃棄|初期化/

function resolvePlaywright() {
  const require = createRequire(import.meta.url)
  try { return require.resolve('playwright') } catch {}
  const npxRoot = path.join(process.env.HOME ?? '', '.npm', '_npx')
  if (!fs.existsSync(npxRoot)) return null
  for (const dir of fs.readdirSync(npxRoot)) {
    const p = path.join(npxRoot, dir, 'node_modules', 'playwright', 'index.mjs')
    if (fs.existsSync(p)) return p
  }
  return null
}
const pwPath = resolvePlaywright()
if (!pwPath) { console.error('playwright が見つかりません'); process.exit(1) }
const { chromium } = await import(pwPath.startsWith('/') ? `file://${pwPath}` : pwPath)

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })
await ctx.addInitScript(() => {
  localStorage.setItem('auth_user', JSON.stringify({
    id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' },
  }))
})

// デモでは必ず失敗するものは数えない（モードの仕様）。
// カメラはヘッドレスのブラウザに存在しないので、QRスキャン系の
// 「カメラが見つかりません」は環境の話であって不具合ではない。
const EXPECTED = /dummy\.supabase\.co|ERR_NAME_NOT_RESOLVED|WebSocket|Weather API key|Failed to load resource|カメラが見つかりません|Camera error|getUserMedia/

let totalClicks = 0
const problems = []

async function openPage() {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => { if (!EXPECTED.test(e.message)) errors.push(`例外: ${e.message}`) })
  page.on('console', m => {
    if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`)
  })
  page.on('dialog', async d => { await d.dismiss().catch(() => d.accept()) })
  return { page, errors }
}

for (const route of ROUTES) {
  console.log(`\n=== ${route} ===`)
  const { page, errors } = await openPage()
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  } catch (e) {
    console.log(`  ❌ 開けない: ${e.message.split('\n')[0]}`)
    problems.push(`${route}: 開けない`)
    await page.close(); continue
  }
  await page.waitForTimeout(1600)

  const firstText = (await page.locator('body').innerText().catch(() => '')).trim()
  if (!firstText) {
    console.log('  ❌ 白画面')
    problems.push(`${route}: 白画面`)
    await page.close(); continue
  }
  await page.screenshot({ path: path.join(OUT, (route.replace(/\//g, '_') || '_root') + '.png') })

  // 押せるボタンを集める
  const labels = []
  const btns = page.locator('button:visible')
  const n = Math.min(await btns.count(), 60)
  for (let i = 0; i < n; i++) {
    const label = ((await btns.nth(i).innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ')
    if (!label || label.length > 40) continue
    if (DESTRUCTIVE.test(label)) continue
    if (labels.includes(label)) continue
    labels.push(label)
    if (labels.length >= MAX_BUTTONS) break
  }
  console.log(`  ボタン ${labels.length}個: ${labels.slice(0, 8).join(' / ')}${labels.length > 8 ? ' …' : ''}`)
  if (errors.length) {
    console.log(`  ❌ 開いた時点でエラー: ${errors[0]}`)
    problems.push(`${route}: 表示時 ${errors[0]}`)
  }

  let ok = 0
  const skipped = []
  for (const label of labels) {
    const before = errors.length
    try {
      // デモは dummy.supabase.co へ再接続し続けるので networkidle は来ない。
      // domcontentloaded + 実待ちにする（ここを networkidle にすると全部
      // タイムアウトで飛ばされ、押していないのに「問題なし」に見えてしまう）
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(1800)
      const target = page.getByRole('button', { name: labelPattern(label) }).first()
      if (!(await target.isVisible().catch(() => false))) { skipped.push(`${label}(出ていない)`); continue }
      await target.click({ timeout: 8000 })
      await page.waitForTimeout(1400)
      totalClicks++

      const after = (await page.locator('body').innerText().catch(() => '')).trim()
      if (!after) {
        console.log(`  ❌ 「${label}」→ 白画面`)
        problems.push(`${route}「${label}」白画面`)
        continue
      }
      const fresh = errors.slice(before)
      if (fresh.length) {
        console.log(`  ❌ 「${label}」→ ${fresh[0]}`)
        problems.push(`${route}「${label}」${fresh[0]}`)
        continue
      }
      ok++
    } catch (e) {
      const msg = e.message.split('\n')[0]
      if (/intercepts pointer events|not visible|detached|Timeout/.test(msg)) {
        skipped.push(`${label}(押せない)`)
        continue
      }
      console.log(`  ❌ 「${label}」→ ${msg}`)
      problems.push(`${route}「${label}」${msg}`)
    }
  }
  // 押せなかったものは黙って落とさない。押していないものを成功に数えないため
  console.log(`  ✅ ${ok}/${labels.length} 個を実際に押して問題なし`)
  if (skipped.length) console.log(`  ⏭️ 押せなかった ${skipped.length}個: ${skipped.join(' / ')}`)
  await page.close()
}

await browser.close()
console.log(`\n押したボタン ${totalClicks}個`)
if (problems.length === 0) {
  console.log(`✅ 問題なし   画像: ${OUT}`)
} else {
  console.log(`❌ 問題 ${problems.length}件:`)
  for (const p of problems) console.log(`   - ${p}`)
}
process.exit(problems.length === 0 ? 0 : 1)
