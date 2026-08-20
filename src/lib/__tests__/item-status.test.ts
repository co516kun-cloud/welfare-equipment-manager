import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getAvailableActions, STATUS_LABEL, needsConfirm, type ItemStatus } from '../item-status'

const ALL: ItemStatus[] = [
  'available', 'reserved', 'ready_for_delivery', 'rented', 'returned',
  'cleaning', 'maintenance', 'demo_cancelled', 'out_of_order', 'unknown', 'disposed',
]

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8')

describe('廃棄ステータス', () => {
  it('全ステータスに表示名がある', () => {
    for (const s of ALL) expect(STATUS_LABEL[s], s).toBeTruthy()
    expect(STATUS_LABEL.disposed).toBe('廃棄済み')
  })

  // 田口さんの依頼: 「返却、消毒、メンテナンス、入庫処理の際のQRスキャンの項目に廃棄を加えて」
  it.each([
    ['rented', '返却の場面'],
    ['returned', '消毒の場面'],
    ['cleaning', 'メンテナンスの場面'],
    ['maintenance', '入庫処理の場面'],
  ])('%s（%s）で廃棄を選べる', (status) => {
    const keys = getAvailableActions(status).map(a => a.key)
    expect(keys).toContain('dispose')
  })

  it('廃棄は確認を求める（誤タップ防止）', () => {
    const dispose = getAvailableActions('returned').find(a => a.key === 'dispose')
    expect(dispose?.nextStatus).toBe('disposed')
    expect(needsConfirm(dispose)).toBe(true)
    // 通常の操作は確認を挟まない（毎回聞かれると意味を失う）
    expect(needsConfirm(getAvailableActions('returned').find(a => a.key === 'clean'))).toBe(false)
  })

  it('廃棄からは必ず戻れる（誤タップの復旧路がある）', () => {
    const keys = getAvailableActions('disposed').map(a => a.key)
    expect(keys).toContain('undispose')
  })

  it('廃棄は「要修理」に上書きされない', () => {
    // 以前は condition==='needs_repair' なら無条件に out_of_order へ倒していたため、
    // 壊れた個体を廃棄しようとすると故障中になっていた。
    const s = src('components/scan-action-dialog.tsx')
    expect(s).toMatch(/action\.nextStatus === 'disposed'/)
  })
})

describe('unknown のスキャン', () => {
  it('操作が1つ以上出る（以前は空で、押しても無反応だった）', () => {
    expect(getAvailableActions('unknown').length).toBeGreaterThan(0)
  })

  it('貸与中・廃棄のどちらにも振り分けられる', () => {
    const keys = getAvailableActions('unknown').map(a => a.key)
    expect(keys).toContain('set_rented')
    expect(keys).toContain('dispose')
  })
})

describe('ready_for_delivery（配送待ちで止まった個体）', () => {
  it('QRを読んだときに操作が出る（以前はどちらのファイルにも case が無かった）', () => {
    expect(getAvailableActions('ready_for_delivery').length).toBeGreaterThan(0)
  })

  it('在庫へ戻す道がある', () => {
    const back = getAvailableActions('ready_for_delivery').find(a => a.nextStatus === 'available')
    expect(back).toBeDefined()
  })
})

describe('遷移表がひとつしかない', () => {
  it('scan.tsx とダイアログが同じ関数を使う', () => {
    for (const f of ['pages/scan.tsx', 'components/scan-action-dialog.tsx']) {
      const s = src(f)
      expect(s, f).toMatch(/from '.*lib\/item-status'/)
      // 自前の switch を持っていないこと（持つと片方だけ直す事故が戻る）
      expect(s, f).not.toMatch(/case 'cleaning':\s*\n\s*actions\.push/)
    }
  })

  it('操作が無いときに黙って終わらない', () => {
    const s = src('components/scan-action-dialog.tsx')
    expect(s).toMatch(/if \(!action\) \{/)
    expect(s).toMatch(/console\.warn\('\[scan\]/)
  })
})

describe('既存の動きを壊していない', () => {
  it.each([
    ['rented', 'return'],
    ['returned', 'clean'],
    ['cleaning', 'maintenance'],
    ['maintenance', 'storage'],
    ['demo_cancelled', 'storage'],
    ['out_of_order', 'repair'],
  ])('%s の主動線 %s が残っている', (status, key) => {
    expect(getAvailableActions(status).map(a => a.key)).toContain(key)
  })

  it('available は発注の有無で出し分ける', () => {
    expect(getAvailableActions('available', { hasAvailableOrders: true }).map(a => a.key))
      .toContain('assign_to_order')
    expect(getAvailableActions('available', { hasAvailableOrders: false }).map(a => a.key))
      .toContain('rent_directly')
  })

  it('未知の値には何も出さない（落ちない）', () => {
    expect(getAvailableActions('nonexistent')).toEqual([])
  })
})

describe('画面表示への反映', () => {
  it.each([
    'pages/inventory.tsx', 'pages/history.tsx', 'pages/item-detail.tsx',
    'pages/search.tsx', 'pages/scan.tsx', 'pages/mypage.tsx', 'pages/preparation.tsx',
  ])('%s に廃棄の表示がある', (f) => {
    expect(src(f)).toMatch(/disposed/)
  })

  it('廃棄は故障中と別の見た目にする（赤にしない）', () => {
    const s = src('pages/inventory.tsx')
    expect(s).toMatch(/case 'disposed': return 'bg-muted text-muted-foreground'/)
  })
})
