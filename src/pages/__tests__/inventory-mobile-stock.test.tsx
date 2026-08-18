/**
 * モバイル在庫一覧の「実質在庫」と「番号の閲覧可否」のテスト
 *
 * 背景（2026-08-18）:
 *  管理番号を指定した発注（handleOrderSubmit）は、
 *    ① item_processing_status='waiting' の発注明細を assigned_item_ids つきで作る
 *    ② その個体を status='reserved' にする（= available から抜ける）
 *  の2つを同時に行う。getEffectiveStock() が①を無条件に引いていたため、
 *  同じ1台を二重に引いて「現物があるのに実質在庫0」になり、
 *  カードがグレーアウトして管理番号の閲覧まで止まっていた。
 *
 *  共有ユーティリティ src/lib/inventory-utils.ts の calculateReservations() は
 *  元から「assigned_item_ids が空のものだけ数える」ガードを持っている。
 *  このテストはその正しいルールに揃っていることを固定する。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// --- Supabase 系は import 時に env を要求する / 本番DBに触れるので完全にモックする ---
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    saveOrder: vi.fn(),
    saveProductItem: vi.fn(),
    createItemHistory: vi.fn(),
  },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'tester@example.com' }, loading: false }),
}))

// --- ストアはフィクスチャを返すモックに差し替える ---
type Fixture = Record<string, unknown>
const storeState: Fixture = {}
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: () => storeState,
}))

import { Inventory } from '../inventory'

const PRODUCT_NAME = 'テスト特殊寝台'

function makeItem(id: string, status: string) {
  return {
    id,
    product_id: 'P1',
    status,
    condition: 'good',
    location: 'A-1',
    customer_name: null,
    qr_code: id,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }
}

function makeOrder(
  id: string,
  orderStatus: string,
  itemProcessingStatus: string,
  assignedItemIds: string[] | undefined,
  quantity = 1,
) {
  return {
    id,
    customer_name: '（テスト）',
    status: orderStatus,
    order_date: '2026-08-18',
    required_date: '2026-08-20',
    created_by: 'tester',
    created_at: '2026-08-18T00:00:00Z',
    items: [
      {
        id: `${id}-1`,
        product_id: 'P1',
        quantity,
        item_processing_status: itemProcessingStatus,
        assigned_item_ids: assignedItemIds,
        approval_status: 'not_required',
        needs_approval: false,
      },
    ],
  }
}

/** フィクスチャを流し込んでモバイル幅で描画する */
function renderMobile(opts: { items: Fixture[]; orders: Fixture[] }) {
  Object.assign(storeState, {
    categories: [{ id: 'C1', name: '特殊寝台', icon: '🛏', description: '' }],
    products: [
      {
        id: 'P1',
        name: PRODUCT_NAME,
        category_id: 'C1',
        manufacturer: 'テストメーカー',
        model: 'TB-100',
        description: '',
        minimum_stock: 0,
      },
    ],
    items: opts.items,
    users: [{ id: 'U1', email: 'tester@example.com', name: 'テスター' }],
    orders: opts.orders,
    viewMode: 'category',
    selectedCategory: null,
    selectedProduct: null,
    setViewMode: vi.fn(),
    setSelectedCategory: vi.fn(),
    setSelectedProduct: vi.fn(),
    getInventorySummary: vi.fn(() => []),
    getReservations: vi.fn(() => new Map()),
    resetUIState: vi.fn(),
    updateItemStatus: vi.fn(),
  })

  return render(
    <MemoryRouter>
      <Inventory />
    </MemoryRouter>,
  )
}

/** 商品名から、その商品のカード要素を取る */
function getCard() {
  return screen.getByText(PRODUCT_NAME).closest('.rounded-xl') as HTMLElement
}

beforeEach(() => {
  // モバイル判定は window.innerWidth < 768
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
  vi.clearAllMocks()
})

