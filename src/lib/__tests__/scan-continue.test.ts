/**
 * スキャン後に続けて処理する（2026-11-19・田口さん依頼）の判定テスト
 *
 * 背景: 1 台に複数の工程（返却済み → 消毒完了 → メンテナンス完了 → 入庫処理）を続けて行いたいとき、
 *  今は 1 工程ごとにスキャンし直す必要がある。処理ダイアログを成功後に閉じず「完了・次の工程」に
 *  切り替えるため、「どのステータスなら続けられるか」「次の工程に何を出すか」を遷移表に置く。
 *  設計書: docs/superpowers/specs/2026-11-19-scan-continue-design.md
 */
import { describe, it, expect } from 'vitest'
import { STATUS_LABEL, CONTINUABLE_STATUSES, canContinueAfter, getContinueActions, needsConfirm, type ItemStatus } from '../item-status'

// 型チェックゲートの罠回避: ステータスの一覧はリテラルで並べず STATUS_LABEL から取る
const ALL = Object.keys(STATUS_LABEL) as ItemStatus[]

describe('スキャン後に続けられるステータス', () => {
  it('倉庫の中で工程が残っている 6 つだけ続けられる', () => {
    expect([...CONTINUABLE_STATUSES]).toEqual(['returned', 'cleaning', 'maintenance', 'out_of_order', 'unknown', 'demo_cancelled'])
    for (const s of ALL) expect(canContinueAfter(s), s).toBe(CONTINUABLE_STATUSES.includes(s))
  })
})

describe('続ける操作', () => {
  it('どのステータスでも危険な操作（廃棄・寄贈）は含まない', () => {
    for (const s of ALL) {
      for (const a of getContinueActions(s)) expect(needsConfirm(a), `${s}:${a.key}`).toBe(false)
    }
  })
  it('消毒済みの次はメンテナンス完了だけ、故障中の次は修理完了だけ', () => {
    expect(getContinueActions('cleaning').map(a => a.key)).toEqual(['maintenance'])
    expect(getContinueActions('out_of_order').map(a => a.key)).toEqual(['repair'])
  })
})
