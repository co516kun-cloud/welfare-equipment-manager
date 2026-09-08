import { describe, it, expect } from 'vitest'
import {
  selectableDeliveryIds,
  isAllDeliverySelected,
  pruneSelection,
  resolveBatchDeliveryTargets,
  summarizeBatchDelivery,
} from '../batch-delivery'

/**
 * 一括配送（代理配送を含む）の選択ロジック
 *
 * 田口さんの指摘（2026-09-08）:
 *   「配送完了を押すときの一括処理ができる場合とできない場合がある。
 *     他の人の処理をするときの代理配送の場合も、全部一括処理が効くようにしてほしい」
 *
 * mypage.tsx の実装には以下の穴があった。ここはその再発防止。
 */

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ORD-1-OI-1-0',
  orderItemId: 'OI-1',
  assignedItemId: 'KB-001',
  readyForDelivery: true,
  name: '車椅子',
  customer: '山田',
  ...over,
})

describe('selectableDeliveryIds', () => {
  it('配送準備完了のものだけを一括処理の対象にする', () => {
    const items = [
      item({ id: 'a' }),
      item({ id: 'b', readyForDelivery: false }),
      item({ id: 'c' }),
    ]
    expect(selectableDeliveryIds(items)).toEqual(['a', 'c'])
  })

  it('idが無いものは対象外（Setに入れると別物と混ざる）', () => {
    expect(selectableDeliveryIds([item({ id: '' }), item({ id: 'a' })])).toEqual(['a'])
  })
})

describe('isAllDeliverySelected', () => {
  it('中身が一致していれば全選択', () => {
    expect(isAllDeliverySelected(new Set(['a', 'b']), ['a', 'b'])).toBe(true)
  })

  // 実装は selectedItems.size === allDeliveryIds.length だけで見ていた。
  // 担当者を切り替えると前の担当者のIDが残るので、件数だけ一致して
  // 「全選択」を押すと全解除になる（＝一括処理ができない）
  it('件数が同じでも中身が違えば全選択ではない', () => {
    expect(isAllDeliverySelected(new Set(['x', 'y']), ['a', 'b'])).toBe(false)
  })

  it('対象が0件なら全選択ではない', () => {
    expect(isAllDeliverySelected(new Set(), [])).toBe(false)
  })

  it('選択が対象を包含していても、余分があれば全選択とはみなさない', () => {
    expect(isAllDeliverySelected(new Set(['a', 'b', 'zombie']), ['a', 'b'])).toBe(false)
  })
})

describe('pruneSelection', () => {
  // 担当者プルダウンを切り替えても selectedItems が消えなかったのが元凶。
  it('いま画面に出ていない選択を捨てる', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })]
    expect([...pruneSelection(new Set(['a', 'old-1', 'old-2']), items)]).toEqual(['a'])
  })

  it('配送準備完了でなくなったものも捨てる', () => {
    const items = [item({ id: 'a', readyForDelivery: false })]
    expect(pruneSelection(new Set(['a']), items).size).toBe(0)
  })

  it('変化が無ければ同じ中身を返す', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })]
    expect([...pruneSelection(new Set(['a', 'b']), items)].sort()).toEqual(['a', 'b'])
  })
})

describe('resolveBatchDeliveryTargets', () => {
  it('選択されたものを実行対象にする', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })]
    const { targets, skipped } = resolveBatchDeliveryTargets(items, new Set(['a']))
    expect(targets.map(t => t.id)).toEqual(['a'])
    expect(skipped).toEqual([])
  })

  // 実装は `if (item.assignedItemId && item.orderItemId)` の else が空で、
  // 処理できなかった個体を黙って飛ばしたうえで「N件配送完了しました」と出していた
  it('order_item IDが無いものは理由つきで除ける', () => {
    const items = [item({ id: 'a', orderItemId: null })]
    const { targets, skipped } = resolveBatchDeliveryTargets(items, new Set(['a']))
    expect(targets).toEqual([])
    expect(skipped).toEqual([{ id: 'a', name: '車椅子', reason: 'missing_order_item' }])
  })

  it('個体が割り当てられていないものも理由つきで除ける', () => {
    const items = [item({ id: 'a', assignedItemId: null })]
    const { skipped } = resolveBatchDeliveryTargets(items, new Set(['a']))
    expect(skipped[0].reason).toBe('missing_assigned_item')
  })

  it('画面から消えた選択は理由つきで除ける', () => {
    const { targets, skipped } = resolveBatchDeliveryTargets([item({ id: 'a' })], new Set(['a', 'gone']))
    expect(targets.map(t => t.id)).toEqual(['a'])
    expect(skipped).toEqual([{ id: 'gone', name: '不明', reason: 'not_displayed' }])
  })

  it('配送準備完了でないものは除ける', () => {
    const items = [item({ id: 'a', readyForDelivery: false })]
    expect(resolveBatchDeliveryTargets(items, new Set(['a'])).skipped[0].reason).toBe('not_ready')
  })

  it('同じ order_item の複数個体はどちらも実行対象に残す', () => {
    const items = [
      item({ id: 'a', orderItemId: 'OI-1', assignedItemId: 'KB-001' }),
      item({ id: 'b', orderItemId: 'OI-1', assignedItemId: 'KB-002' }),
    ]
    const { targets } = resolveBatchDeliveryTargets(items, new Set(['a', 'b']))
    expect(targets.map(t => t.assignedItemId)).toEqual(['KB-001', 'KB-002'])
  })
})

describe('summarizeBatchDelivery', () => {
  it('全部成功したら成功件数だけを伝える', () => {
    const msg = summarizeBatchDelivery({ succeeded: 3, failed: [], skipped: [], isProxy: false, proxyFor: '' })
    expect(msg).toBe('3件の配送が完了しました')
  })

  it('代理配送なら誰の代理かを伝える', () => {
    const msg = summarizeBatchDelivery({ succeeded: 2, failed: [], skipped: [], isProxy: true, proxyFor: '佐藤' })
    expect(msg).toBe('佐藤さんの代理で2件の配送が完了しました')
  })

  // 「できない場合がある」のに成功と表示されるのが一番困る
  it('処理できなかったものがあれば必ず件名を出す', () => {
    const msg = summarizeBatchDelivery({
      succeeded: 1,
      failed: [{ id: 'b', name: 'ベッド', message: '通信エラー' }],
      skipped: [{ id: 'c', name: '歩行器', reason: 'missing_order_item' }],
      isProxy: false,
      proxyFor: '',
    })
    expect(msg).toContain('1件の配送が完了しました')
    expect(msg).toContain('ベッド')
    expect(msg).toContain('通信エラー')
    expect(msg).toContain('歩行器')
    expect(msg).toContain('発注データが不完全')
  })

  it('1件も成功しなかったら成功と書かない', () => {
    const msg = summarizeBatchDelivery({
      succeeded: 0,
      failed: [{ id: 'b', name: 'ベッド', message: '通信エラー' }],
      skipped: [],
      isProxy: false,
      proxyFor: '',
    })
    expect(msg).not.toContain('配送が完了しました')
    expect(msg).toContain('ベッド')
  })
})
