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
import { isAdminUser } from '../admin'
import { ERASE_ERROR, toEraseErrorMessage, toEraseResult } from '../erase-product-item'

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

describe('管理者判定', () => {
  it('app_metadata.role が admin のときだけ管理者', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true)
    expect(isAdminUser({ app_metadata: { role: 'staff' } })).toBe(false)
    expect(isAdminUser({ app_metadata: {} })).toBe(false)
    expect(isAdminUser({})).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
  })
  it('デモモードの auth_user（localStorage の形）も同じ判定で通る', () => {
    const demoUser = JSON.parse(JSON.stringify({ id: 'USER-1', email: 'tanaka@example.com', user_metadata: { name: '田中太郎' }, app_metadata: { role: 'admin' } }))
    expect(isAdminUser(demoUser)).toBe(true)
  })
})

describe('消去エラーの日本語化', () => {
  it.each([
    [ERASE_ERROR.NOT_ADMIN, '管理者だけが実行できます'],
    [ERASE_ERROR.NOT_FOUND, 'この個体はすでに存在しません'],
    [ERASE_ERROR.IN_USE, '貸与中・予約済み・配送準備完了の個体は消去できません。先に返却や取り消しを済ませてください'],
    [ERASE_ERROR.ASSIGNED, '進行中の発注に割り当てられている個体は消去できません。先にその発注（明細）を取り消すか、配送を済ませてください'],
  ])('%s → 決まった文言', (code, expected) => {
    expect(toEraseErrorMessage({ message: code })).toBe(expected)
  })
  it('関数が DB に無いときは SQL 未適用だと分かる文言', () => {
    const expected = '消去機能が DB 側にまだ入っていません。管理者に SQL の適用を確認してください'
    expect(toEraseErrorMessage({ code: 'PGRST202', message: 'Could not find the function public.erase_product_item(p_item_id) in the schema cache' })).toBe(expected)
    expect(toEraseErrorMessage({ code: '42883', message: 'function public.erase_product_item(text) does not exist' })).toBe(expected)
  })
  it('知らないエラーは元の文言を添える', () => {
    expect(toEraseErrorMessage({ message: 'network down' })).toBe('消去に失敗しました（network down）')
    expect(toEraseErrorMessage(null)).toBe('消去に失敗しました（原因不明のエラー）')
  })
})

describe('消去結果の整形', () => {
  it('jsonb の件数を数値に揃え、欠けていれば 0', () => {
    expect(toEraseResult({ histories: 5, label_queue: '1', preparation_tasks: 0 })).toEqual({ histories: 5, label_queue: 1, preparation_tasks: 0 })
    expect(toEraseResult(null)).toEqual({ histories: 0, label_queue: 0, preparation_tasks: 0 })
  })
})
