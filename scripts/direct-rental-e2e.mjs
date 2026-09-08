#!/usr/bin/env node
/**
 * ダイレクト貸与を実際にブラウザで通しで動かす（2026-09-08 追加）
 *
 * 田口さん:
 *   「ダイレクト対応は今までほとんど使ってこなかったのでバグに気づかなかった。
 *     でも、これから使いたいから一応修正しておいてほしい」
 *
 * ほとんど使われていなかった経路なので、入口から貸与完了・履歴まで一通り見る。
 * カメラはヘッドレスでは動かせないので手入力の経路を通す。
 *
 * 前提: `npm run dev:demo`
 * 使い方: BASE=http://localhost:5199 node scripts/direct-rental-e2e.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.BASE ?? 'http://localhost:5199').replace(/\/$/, '')
const OUT = process.env.OUT ?? '/tmp/direct-rental-shots'

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

const EXPECTED = /dummy\.supabase\.co|ERR_NAME_NOT_RESOLVED|WebSocket|Weather API key|カメラが見つかりません|Camera error/

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
  page.on('pageerror', e => { if (!EXPECTED.test(e.message)) errors.push(e.message) })
  page.on('console', m => { if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push(m.text()) })
  await page.goto(`${BASE}/menu`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mock_') || k.startsWith('wem_')) localStorage.removeItem(k)
  })
  return { page, ctx, alerts, errors }
}

const settle = (p, ms = 2200) => p.waitForTimeout(ms)
const bodyText = p => p.locator('body').innerText()

async function itemState(page, id) {
  return page.evaluate(itemId => {
    const raw = localStorage.getItem('mock_product_items')
    if (!raw) return '(未保存)'
    const f = JSON.parse(raw).find(i => i.id === itemId)
    return f ? `${f.status}/${f.customer_name ?? '(顧客なし)'}` : '(見つからず)'
  }, id)
}

/** ダイレクト貸与のダイアログを開く。PC はヘッダー、モバイルはフローティングの 🔍 */
async function openDirectRental(page, isMobile) {
  if (isMobile) {
    await page.locator('button:has-text("🔍")').first().click()
  } else {
    await page.getByRole('button', { name: /ダイレクト貸与/ }).first().click()
  }
  await settle(page, 1500)
}

// ================================================== PC
console.log('\n=== PC 1440x1000 ===')
{
  const { page, ctx, alerts, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'domcontentloaded' })
  await settle(page)

  check('PC のマイページにダイレクト貸与の入口がある（修正前は無かった）',
    await page.getByRole('button', { name: /ダイレクト貸与/ }).first().isVisible().catch(() => false))

  await openDirectRental(page, false)
  let t = await bodyText(page)
  check('ダイアログが開く', t.includes('貸与する商品のQRコードをスキャン'), t.slice(0, 60))
  check('PC は既定で手入力になっている', t.includes('管理番号を入力'))
  await page.screenshot({ path: path.join(OUT, 'pc-scan-dialog.png') })

  // 小文字で入力（修正前は大文字小文字を区別して見つからなかった）
  await page.locator('#directRentalInput').fill('wc-001')
  await page.getByRole('button', { name: '確認' }).click()
  await settle(page, 1800)
  t = await bodyText(page)
  check('小文字で入力しても見つかる', t.includes('WC-001'), t.match(/エラー[\s\S]{0,60}/)?.[0] ?? '')
  check('貸与情報の入力に進む', t.includes('顧客名'))

  await page.locator('#directCustomerName').fill('テスト利用者PC')
  await page.screenshot({ path: path.join(OUT, 'pc-form.png') })
  await page.getByRole('button', { name: /貸与(を)?開始|実行|登録/ }).first().click().catch(async () => {
    // ボタン名が違う場合に備えて最後のボタンを押す
    const btns = page.getByRole('button')
    await btns.nth(await btns.count() - 1).click()
  })
  await settle(page, 3000)

  check('貸与が開始されたと出る', alerts.some(a => a.includes('貸与が開始されました')), JSON.stringify(alerts))
  check('WC-001 が貸与中になった', (await itemState(page, 'WC-001')).startsWith('rented'), await itemState(page, 'WC-001'))
  check('顧客名が入っている', (await itemState(page, 'WC-001')).includes('テスト利用者PC'), await itemState(page, 'WC-001'))

  const hist = await page.evaluate(() => {
    const raw = localStorage.getItem('mock_item_histories')
    return raw ? JSON.parse(raw).filter(h => h.item_id === 'WC-001').map(h => h.action) : []
  })
  check('履歴に「ダイレクト貸与」が残る', hist.some(a => a.includes('ダイレクト貸与')), JSON.stringify(hist))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await ctx.close()
}

