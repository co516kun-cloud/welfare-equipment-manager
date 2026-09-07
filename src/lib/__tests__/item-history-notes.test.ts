/**
 * 履歴の備考（notes）が保存されることのテスト
 *
 * 背景（2026-09-07）:
 *  item_histories テーブルには notes 列がある（create-item-histories-table.sql:15）。
 *  MCP サーバの writeHistory は実際にそこへ書いており、本番で動いている。
 *  一方アプリ側の createItemHistory は details に notes を受け取る口が無く、
 *  呼び出し側（search / inventory / item-detail）が渡している notes を黙って捨てていた。
 *
 *  結果:
 *   - 検索画面のステータス変更ダイアログの「メモ」入力が、押した瞬間に消える
 *   - 履歴画面の CSV「備考」列とタイムラインの備考表示が常に空
 *
 *  同じ列を MCP は書きアプリは書かない、という食い違いも解消する。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

const insert = vi.fn()
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (payload: unknown) => {
        insert(payload)
        return Promise.resolve({ error: null })
      },
    })),
    auth: { getUser: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}))
vi.mock('../mock-database', () => ({ mockDb: {} }))

import { supabaseDb } from '../supabase-database'

describe('supabaseDb.createItemHistory の notes', () => {
  beforeEach(() => insert.mockReset())

  it('details.notes を item_histories.notes に保存する', async () => {
    await supabaseDb.createItemHistory('WC-001', 'ステータス変更', 'available', 'rented', 'テスト太郎', {
      notes: '利用者宅で調整が必要',
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toMatchObject({
      item_id: 'WC-001',
      action: 'ステータス変更',
      from_status: 'available',
      to_status: 'rented',
      performed_by: 'テスト太郎',
      notes: '利用者宅で調整が必要',
    })
  })

  it('notes と condition_notes は別物として両方保存できる', async () => {
    await supabaseDb.createItemHistory('WC-002', 'メンテナンス完了', 'cleaning', 'maintenance', 'テスト', {
      notes: '操作メモ',
      conditionNotes: '左ブレーキ調整済み',
    })

    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.notes).toBe('操作メモ')
    expect(payload.condition_notes).toBe('左ブレーキ調整済み')
  })

  it('notes を渡さなければ undefined のまま（既存の呼び出しを壊さない）', async () => {
    await supabaseDb.createItemHistory('WC-003', '入庫処理', 'maintenance', 'available', 'テスト')

    const payload = insert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.notes).toBeUndefined()
    expect(payload.item_id).toBe('WC-003')
  })
})
