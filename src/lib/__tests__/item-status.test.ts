import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getAvailableActions, STATUS_LABEL, needsConfirm, recordName, type ItemStatus } from '../item-status'

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

describe('デモの戻し（袋から出したかで分ける）', () => {
  // 田口さん確定（2026-08-21）
  //   袋から出していない → デモキャン入庫でそのまま倉庫へ
  //   袋から出した       → デモキャンセル（返却と同じ扱い）でフローが回る
  const rented = getAvailableActions('rented')

  it('袋から出した分は消毒ラインに乗る', () => {
    const a = rented.find(x => x.key === 'demo_cancel')
    expect(a?.nextStatus).toBe('returned')
    expect(a?.label).toContain('袋から出した')
  })

  it('未開封はそのまま倉庫へ（消毒を通さない）', () => {
    const a = rented.find(x => x.key === 'demo_cancel_storage')
    expect(a?.nextStatus).toBe('available')
    expect(a?.label).toContain('未開封')
  })

  it('🔴 どちらを押すか、ラベルだけで判断できる', () => {
    // 以前は「デモキャンセル」「デモキャン入庫」で見分けがつかず、
    // 12ヶ月で24台が消毒の記録なしに再貸与されていた
    const labels = rented.map(x => x.label)
    expect(labels.some(l => /袋から出した/.test(l))).toBe(true)
    expect(labels.some(l => /未開封/.test(l))).toBe(true)
  })

  it('返却と同じ行き先になる', () => {
    const ret = rented.find(x => x.key === 'return')
    const demo = rented.find(x => x.key === 'demo_cancel')
    expect(demo?.nextStatus).toBe(ret?.nextStatus)
  })

  it('過去の demo_cancelled からも消毒へ回せる', () => {
    const keys = getAvailableActions('demo_cancelled').map(x => x.key)
    expect(keys).toContain('to_returned')
    expect(keys).toContain('storage')
  })
})

describe('ボタンの文言と、履歴に残す名前を分ける', () => {
  // 🔴 履歴の action は集計の軸。ラベルを変えるとここも変わり、
  //    「年間で何件デモキャンセルがあったか」がその日を境に途切れる。
  //    2026-08-21 にラベルを変えて実際に壊しかけた。
  const rented = getAvailableActions('rented')

  it('デモキャンセルは、ボタンが長くても記録は「デモキャンセル」', () => {
    const a = rented.find(x => x.key === 'demo_cancel')!
    expect(a.label).toContain('袋から出した')
    expect(recordName(a)).toBe('デモキャンセル')
  })

  it('デモキャン入庫も同じ', () => {
    const a = rented.find(x => x.key === 'demo_cancel_storage')!
    expect(recordName(a)).toBe('デモキャン入庫')
  })

  it('🔴 過去12ヶ月のデータと同じ名前で数えられる', () => {
    // 実データに存在する action 名（2026-08-21 時点）
    const 実在 = ['返却', 'デモキャンセル', 'デモキャン入庫', '消毒完了', 'メンテナンス完了', '入庫処理']
    const all = ['rented', 'returned', 'cleaning', 'maintenance']
      .flatMap(s => getAvailableActions(s)).map(recordName)
    for (const name of 実在) expect(all, name).toContain(name)
  })

  it('record を指定していない操作は label がそのまま記録名になる', () => {
    const a = rented.find(x => x.key === 'return')!
    expect(a.record).toBeUndefined()
    expect(recordName(a)).toBe('返却')
  })

  it('履歴を書くところで recordName を通している', () => {
    expect(src('components/scan-action-dialog.tsx')).toMatch(/recordName\(action\)/)
  })
})
