/**
 * 在庫一覧の階層（種類 → 商品 → 個体）を履歴に載せるための変換（2026-09-08）
 *
 * 田口さんの指摘:
 *   「在庫一覧を見たり商品検索をしたりする時、戻るを押した時にちゃんと一つ前に
 *     戻るように設計してほしい。戻りすぎたりが結構ある」
 *
 * これまで階層は zustand の中だけにあり、ブラウザの履歴に残っていなかった。
 * 個体まで潜ってから戻ると、階層を2つ飛ばして前のページへ出ていた。
 * 階層を location.state に持たせることで、戻る＝一つ上の階層になる。
 */

export type InventoryViewMode = 'category' | 'product' | 'item'

export interface InventoryView {
  viewMode: InventoryViewMode
  selectedCategory: string | null
  selectedProduct: string | null
}

/** 在庫一覧の入口（種類一覧） */
export const INVENTORY_TOP: InventoryView = {
  viewMode: 'category',
  selectedCategory: null,
  selectedProduct: null,
}

const MODES: InventoryViewMode[] = ['category', 'product', 'item']

/** 履歴エントリの state から、表示すべき階層を決める */
export function inventoryViewFromState(state: unknown): InventoryView {
  if (!state || typeof state !== 'object') return INVENTORY_TOP

  const s = state as Record<string, unknown>
  const mode = s.viewMode
  if (typeof mode !== 'string' || !MODES.includes(mode as InventoryViewMode)) {
    return INVENTORY_TOP
  }

  return {
    viewMode: mode as InventoryViewMode,
    selectedCategory: typeof s.selectedCategory === 'string' ? s.selectedCategory : null,
    selectedProduct: typeof s.selectedProduct === 'string' ? s.selectedProduct : null,
  }
}

/** 種類を選んで商品一覧へ潜る */
export function drillToCategory(categoryId: string): InventoryView {
  return { viewMode: 'product', selectedCategory: categoryId, selectedProduct: null }
}

/** 商品を選んで個体一覧へ潜る */
export function drillToProduct(from: InventoryView, productId: string): InventoryView {
  return { viewMode: 'item', selectedCategory: from.selectedCategory, selectedProduct: productId }
}
