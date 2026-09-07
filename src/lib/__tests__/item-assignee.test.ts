/**
 * 個体の担当者/持出者を引くヘルパーのテスト
 *
 * 背景（2026-09-07）:
 *  検索画面に「担当者/持出者」で絞り込む入力欄があるが、実装は item.assigned_to を見ていた。
 *  product_items にその列は無い（担当者は orders.assigned_to / carried_by が持つ）ので、
 *  常に undefined となり **何を入力しても検索結果が0件**になっていた。エラーも出ないので気づけない。
 *
 *  個体 → 担当者 は「その個体が割り当てられている発注」を経由して引く。
 */
import { describe, it, expect } from 'vitest'
import { getItemAssignees, matchesAssignee } from '../item-assignee'
import type { Order } from '../../types'

function order(over: Partial<Order> & { itemIds: (string | null)[] }): Order {
  const { itemIds, ...rest } = over
  return {
    id: 'ORD-1',
    customer_name: '山田様',
    order_date: '2026-09-01',
    required_date: '2026-09-05',
    assigned_to: '田中',
    carried_by: '',
    status: 'approved',
    items: [
      {
        id: 'OI-1',
        product_id: 'P1',
        quantity: itemIds.length,
        assigned_item_ids: itemIds as string[],
        approval_status: 'not_required',
        item_processing_status: 'ready',
      },
    ],
    ...rest,
  } as Order
}

describe('getItemAssignees', () => {
  it('割り当てられている発注の assigned_to と carried_by を返す', () => {
    const orders = [order({ itemIds: ['WC-001'], assigned_to: '田中', carried_by: '佐藤' })]
    expect(getItemAssignees('WC-001', orders).sort()).toEqual(['佐藤', '田中'])
  })

  it('どの発注にも割り当てられていなければ空', () => {
    const orders = [order({ itemIds: ['WC-001'] })]
    expect(getItemAssignees('WC-999', orders)).toEqual([])
  })

  it('複数の発注に登場すれば全部返し、重複と空文字は除く', () => {
    const orders = [
      order({ id: 'ORD-1', itemIds: ['WC-001'], assigned_to: '田中', carried_by: '' }),
      order({ id: 'ORD-2', itemIds: ['WC-001'], assigned_to: '田中', carried_by: '鈴木' }),
    ]
    expect(getItemAssignees('WC-001', orders).sort()).toEqual(['田中', '鈴木'].sort())
  })

  it('assigned_item_ids の null 要素（未割当の枠）に引っかからない', () => {
    const orders = [order({ itemIds: [null, 'WC-002'], assigned_to: '田中' })]
    expect(getItemAssignees('WC-002', orders)).toEqual(['田中'])
  })
})

describe('matchesAssignee', () => {
  const orders = [order({ itemIds: ['WC-001'], assigned_to: '田中太郎', carried_by: '佐藤' })]

  it('部分一致で拾う', () => {
    expect(matchesAssignee('WC-001', orders, '田中')).toBe(true)
    expect(matchesAssignee('WC-001', orders, '太郎')).toBe(true)
  })

  it('大文字小文字を区別しない', () => {
    const en = [order({ itemIds: ['WC-002'], assigned_to: 'Tanaka' })]
    expect(matchesAssignee('WC-002', en, 'tanaka')).toBe(true)
  })

  it('一致しなければ false', () => {
    expect(matchesAssignee('WC-001', orders, '鈴木')).toBe(false)
  })

  it('検索語が空なら絞り込まない（全部通す）', () => {
    expect(matchesAssignee('WC-999', orders, '')).toBe(true)
    expect(matchesAssignee('WC-999', orders, '   ')).toBe(true)
  })
})
