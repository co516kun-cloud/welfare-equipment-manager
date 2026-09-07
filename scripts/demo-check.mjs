#!/usr/bin/env node
/**
 * デモモードのアプリをヘッドレスブラウザで開いて、画面を撮る（2026-09-07 追加）
 *
 * 目的: UI を変えたときに「白画面になっていないか」「見た目が壊れていないか」を
 *       人の目に頼らず確認する。本番の Supabase には一切つながらないので、
 *       撮った画像に実在の利用者名が写ることがない。
 *
 * 前提: 別のターミナルで `npm run dev:demo` が動いていること（既定 http://localhost:5199）
 *
 * 使い方:
 *   node scripts/demo-check.mjs                       # 主要画面をまとめて撮る
 *   node scripts/demo-check.mjs /menu /inventory      # 指定した画面だけ
 *   BASE=http://localhost:5199 OUT=/tmp/shots node scripts/demo-check.mjs
 *
 * 出力: OUT ディレクトリに PNG。JS エラー・コンソールエラーがあれば標準出力に出し、
 *       1つでもあれば exit 1（CI からも使えるように）。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5199'
const OUT = process.env.OUT ?? '/tmp/demo-shots'
const WIDTH = Number(process.env.WIDTH ?? 1440)
const HEIGHT = Number(process.env.HEIGHT ?? 900)

const DEFAULT_ROUTES = [
  '/menu',
  '/inventory',
  '/orders',
  '/preparation',
  '/history',
  '/search',
  '/label-queue',
  '/ai-features', // 廃止済み。「ページが見つかりません」が出るはず
]
const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES

/**
 * playwright は devDependencies に入れていない（重い）。
 * npx で入れたものが ~/.npm/_npx 配下にあればそれを使う。
 */
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
  console.error('playwright が見つかりません。`npx playwright install chromium` を一度実行してください')
  process.exit(1)
}
const { chromium } = await import(pwPath.startsWith('/') ? `file://${pwPath}` : pwPath)

fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })

// デモモードの「ログイン済み」状態を作る。
// useAuth は URL に dummy が含まれるとき localStorage の auth_user を読む（useAuth.ts:16）。
// mock-database.ts の mockUsers[0] に合わせておくと、担当者名の解決も通る。
await context.addInitScript(() => {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({
      id: 'USER-1',
      email: 'tanaka@example.com',
      user_metadata: { name: '田中太郎' },
    })
  )
})

let problems = 0

for (const route of routes) {
  const page = await context.newPage()
  const errors = []
  // デモモードでは Realtime の接続先が dummy.supabase.co なので必ず失敗する。
  // これはモードの仕様であって不具合ではないので数えない。
  const EXPECTED_IN_DEMO = /dummy\.supabase\.co|ERR_NAME_NOT_RESOLVED|WebSocket connection/
  page.on('console', m => {
    if (m.type() === 'error' && !EXPECTED_IN_DEMO.test(m.text())) errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', e => {
    if (!EXPECTED_IN_DEMO.test(e.message)) errors.push(`pageerror: ${e.message}`)
  })

  const url = BASE.replace(/\/$/, '') + route
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  } catch (e) {
    console.log(`\n=== ${route} ===`)
    console.log(`  ❌ 読み込み失敗: ${e.message}`)
    problems++
    await page.close()
    continue
  }
  await page.waitForTimeout(1500)

  const text = (await page.locator('body').innerText().catch(() => '')).trim()
  const file = path.join(OUT, (route.replace(/\//g, '_') || '_root') + '.png')
  await page.screenshot({ path: file })

  console.log(`\n=== ${route} ===`)
  console.log(`  画像: ${file}`)
  if (!text) {
    console.log('  ❌ 白画面（body が空）')
    problems++
  } else {
    console.log(`  文字数: ${text.length}  先頭: ${text.slice(0, 80).replace(/\n/g, ' / ')}`)
  }
  if (errors.length) {
    console.log(`  ❌ エラー ${errors.length} 件:`)
    for (const e of errors.slice(0, 5)) console.log(`     ${e}`)
    problems += errors.length
  }
  await page.close()
}

await browser.close()

console.log(`\n${problems === 0 ? '✅ 問題なし' : `❌ 問題 ${problems} 件`}`)
process.exit(problems === 0 ? 0 : 1)