// ================================================== 貸せない個体
console.log('\n=== 貸せない個体を弾く ===')
{
  const { page, ctx, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await openDirectRental(page, false)

  // WC-003 は貸与中（デモデータ）
  await page.locator('#directRentalInput').fill('WC-003')
  await page.getByRole('button', { name: '確認' }).click()
  await settle(page, 1500)
  let t = await bodyText(page)
  check('貸与中の個体は弾く', t.includes('貸与中'), t.match(/この商品[^\n]*/)?.[0] ?? t.slice(0, 80))
  check('誰に貸しているかも出る', t.includes('デモ利用者A'), t.match(/この商品[^\n]*/)?.[0] ?? '')

  // 「再入力」で復帰できるか
  await page.getByRole('button', { name: '再入力' }).click()
  await settle(page, 800)
  // QR- 付きでも拾えるか（WK-001 は利用可能）
  await page.locator('#directRentalInput').fill('QR-WK-001')
  await page.keyboard.press('Enter')
  await settle(page, 1800)
  t = await bodyText(page)
  check('QR- 付きでも拾える', t.includes('WK-001'), t.match(/エラー[\s\S]{0,60}/)?.[0] ?? '')
  check('Enter キーで確定できる', t.includes('顧客名'))

  // 存在しない番号
  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle(page)
  await openDirectRental(page, false)
  await page.locator('#directRentalInput').fill('NOPE-999')
  await page.getByRole('button', { name: '確認' }).click()
  await settle(page, 1200)
  check('存在しない番号は理由が出る', (await bodyText(page)).includes('該当する商品が見つかりません'))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'pc-errors.png') })
  await ctx.close()
}

// ================================================== モバイル
console.log('\n=== モバイル 390x844 ===')
{
  const { page, ctx, alerts, errors } = await fresh(390, 844)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'domcontentloaded' })
  await settle(page)

  await openDirectRental(page, true)
  let t = await bodyText(page)
  check('モバイルでもダイアログが開く', t.includes('貸与する商品のQRコードをスキャン'), t.slice(0, 60))

  await page.locator('#directRentalInputMobile').fill('bd-001')
  await page.keyboard.press('Enter')
  await settle(page, 1800)
  t = await bodyText(page)
  check('モバイルでも小文字＋Enterで進む', t.includes('顧客名'), t.match(/エラー[\s\S]{0,60}/)?.[0] ?? '')

  await page.locator('#directCustomerNameMobile').fill('テスト利用者モバイル')
  await page.screenshot({ path: path.join(OUT, 'mobile-form.png') })
  const btns = page.getByRole('button')
  await btns.nth(await btns.count() - 1).click()
  await settle(page, 3000)

  check('モバイルでも貸与が完了する', alerts.some(a => a.includes('貸与が開始されました')), JSON.stringify(alerts))
  check('BD-001 が貸与中になった', (await itemState(page, 'BD-001')).startsWith('rented'), await itemState(page, 'BD-001'))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await ctx.close()
}

// ================================================== 途中で他の人に取られた場合
console.log('\n=== 入力中に他の人がその個体を貸してしまった場合 ===')
{
  const { page, ctx, alerts, errors } = await fresh(1440, 1000)
  await page.goto(`${BASE}/mypage`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await openDirectRental(page, false)

  await page.locator('#directRentalInput').fill('WK-001')
  await page.getByRole('button', { name: '確認' }).click()
  await settle(page, 1800)
  check('利用可能なので入力画面に進む', (await bodyText(page)).includes('顧客名'))

  // 顧客名を入れている間に、別の人が同じ個体を貸した状況を作る
  await page.evaluate(() => {
    const raw = localStorage.getItem('mock_product_items')
    const items = raw ? JSON.parse(raw) : []
    const target = items.find(i => i.id === 'WK-001')
    if (target) {
      target.status = 'rented'
      target.customer_name = '先に借りた人'
      localStorage.setItem('mock_product_items', JSON.stringify(items))
    }
  })

  await page.locator('#directCustomerName').fill('あとから来た人')
  const btns = page.getByRole('button')
  await btns.nth(await btns.count() - 1).click()
  await settle(page, 3000)

  const t = await bodyText(page)
  check('二重貸与を止める', t.includes('読み取ったあとに状態が変わりました'), t.match(/この商品[^\n]*/)?.[0] ?? t.slice(0, 100))
  check('先に借りた人の記録を上書きしない',
    (await itemState(page, 'WK-001')).includes('先に借りた人'), await itemState(page, 'WK-001'))
  check('成功の通知は出さない', !alerts.some(a => a.includes('貸与が開始されました')), JSON.stringify(alerts))
  check('JSエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '))
  await page.screenshot({ path: path.join(OUT, 'pc-conflict.png') })
  await ctx.close()
}

await browser.close()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 件成功 / ${fail} 件失敗   画像: ${OUT}`)
process.exit(fail === 0 ? 0 : 1)
