import { describe, it, expect } from 'vitest'
import { inventoryViewFromState, drillToCategory, drillToProduct, INVENTORY_TOP } from '../inventory-view'

/**
 * 在庫一覧の階層（種類 → 商品 → 個体）を履歴に載せるための変換
 *
 * 田口さんの指摘（2026-09-08）:
 *   「在庫一覧を見たり商品検索をしたりする時、戻るを押した時にちゃんと一つ前に
 *     戻るように設計してほしい。戻りすぎたりが結構ある」
 *
 * これまで階層は zustand の中だけにあり、履歴に残っていなかった。
 * 個体まで潜ってブラウザの戻るを押すと、階層を2つ飛ばして前のページへ出ていた。
 */

describe('inventoryViewFromState', () => {
  it('stateが無ければ種類一覧から始める', () => {
    expect(inventoryViewFromState(null)).toEqual(INVENTORY_TOP)
    expect(inventoryViewFromState(undefined)).toEqual(INVENTORY_TOP)
  })

  it('種類まで潜った状態を復元する', () => {
    expect(inventoryViewFromState({ viewMode: 'product', selectedCategory: 'beds' })).toEqual({
      viewMode: 'product',
      selectedCategory: 'beds',
      selectedProduct: null,
    })
  })

  it('個体まで潜った状態を復元する', () => {
    expect(
      inventoryViewFromState({ viewMode: 'item', selectedCategory: 'beds', selectedProduct: 'P-1' })
    ).toEqual({ viewMode: 'item', selectedCategory: 'beds', selectedProduct: 'P-1' })
  })

  // 検索結果からは selectedProduct だけ渡されることがある
  it('商品だけ指定されたら個体一覧として扱う', () => {
    expect(inventoryViewFromState({ viewMode: 'item', selectedProduct: 'P-1' })).toEqual({
      viewMode: 'item',
      selectedCategory: null,
      selectedProduct: 'P-1',
    })
  })

  it('知らない viewMode は種類一覧に落とす', () => {
    expect(inventoryViewFromState({ viewMode: 'galaxy' })).toEqual(INVENTORY_TOP)
  })

  it('関係ないstateが入っていても落ちない', () => {
    expect(inventoryViewFromState({ from: 'search' })).toEqual(INVENTORY_TOP)
    expect(inventoryViewFromState('nonsense')).toEqual(INVENTORY_TOP)
  })
})

describe('drillToCategory', () => {
  it('種類を選ぶと商品一覧になり、商品の選択は外れる', () => {
    expect(drillToCategory('beds')).toEqual({
      viewMode: 'product',
      selectedCategory: 'beds',
      selectedProduct: null,
    })
  })
})

describe('drillToProduct', () => {
  it('商品を選ぶと個体一覧になり、種類は保たれる', () => {
    const from = drillToCategory('beds')
    expect(drillToProduct(from, 'P-1')).toEqual({
      viewMode: 'item',
      selectedCategory: 'beds',
      selectedProduct: 'P-1',
    })
  })

  it('種類を選ばずに商品へ潜っても壊れない', () => {
    expect(drillToProduct(INVENTORY_TOP, 'P-1')).toEqual({
      viewMode: 'item',
      selectedCategory: null,
      selectedProduct: 'P-1',
    })
  })
})