describe('モバイル在庫カード', () => {
  it('管理番号を指定した発注は実質在庫から二重に引かれない（本件のバグ）', () => {
    // 3台のうち2台を番号指定で発注した直後の実態:
    //   ACT-001 / ACT-002 は reserved（available から抜けている）
    //   その2台ぶんの発注明細が waiting + assigned_item_ids つきで残っている
    //   ACT-003 はまだ棚にある
    renderMobile({
      items: [
        makeItem('ACT-001', 'reserved'),
        makeItem('ACT-002', 'reserved'),
        makeItem('ACT-003', 'available'),
      ],
      orders: [
        makeOrder('ORD-1', 'approved', 'waiting', ['ACT-001']),
        makeOrder('ORD-2', 'approved', 'waiting', ['ACT-002']),
      ],
    })

    const card = getCard()

    // 実質在庫は 1（修正前は 1 - 2 = 0 になっていた）
    expect(card.textContent).toMatch(/1\s*台/)
    // 棚に残っている番号が見えている
    expect(within(card).getByText('ACT-003')).toBeInTheDocument()
    // 在庫があるので「発注不可」の注記は出ない
    expect(card.textContent).not.toContain('発注中（確認のみ・発注不可）')
    expect(card.textContent).not.toContain('在庫なし')
  })

  it('数量指定の通常発注（管理番号 未割り当て）は従来どおり実質在庫から引く', () => {
    // 3台とも棚にあり、番号未指定の発注が1件 waiting
    renderMobile({
      items: [
        makeItem('ACT-001', 'available'),
        makeItem('ACT-002', 'available'),
        makeItem('ACT-003', 'available'),
      ],
      orders: [makeOrder('ORD-1', 'approved', 'waiting', undefined, 1)],
    })

    const card = getCard()
    // 物理3 - 発注1 = 2
    expect(card.textContent).toMatch(/2\s*台/)
    expect(card.textContent).toContain('物理:3 - 発注:1')
  })

  it('実質在庫が0でも、物理在庫があれば管理番号を閲覧できる', () => {
    // 番号未指定の発注で全数が埋まったケース（実質0・物理2）
    renderMobile({
      items: [makeItem('ACT-001', 'available'), makeItem('ACT-002', 'available')],
      orders: [makeOrder('ORD-1', 'approved', 'waiting', undefined, 2)],
    })

    const card = getCard()

    // 番号がカード上に出ている
    expect(within(card).getByText('ACT-001')).toBeInTheDocument()
    expect(within(card).getByText('ACT-002')).toBeInTheDocument()
    // 発注はできないことが明示されている
    expect(card.textContent).toContain('発注中（確認のみ・発注不可）')
    // カードはタップできる（モーダルが開く）
    fireEvent.click(card)
    expect(screen.getByText('管理番号一覧')).toBeInTheDocument()
  })

  it('利用可能な個体が1台も無ければ「在庫なし」でタップできない', () => {
    renderMobile({
      items: [makeItem('ACT-001', 'rented'), makeItem('ACT-002', 'unknown')],
      orders: [],
    })

    const card = getCard()
    expect(card.textContent).toContain('在庫なし')
    expect(within(card).queryByText('ACT-001')).not.toBeInTheDocument()

    fireEvent.click(card)
    expect(screen.queryByText('管理番号一覧')).not.toBeInTheDocument()
  })

  it('waiting 以外（ready / delivered / cancelled）は実質在庫から引かない', () => {
    renderMobile({
      items: [
        makeItem('ACT-001', 'available'),
        makeItem('ACT-002', 'available'),
      ],
      orders: [
        makeOrder('ORD-1', 'approved', 'ready', ['ACT-900']),
        makeOrder('ORD-2', 'approved', 'delivered', ['ACT-901']),
        makeOrder('ORD-3', 'cancelled', 'cancelled', undefined),
      ],
    })

    const card = getCard()
    expect(card.textContent).toMatch(/2\s*台/)
  })
})
