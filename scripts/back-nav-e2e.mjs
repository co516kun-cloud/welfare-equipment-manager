#!/usr/bin/env node
/**
 * 「戻る」の動きをヘッドレスブラウザで実際に確かめる（2026-09-08 追加）
 *
 * 田口さんの指摘:
 *   「戻るを押した時にちゃんと一つ前に戻るようにしてほしい。
 *     変なとこへ飛んだり、戻りすぎたりが結構ある」
 *
 * 前提: 別ターミナルで `npm run dev:demo`（既定 http://localhost:5201）
 * 使い方: BASE=http://localhost:5201 node scripts/back-nav-e2e.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.BASE ?? 'http://localhost:5201').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/back-nav-shots'

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

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' },
    }))
  })
  const page = await ctx.newPage()
  return { page, ctx }
}

const settle = p => p.waitForTimeout(900)
const pathOf = p => new URL(p.url()).pathname

// ---------------------------------------------------------------- PC
console.log('\n=== PC (1440x900) ===')
{
  const { page, ctx } = await newPage(1440, 900)

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await settle(page)
  const topText = await page.locator('body').innerText()
  check('トップ(/)はメニュー画面', topText.includes('メニュー') || topText.includes('在庫'))
  check('トップでは「☰ メニュー」を出さない（同じ画面を履歴に積まないため）',
    !(await page.getByRole('button', { name: /メニュー$/ }).first().isVisible().catch(() => false))
    || !topText.includes('☰'))

  // 在庫一覧へ入り、階層を2つ潜って戻る
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' })
  await settle(page)
  const cat = page.locator('div.cursor-pointer').first()
  const hasCat = await cat.isVisible().catch(() => false)
  if (hasCat) {
    await cat.click(); await settle(page)
    const afterCat = await page.locator('body').innerText()
    check('種類をクリックすると商品一覧へ潜る', afterCat.includes('商品別在庫') || afterCat.includes('/'))

    const prod = page.locator('div.cursor-pointer').first()
    if (await prod.isVisible().catch(() => false)) {
      await prod.click(); await settle(page)
      const afterProd = await page.locator('body').innerText()
      check('商品をクリックすると個体一覧へ潜る', afterProd.includes('個別管理') || afterProd.includes('個体'))

      await page.goBack(); await settle(page)
      const back1 = await page.locator('body').innerText()
      check('戻る1回で商品一覧まで（ページごと出ない）',
        pathOf(page) === '/inventory' && !back1.includes('個別管理在庫'), `path=${pathOf(page)}`)

      await page.goBack(); await settle(page)
      check('戻る2回で在庫一覧のトップ階層', pathOf(page) === '/inventory', `path=${pathOf(page)}`)

      await page.goBack(); await settle(page)
      check('戻る3回でようやく在庫一覧を離れる', pathOf(page) !== '/inventory', `path=${pathOf(page)}`)
    }
  } else {
    console.log('  ⚠️ 種類カードが見つからずドリルダウンは未検証')
  }
  await page.screenshot({ path: path.join(OUT, 'pc-inventory.png') })
  await ctx.close()
}

// 商品検索 → 個体詳細 → 戻る
{
  const { page, ctx } = await newPage(1440, 900)
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' })
  await settle(page)
  const searchBtn = page.getByRole('button', { name: /^検索/ }).first()
  if (await searchBtn.isVisible().catch(() => false)) {
    await searchBtn.click(); await settle(page)
    const detail = page.getByRole('button', { name: '詳細' }).first()
    if (await detail.isVisible().catch(() => false)) {
      await detail.click(); await settle(page)
      check('検索結果から個体詳細へ行ける', pathOf(page).startsWith('/item/'), `path=${pathOf(page)}`)

      const back = page.getByRole('button', { name: /戻る/ }).first()
      await back.click(); await settle(page)
      check('個体詳細の「戻る」で商品検索に返る（在庫一覧へ飛ばない）',
        pathOf(page) === '/search', `path=${pathOf(page)}`)
      const restored = await page.locator('body').innerText()
      check('戻ったときに検索結果が残っている',
        restored.includes('件') && !restored.includes('検索条件を入力して'), '')
      await page.screenshot({ path: path.join(OUT, 'pc-search-back.png') })
    } else {
      console.log('  ⚠️ 検索結果の「詳細」ボタンが無く未検証')
    }
  } else {
    console.log('  ⚠️ 検索ボタンが見つからず未検証')
  }
  await ctx.close()
}

// 直接開いたページの「戻る」がアプリの外へ出ないこと
{
  const { page, ctx } = await newPage(1440, 900)
  await page.goto(`${BASE}/label-queue`, { waitUntil: 'networkidle' })
  await settle(page)
  const back = page.getByRole('button', { name: /戻る/ }).first()
  if (await back.isVisible().catch(() => false)) {
    await back.click(); await settle(page)
    check('URL直打ちのラベル印刷状況で「戻る」→ アプリ内に留まる',
      pathOf(page) === '/menu' || pathOf(page) === '/', `path=${pathOf(page)}`)
  }
  await ctx.close()
}

// ---------------------------------------------------------------- モバイル
console.log('\n=== モバイル (390x844) ===')
{
  const { page, ctx } = await newPage(390, 844)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await settle(page)
  const t = await page.locator('body').innerText()
  check('モバイルのトップはマイページのまま', t.includes('マイページ') || t.includes('配送'))
  await page.screenshot({ path: path.join(OUT, 'mobile-top.png') })

  await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle' })
  await settle(page)
  check('モバイルで /menu を直接開いても落ちない', (await page.locator('body').innerText()).length > 0)
  await ctx.close()
}

await browser.close()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗   画像: ${OUT}`)
process.exit(fail === 0 ? 0 : 1)
