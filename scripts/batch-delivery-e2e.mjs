#!/usr/bin/env node
/**
 * 一括配送（自分の分 / 代理配送）を実際にブラウザで操作して確かめる（2026-09-08 追加）
 *
 * 田口さんの指摘:
 *   「配送完了を押すときの一括処理ができる場合とできない場合がある。
 *     他の人の処理をするときの代理配送の場合も、全部一括処理が効くようにしてほしい」
 *
 * PC・モバイルの両方で、自分の担当と他人の担当（代理配送）を
 * 全選択と個別チェックの両方から実行し、個体が貸与中になるところまで見る。
 *
 * 前提: 別ターミナルで `npm run dev:demo`
 * 使い方: BASE=http://localhost:5202 node scripts/batch-delivery-e2e.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.BASE ?? 'http://localhost:5202').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/batch-shots'

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

async function fresh(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' },
    }))
  })
  const page = await ctx.newPage()
  const alerts = []
  page.on('dialog', async d => { alerts.push(d.message()); await d.accept() })
  const errors = []
  const EXPECTED = /dummy\.supabase\.co|ERR_NAME_NOT_RESOLVED|WebSocket|Weather API key/
  page.on('pageerror', e => { if (!EXPECTED.test(e.message)) errors.push(e.message) })
  page.on('console', m => {
    if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push(m.text())
  })
  // モックDBを初期状態に戻す
  await page.goto(`${BASE}/menu`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mock_') || k.startsWith('wem_')) localStorage.removeItem(k)
  })
  return { page, ctx, alerts, errors }
}

const settle = (p, ms = 2200) => p.waitForTimeout(ms)

/**
 * 担当者を切り替える。
 * PC は担当者プルダウン、モバイルはクイックアクションの「👥」からモーダルで選ぶ。
 */
async function selectAssignee(page, name) {
  const sel = page.locator('select')
  if (await sel.count() > 0) {
    const label = name === '田中太郎' ? '👤 田中太郎 (自分)' : name
    await sel.first().selectOption({ label })
  } else {
    // モバイルはクイックアクションの「👥」→ モーダルから選ぶ
    // （このモーダルは role="dialog" を持たないので、ボタンの文言で拾う）
    await page.locator('button:has-text("👥")').first().click()
    await page.waitForTimeout(800)
    await page.locator(`button:has-text("${name}")`).last().click()
  }
  await settle(page, 1800)
}

/** 個体のステータスをモックDBから直接読む */
async function itemStatus(page, id) {
  return page.evaluate(itemId => {
    const raw = localStorage.getItem('mock_product_items')
    if (!raw) return '(未保存＝初期値のまま)'
    const found = JSON.parse(raw).find(i => i.id === itemId)
    return found ? `${found.status}/${found.customer_name ?? '(顧客なし)'}` : '(見つからず)'
  }, id)
}

const bodyText = p => p.locator('body').innerText()

// ============================================================ PC・自分の担当
console.log('\n=== PC 1440x900 / 自分の担当をまとめて配送 ===')
{
  const { page, ctx, alerts, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle' })
  await settle(page)

  let t = await bodyText(page)
  check('配送準備完了が2件出ている', /配送準備完了:\s*2/.test(t), t.match(/配送準備完了:\s*\d+/)?.[0])
  check('全選択ボタンが2件と表示', t.includes('全選択 (2件)'), t.match(/全選択[^\n]*/)?.[0])

  await page.getByRole('button', { name: /全選択/ }).first().click()
  await settle(page, 700)
  t = await bodyText(page)
  check('一括配送完了ボタンが (2) になる', t.includes('一括配送完了 (2)'), t.match(/一括[^\n]*/)?.[0])
  check('自分の担当なので「代理」とは出ない', !t.includes('一括代理配送'))

  await page.screenshot({ path: path.join(OUT, 'pc-own-selected.png'), fullPage: true })
  await page.getByRole('button', { name: /一括配送完了/ }).first().click()
  await settle(page, 3500)

  check('2件まとめて完了したと出る', alerts.some(a => a.includes('2件の配送が完了しました')), JSON.stringify(alerts))
  check('WK-002 が貸与中になった', (await itemStatus(page, 'WK-002')).startsWith('rented'), await itemStatus(page, 'WK-002'))
  check('WC-005 が貸与中になった', (await itemStatus(page, 'WC-005')).startsWith('rented'), await itemStatus(page, 'WC-005'))

  t = await bodyText(page)
  check('処理後は配送準備完了が0件になる', /配送準備完了:\s*0/.test(t), t.match(/配送準備完了:\s*\d+/)?.[0])
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'pc-own-done.png'), fullPage: true })
  await ctx.close()
}

