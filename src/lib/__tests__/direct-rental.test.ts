import { describe, it, expect } from 'vitest'
import { resolveScannedItem, checkRentable } from '../direct-rental'

/**
 * ダイレクト貸与（発注を通さず、その場で貸与を開始する）の判定
 *
 * 田口さん（2026-09-08）:
 *   「ダイレクト対応は今までほとんど使ってこなかったのでバグに気づかなかった。
 *     でも、これから使いたいから一応修正しておいてほしい」
 *
 * 使われていなかったぶん、個体の探し方がアプリの他の場所と食い違っていた。
 */

const item = (over: Record<string, unknown> = {}) => ({
  id: 'WC-001',
  product_id: 'PRD-1',
  status: 'available',
  condition: 'good',
  location: '倉庫',
  qr_code: 'WC-001',
  ...over,
}) as never

describe('resolveScannedItem', () => {
  const items = [
    item({ id: 'WC-001', qr_code: 'WC-001' }),
    item({ id: 'BD-002', qr_code: 'QR-BD-002' }),
  ]

  it('管理番号で見つかる', () => {
    expect(resolveScannedItem(items, 'WC-001')?.id).toBe('WC-001')
  })

  // 以前は id しか見ておらず、qr_code が管理番号と違う個体は
  // 「見つかりません」になっていた（商品検索では見つかるのに）
  it('QRコードの値が管理番号と違っても見つかる', () => {
    expect(resolveScannedItem(items, 'QR-BD-002')?.id).toBe('BD-002')
  })

  it('QR- のプレフィックスは付いていても外れていてもよい', () => {
    expect(resolveScannedItem(items, 'QR-WC-001')?.id).toBe('WC-001')
    expect(resolveScannedItem(items, 'BD-002')?.id).toBe('BD-002')
  })

  // 手入力を受け付けるので、大文字小文字で落とさない
  it('大文字小文字を区別しない', () => {
    expect(resolveScannedItem(items, 'wc-001')?.id).toBe('WC-001')
    expect(resolveScannedItem(items, 'Wc-001')?.id).toBe('WC-001')
  })

  it('前後の空白を無視する', () => {
    expect(resolveScannedItem(items, '  WC-001  ')?.id).toBe('WC-001')
  })

  it('無いものは null', () => {
    expect(resolveScannedItem(items, 'NOPE-999')).toBeNull()
    expect(resolveScannedItem(items, '')).toBeNull()
    expect(resolveScannedItem(items, '   ')).toBeNull()
  })

  it('管理番号の一致を qr_code の一致より優先する', () => {
    const tricky = [
      item({ id: 'A-1', qr_code: 'B-2' }),
      item({ id: 'B-2', qr_code: 'C-3' }),
    ]
    expect(resolveScannedItem(tricky, 'B-2')?.id).toBe('B-2')
  })
})

describe('checkRentable', () => {
  it('利用可能なら貸せる', () => {
    expect(checkRentable(item({ status: 'available' }))).toEqual({ ok: true })
  })

  it('貸与中のものは貸せない。理由を日本語で返す', () => {
    const r = checkRentable(item({ status: 'rented', customer_name: '山田' }))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('貸与中')
  })

  it('貸与中なら誰に貸しているかも伝える', () => {
    const r = checkRentable(item({ status: 'rented', customer_name: '山田' }))
    expect(r.reason).toContain('山田')
  })

  it('文言は共通の表（item-status.ts）を使う', () => {
    // 田口さんが統一した「消毒済み」。ここで独自に「消毒中」と書かない
    expect(checkRentable(item({ status: 'cleaning' })).reason).toContain('消毒済み')
  })

  it('準備済みや消毒中も貸せない', () => {
    expect(checkRentable(item({ status: 'ready_for_delivery' })).ok).toBe(false)
    expect(checkRentable(item({ status: 'cleaning' })).ok).toBe(false)
    expect(checkRentable(item({ status: 'maintenance' })).ok).toBe(false)
    expect(checkRentable(item({ status: 'reserved' })).ok).toBe(false)
  })

  it('個体が無ければ貸せない', () => {
    expect(checkRentable(null).ok).toBe(false)
  })

  it('知らないステータスでも落ちずに理由を返す', () => {
    const r = checkRentable(item({ status: 'nonsense' }))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('nonsense')
  })
})

// ステータスの日本語は item-status.ts が持つ（item-status.test.ts で担保）。
// ここで2つ目の表を作らないこと。
