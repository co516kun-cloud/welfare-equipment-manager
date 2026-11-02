import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getAvailableActions, STATUS_LABEL, needsConfirm, recordName, leavesInventory } from '../item-status'

// 施設・利用者への寄贈（2026-11-02・田口さん依頼）
//   「入庫になっている商品が対象」「残すのは担当者と施設名 or 利用者名だけ」
//   「担当者は発注の時と同様にプルダウンでの選択」
const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8')
const root = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8')

describe('寄贈の遷移', () => {
  it('表示名は「寄贈済み」', () => {
    expect(STATUS_LABEL.donated).toBe('寄贈済み')
  })

  it('利用可能（入庫済み）の台からは、発注の有無に関係なく寄贈できる', () => {
    for (const hasAvailableOrders of [true, false]) {
      const a = getAvailableActions('available', { hasAvailableOrders }).find(x => x.key === 'donate')
      expect(a?.nextStatus).toBe('donated')
    }
  })

  it.each(['rented', 'returned', 'cleaning', 'maintenance', 'out_of_order', 'unknown', 'disposed', 'reserved'])(
    '%s からは寄贈できない（対象は入庫済みだけ）', (status) => {
      expect(getAvailableActions(status).map(a => a.key)).not.toContain('donate')
    })

  it('寄贈は実行前に確認を挟む（誤タップ防止）', () => {
    expect(needsConfirm(getAvailableActions('available').find(a => a.key === 'donate'))).toBe(true)
  })

  it('取り消すと利用可能に戻る', () => {
    const undo = getAvailableActions('donated')
    expect(undo).toHaveLength(1)
    expect(undo[0].key).toBe('undonate')
    expect(undo[0].nextStatus).toBe('available')
  })

  it('履歴の操作名は「寄贈」「寄贈取り消し」で固定（集計の軸）', () => {
    expect(recordName(getAvailableActions('available').find(a => a.key === 'donate')!)).toBe('寄贈')
    expect(recordName(getAvailableActions('donated')[0])).toBe('寄贈取り消し')
  })

  it('寄贈・廃棄は在庫から外れる行き先として「要修理→故障中」より優先される', () => {
    expect(leavesInventory('donated')).toBe(true)
    expect(leavesInventory('disposed')).toBe(true)
    expect(leavesInventory('available')).toBe(false)
    expect(leavesInventory('out_of_order')).toBe(false)
  })
})

describe('寄贈ダイアログ', () => {
  const s = src('components/scan-action-dialog.tsx')

  it('担当者は発注と同じく users のプルダウンで選ぶ', () => {
    expect(s).toMatch(/id="donationAssignee"/)
    expect(s).toMatch(/users\.map\(user =>/)
    expect(s).toMatch(/const \{ items, users \} = useInventoryStore\(\)/)
  })

  it('担当者と寄贈先の両方が無ければ進めない', () => {
    expect(s).toMatch(/isDonation && \(!donationAssignee \|\| !recipient\)/)
  })

  it('履歴の実行者は選んだ担当者、寄贈先は customerName と備考に残す', () => {
    expect(s).toMatch(/isDonation \? donationAssignee : getCurrentUserName\(\)/)
    expect(s).toMatch(/寄贈先: \$\{recipient\}/)
  })

  it('取り消しでは消す前の寄贈先を履歴に残す', () => {
    expect(s).toMatch(/取り消した寄贈先/)
    expect(s).toMatch(/isUndonation \? selectedItem\.customer_name/)
  })
})

describe('MCP 側', () => {
  const m = root('mcp-server/src/index.ts')

  it('寄贈先と担当者が無い寄贈は通さない', () => {
    expect(m).toMatch(/action\.key === "donate" && \(!donatedTo \|\| !a\.performed_by\?\.trim\(\)\)/)
  })

  it('要修理の判定はアプリと共有の leavesInventory を使う', () => {
    expect(m).toMatch(/leavesInventory\(action\.nextStatus\) \|\| newCondition !== "needs_repair"/)
  })

  it('一気通貫（run_flow）の順路に寄贈は入っていない', () => {
    const flow = m.slice(m.indexOf('const FLOW_STEP'), m.indexOf('};', m.indexOf('const FLOW_STEP')))
    expect(flow).not.toMatch(/donate/)
  })
})

describe('画面表示への反映', () => {
  it.each([
    'pages/inventory.tsx', 'pages/history.tsx', 'pages/item-detail.tsx',
    'pages/search.tsx', 'pages/scan.tsx', 'pages/preparation.tsx',
  ])('%s に寄贈済みの表示がある', (f) => {
    expect(src(f)).toMatch(/寄贈済み/)
  })
})
