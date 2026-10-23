import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { needsUsedIntake, usedIntakeSteps } from '../item-status'

const src = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8')

// 2026-10-23 田口さん「新品登録する際は『新品』って入れるから、そうじゃないやつは全部」
describe('中古で新規登録したときの 消毒→メンテ→入庫', () => {
  it('状態メモに「新品」があれば新品、無ければ中古', () => {
    expect(needsUsedIntake('新品')).toBe(false)
    expect(needsUsedIntake('新品・未開封')).toBe(false)
    expect(needsUsedIntake('小傷あり')).toBe(true)
    expect(needsUsedIntake('')).toBe(true)
    expect(needsUsedIntake(undefined)).toBe(true)
  })

  it('消毒作業管理が数える3つの操作名で残す', () => {
    // work-management.tsx はこの3つの action 名で数えている
    expect(usedIntakeSteps().map(s => s.action)).toEqual(['消毒完了', 'メンテナンス完了', '入庫処理'])
  })

  it('状態の並びがつながっていて、最後は利用可能', () => {
    const steps = usedIntakeSteps()
    expect(steps[0].from).toBe('returned')
    for (let i = 1; i < steps.length; i++) expect(steps[i].from).toBe(steps[i - 1].to)
    expect(steps[steps.length - 1].to).toBe('available')
  })

  it('消毒作業管理の取得条件に3行とも当たる', () => {
    // getWorkHistories: to_status が cleaning/maintenance、または available かつ 入庫処理
    for (const s of usedIntakeSteps()) {
      const hit = ['cleaning', 'maintenance'].includes(s.to) || (s.to === 'available' && s.action === '入庫処理')
      expect(hit, s.action).toBe(true)
    }
  })

  it('アプリの新規登録画面と MCP の両方が同じ判定を使う', () => {
    expect(src('src/components/new-item-dialog.tsx')).toMatch(/needsUsedIntake\(/)
    expect(src('mcp-server/src/index.ts')).toMatch(/needsUsedIntake\(/)
  })
})
