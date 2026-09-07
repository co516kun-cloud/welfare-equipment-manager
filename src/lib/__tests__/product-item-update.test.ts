/**
 * 個体の部分更新を組み立てるヘルパーのテスト
 *
 * 背景（2026-09-07）:
 *  supabaseDb.saveProductItem は渡されたオブジェクトをそのまま upsert し、
 *  customer_name / loan_start_date / condition_notes が undefined なら **null で上書き**する
 *  （supabase-database.ts:297-303）。
 *
 *  search.tsx / inventory.tsx / item-detail.tsx は「不要なプロパティを除外」と称して
 *  9 フィールドだけの部分オブジェクトを組み立てて渡していた。その結果:
 *   - condition_notes（メンテナンス済み・入庫処理時の状態メモ）が保存のたびに消える
 *   - ProductItem に存在しない notes を送っている
 *   - photos / current_setting / total_rental_days は列ごと送らないので upsert では残るが、
 *     「何が残って何が消えるか」がフィールドごとに違い、読んで分からない
 *
 *  さらに検索画面の selectedItem は {...item, product, category} で、
 *  そのまま展開すると Supabase に存在しない列（product / category）を送ってしまう。
 *
 *  だから「ProductItem の列だけを取り出して差分を当てる」を1か所に閉じ込める。
 */
import { describe, it, expect } from 'vitest'
import { buildProductItemUpdate } from '../product-item-update'
import type { ProductItem } from '../../types'

const base: ProductItem = {
  id: 'WC-001',
  product_id: 'P1',
  status: 'maintenance',
  condition: 'good',
  location: '倉庫',
  qr_code: 'WC-001',
  condition_notes: '左ブレーキ調整済み',
  photos: ['data:image/jpeg;base64,AAA'],
  current_setting: '2M',
  total_rental_days: 42,
  customer_name: undefined,
  loan_start_date: undefined,
}

describe('buildProductItemUpdate', () => {
  it('差分に無いフィールドは元の値を保つ（condition_notes が消えない）', () => {
    const r = buildProductItemUpdate(base, { status: 'available' })
    expect(r.status).toBe('available')
    expect(r.condition_notes).toBe('左ブレーキ調整済み')
    expect(r.photos).toEqual(['data:image/jpeg;base64,AAA'])
    expect(r.current_setting).toBe('2M')
    expect(r.total_rental_days).toBe(42)
  })

  it('ProductItem に無いフィールドは落とす（product / category / notes を Supabase に送らない）', () => {
    const withExtras = {
      ...base,
      product: { id: 'P1', name: '車いす' },
      category: { id: 'C1', name: '車いす' },
      notes: '消えたはずのフィールド',
    } as unknown as ProductItem
    const r = buildProductItemUpdate(withExtras, { condition: 'fair' })
    expect(r).not.toHaveProperty('product')
    expect(r).not.toHaveProperty('category')
    expect(r).not.toHaveProperty('notes')
    expect(r.condition).toBe('fair')
    expect(r.id).toBe('WC-001')
  })

  it('差分で明示的に undefined を渡したフィールドはクリアする（返却で貸与先を消す用途）', () => {
    const rented: ProductItem = { ...base, status: 'rented', customer_name: '山田様', loan_start_date: '2026-08-01' }
    const r = buildProductItemUpdate(rented, {
      status: 'returned',
      customer_name: undefined,
      loan_start_date: undefined,
    })
    expect(r.status).toBe('returned')
    // キー自体は残す。saveProductItem が undefined を null に変換して DB からクリアする
    expect('customer_name' in r).toBe(true)
    expect(r.customer_name).toBeUndefined()
    expect(r.loan_start_date).toBeUndefined()
    // 関係ないメモは巻き添えにしない
    expect(r.condition_notes).toBe('左ブレーキ調整済み')
  })

  it('元の個体が持っていない任意フィールドは、キーごと作らない', () => {
    const bare: ProductItem = {
      id: 'BD-002', product_id: 'P2', status: 'available', condition: 'good',
      location: '倉庫', qr_code: 'BD-002',
    }
    const r = buildProductItemUpdate(bare, { location: 'A-1' })
    expect(r.location).toBe('A-1')
    expect('photos' in r).toBe(false)
    expect('total_rental_days' in r).toBe(false)
  })

  it('元のオブジェクトを書き換えない', () => {
    const snapshot = JSON.stringify(base)
    buildProductItemUpdate(base, { status: 'rented', customer_name: '田中様' })
    expect(JSON.stringify(base)).toBe(snapshot)
  })
})