// ============================================================ PC・代理配送
console.log('\n=== PC 1440x900 / 佐藤花子さんの代理でまとめて配送 ===')
{
  const { page, ctx, alerts, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle' })
  await settle(page)
  await selectAssignee(page, '佐藤花子')

  let t = await bodyText(page)
  check('佐藤花子さんの商品に切り替わる', t.includes('佐藤花子さんの商品管理'), t.split('\n')[0])
  check('佐藤花子さんの配送準備完了が2件', /配送準備完了:\s*2/.test(t), t.match(/配送準備完了:\s*\d+/)?.[0])

  // 個別チェックでの選択（全選択に頼らない）
  const boxes = page.locator('input[type=checkbox]')
  const n = await boxes.count()
  check('代理配送でもチェックボックスが出る', n >= 2, `${n}個`)
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await settle(page, 700)

  t = await bodyText(page)
  check('ボタンが「一括代理配送 (2)」になる', t.includes('一括代理配送 (2)'), t.match(/一括[^\n]*/)?.[0])
  await page.screenshot({ path: path.join(OUT, 'pc-proxy-selected.png'), fullPage: true })

  await page.getByRole('button', { name: /一括代理配送/ }).first().click()
  await settle(page, 3500)

  check('代理で2件完了したと出る',
    alerts.some(a => a.includes('佐藤花子さんの代理で2件の配送が完了しました')), JSON.stringify(alerts))
  check('BD-004 が貸与中になった', (await itemStatus(page, 'BD-004')).startsWith('rented'), await itemStatus(page, 'BD-004'))
  check('WK-004 が貸与中になった', (await itemStatus(page, 'WK-004')).startsWith('rented'), await itemStatus(page, 'WK-004'))

  // 代理配送の履歴が「代理」として残るか
  const hist = await page.evaluate(() => {
    const raw = localStorage.getItem('mock_item_histories')
    if (!raw) return []
    return JSON.parse(raw).filter(h => h.item_id === 'BD-004').map(h => h.action)
  })
  check('履歴に「一括代理配送完了」が残る', hist.some(a => a.includes('一括代理配送完了')), JSON.stringify(hist))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'pc-proxy-done.png'), fullPage: true })
  await ctx.close()
}

// ============================================================ モバイル・自分
console.log('\n=== モバイル 390x844 / 自分の担当 ===')
{
  const { page, ctx, alerts, errors } = await fresh(390, 844)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle' })
  await settle(page)

  let t = await bodyText(page)
  check('モバイルでも全選択が2件と出る', t.includes('全選択 (2件)'), t.match(/全選択[^\n]*/)?.[0])
  const boxes = page.locator('input[type=checkbox]')
  check('モバイルでチェックボックスが出る', (await boxes.count()) >= 2, `${await boxes.count()}個`)

  await boxes.nth(0).check()
  await settle(page, 700)
  t = await bodyText(page)
  check('1件だけ選ぶと (1) になる', t.includes('一括配送完了 (1)'), t.match(/一括[^\n]*/)?.[0])
  await page.screenshot({ path: path.join(OUT, 'mobile-own-selected.png'), fullPage: true })

  await page.getByRole('button', { name: /一括配送完了/ }).first().click()
  await settle(page, 3500)
  check('1件完了したと出る', alerts.some(a => a.includes('1件の配送が完了しました')), JSON.stringify(alerts))
  check('残りは1件のまま（選んでいない方は動かない）',
    /配送準備完了:\s*1/.test(await bodyText(page)) || (await bodyText(page)).includes('全選択 (1件)'),
    (await bodyText(page)).match(/全選択[^\n]*/)?.[0])
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await ctx.close()
}

// ============================================================ モバイル・代理
console.log('\n=== モバイル 390x844 / 代理配送（今回チェックボックスを足した所） ===')
{
  const { page, ctx, alerts, errors } = await fresh(390, 844)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle' })
  await settle(page)
  await selectAssignee(page, '佐藤花子')

  let t = await bodyText(page)
  check('モバイルでも佐藤花子さんに切り替わる', t.includes('佐藤花子'), t.split('\n')[0])
  const boxes = page.locator('input[type=checkbox]')
  const n = await boxes.count()
  check('モバイルの代理配送にチェックボックスがある（修正前は0個）', n >= 2, `${n}個`)
  const labelled = await page.locator('input[type=checkbox][aria-label*="一括処理に選ぶ"]').count()
  check('チェックボックスに読み上げ用の名前が付いている', labelled >= 2, `${labelled}個`)

  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await settle(page, 700)
  t = await bodyText(page)
  check('モバイルのボタンも「一括代理配送」と名乗る（修正前は一括配送完了）',
    t.includes('一括代理配送 (2)'), t.match(/一括[^\n]*/)?.[0])
  await page.screenshot({ path: path.join(OUT, 'mobile-proxy-selected.png'), fullPage: true })

  await page.getByRole('button', { name: /一括代理配送/ }).first().click()
  await settle(page, 3500)
  check('代理で2件完了したと出る',
    alerts.some(a => a.includes('佐藤花子さんの代理で2件の配送が完了しました')), JSON.stringify(alerts))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'mobile-proxy-done.png'), fullPage: true })
  await ctx.close()
}

// ============================================================ 担当者切替で選択が残らない
console.log('\n=== 担当者を切り替えたときに選択が残らない ===')
{
  const { page, ctx, alerts, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle' })
  await settle(page)
  await page.getByRole('button', { name: /全選択/ }).first().click()
  await settle(page, 700)
  check('自分の担当で2件選べている', (await bodyText(page)).includes('一括配送完了 (2)'))

  await selectAssignee(page, '佐藤花子')
  const t = await bodyText(page)
  check('切り替えると前の選択が消える（幽霊の選択が残らない）',
    !/一括[^\n]*\([1-9]\d*\)/.test(t), t.match(/一括[^\n]*/)?.[0] ?? '(ボタン無し＝正しい)')

  await selectAssignee(page, '田中太郎')
  check('自分に戻すと2件が選べる状態に戻る', (await bodyText(page)).includes('全選択 (2件)'))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await ctx.close()
}

await browser.close()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗   画像: ${OUT}`)
process.exit(fail === 0 ? 0 : 1)
