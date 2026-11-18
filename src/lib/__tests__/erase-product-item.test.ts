/**
 * 個体の完全消去（管理者限定）のテスト
 *
 * 背景（2026-11-18・田口さん依頼）:
 *  登録ミス・重複で作ってしまった個体を、履歴・印刷キューごと DB から跡形なく消す。
 *  消す処理は Postgres 関数 erase_product_item（sql/add-erase-product-item.sql）に置き、
 *  アプリ側はここでテストする判定（消せるステータス・貸与の記録・管理者・エラー文言）を持つ。
 *  設計書: docs/superpowers/specs/2026-11-18-erase-product-item-design.md
 */
import { describe, it, expect } from 'vitest'
import { STATUS_LABEL, ERASE_BLOCKED_STATUSES, canEraseItem, isRentalRecord, type ItemStatus } from '../item-status'

// 型チェックゲートの罠回避: ステータスの一覧はリテラルで並べず STATUS_LABEL から取る
const ALL = Object.keys(STATUS_LABEL) as ItemStatus[]

describe('完全消去できるステータス', () => {
  it('貸与中・予約済み・配送準備完了の 3 つだけ消せない', () => {
    expect([...ERASE_BLOCKED_STATUSES]).toEqual(['rented', 'reserved', 'ready_for_delivery'])
    for (const s of ALL) {
      expect(canEraseItem(s), s).toBe(!ERASE_BLOCKED_STATUSES.includes(s))
    }
  })
})

describe('貸与の記録の判定', () => {
  it('貸与中に入った行・貸与中から出た行は貸与の記録', () => {
    expect(isRentalRecord({ from_status: 'available', to_status: 'rented' })).toBe(true)
    expect(isRentalRecord({ from_status: 'rented', to_status: 'returned' })).toBe(true)
  })
  it('貸与中を通らない行は貸与の記録ではない', () => {
    expect(isRentalRecord({ from_status: 'returned', to_status: 'cleaning' })).toBe(false)
    expect(isRentalRecord({ from_status: 'unknown', to_status: 'available' })).toBe(false)
  })
})
