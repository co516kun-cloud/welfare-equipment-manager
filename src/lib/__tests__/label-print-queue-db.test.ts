/**
 * label_print_queue の「再印刷」＝行を pending に戻す処理のテスト
 *
 * 失敗した行・印刷済みの行を、印刷エージェントがもう一度拾えるように戻す。
 * 前回の結果（printed_at / printed_by / error_message）はここで消す。
 * 消さないと、状況ページに「完了」と「印刷待ち」が同時に見える行ができる。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// useMockDatabase() を false にする（未設定だとモック DB に逃げて何もしない）
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

const update = vi.fn()
const eq = vi.fn()
let nextError: { message: string } | null = null

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (payload: unknown) => {
        update(payload)
        return {
          eq: (col: string, val: string) => {
            eq(col, val)
            return Promise.resolve({ error: nextError })
          },
        }
      },
    })),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}))
vi.mock('../mock-database', () => ({ mockDb: {} }))

import { supabaseDb } from '../supabase-database'

describe('supabaseDb.requeueLabelPrint', () => {
  beforeEach(() => {
    update.mockReset()
    eq.mockReset()
    nextError = null
  })

  it('status を pending に戻し、前回の印刷結果を消す', async () => {
    await supabaseDb.requeueLabelPrint('q-1')

    expect(eq).toHaveBeenCalledWith('id', 'q-1')
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).toEqual({
      status: 'pending',
      error_message: null,
      printed_at: null,
      printed_by: null,
      updated_at: expect.any(String),
    })
  })

  it('Supabase がエラーを返したら throw する（画面側で失敗を出せるように）', async () => {
    nextError = { message: 'permission denied' }
    await expect(supabaseDb.requeueLabelPrint('q-2')).rejects.toBeTruthy()
  })
})
