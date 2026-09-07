/**
 * デモモードでデータ層がモックへ委譲することのテスト
 *
 * 背景（2026-09-07）:
 *  supabase-database.ts は各メソッドの先頭で個別に isDemoMode() を見る方式のため、
 *  ガードの付け忘れが 27 件あった。付いていないメソッドはデモモードでも本物の
 *  Supabase クライアント（接続先は dummy.supabase.co）を叩きに行き、必ず失敗する。
 *
 *  実際、QRスキャンで使う getProductItemById / saveProductItem / createItemHistory /
 *  getOrderById が全てガード無しで、デモモードでは返却操作が最初の一歩で止まっていた。
 *
 *  ここでは「デモモードなら Supabase を触らずモックを呼ぶ」ことを、業務フローで
 *  実際に通るメソッドについて固定する。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// URL に 'dummy' を含める = デモモードのスイッチ
vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'dummy-key')

/** 本物の Supabase クライアントに触れたら即座に落ちるようにする */
const supabaseTouched = vi.fn()
vi.mock('../supabase', () => ({
  supabase: new Proxy({}, {
    get(_t, prop) {
      supabaseTouched(String(prop))
      throw new Error(`デモモードなのに Supabase を触った: ${String(prop)}`)
    },
  }),
}))

const calls: string[] = []
function spy(name: string, result: unknown = null) {
  return (...args: unknown[]) => {
    calls.push(name)
    return Promise.resolve(typeof result === 'function' ? (result as (...a: unknown[]) => unknown)(...args) : result)
  }
}

vi.mock('../mock-database', () => ({
  mockDb: {
    getCategories: spy('getCategories', []),
    getProducts: spy('getProducts', []),
    getProductById: spy('getProductById', null),
    getProductsByCategory: spy('getProductsByCategory', []),
    saveProduct: spy('saveProduct'),
    getProductItems: spy('getProductItems', []),
    getAllProductItems: spy('getAllProductItems', []),
    getProductItemById: spy('getProductItemById', null),
    getProductItemsByStatus: spy('getProductItemsByStatus', []),
    getProductItemsByProductId: spy('getProductItemsByProductId', []),
    getProductItemsByCategoryId: spy('getProductItemsByCategoryId', []),
    saveProductItem: spy('saveProductItem'),
    deleteProductItem: spy('deleteProductItem'),
    getUsers: spy('getUsers', []),
    getUserById: spy('getUserById', null),
    saveUser: spy('saveUser'),
    getCurrentUserName: spy('getCurrentUserName', 'デモユーザー'),
    getOrders: spy('getOrders', []),
    getOrderById: spy('getOrderById', null),
    saveOrder: spy('saveOrder'),
    updateOrderItemStatus: spy('updateOrderItemStatus'),
    getItemHistories: spy('getItemHistories', []),
    getItemHistoriesByItemId: spy('getItemHistoriesByItemId', []),
    getItemHistoriesPaginated: spy('getItemHistoriesPaginated', { data: [], totalCount: 0, totalPages: 1, currentPage: 1 }),
    createItemHistory: spy('createItemHistory'),
    deleteItemHistory: spy('deleteItemHistory'),
    getWorkHistories: spy('getWorkHistories', []),
    getHistoriesForAnalysis: spy('getHistoriesForAnalysis', []),
    getLabelPrintQueue: spy('getLabelPrintQueue', []),
    getLabelPrintQueueByStatus: spy('getLabelPrintQueueByStatus', []),
    addLabelPrintQueue: spy('addLabelPrintQueue', { id: 'LQ-1' }),
    updateLabelPrintQueueStatus: spy('updateLabelPrintQueueStatus'),
    requeueLabelPrint: spy('requeueLabelPrint'),
    deleteLabelPrintQueue: spy('deleteLabelPrintQueue'),
    getDemoEquipment: spy('getDemoEquipment', []),
    getDepositItems: spy('getDepositItems', []),
    getPreparationTasks: spy('getPreparationTasks', []),
  },
}))

import { supabaseDb } from '../supabase-database'
import type { ProductItem } from '../../types'

const item: ProductItem = {
  id: 'WC-001', product_id: 'PRD-1', status: 'available',
  condition: 'good', location: '倉庫', qr_code: 'WC-001',
}

beforeEach(() => {
  calls.length = 0
  supabaseTouched.mockClear()
})

describe('QRスキャンの一連（返却→消毒→メンテ→入庫）で通るメソッド', () => {
  it('個体を1件引く', async () => {
    await supabaseDb.getProductItemById('WC-001')
    expect(calls).toContain('getProductItemById')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })

  it('個体を保存する', async () => {
    await supabaseDb.saveProductItem(item)
    expect(calls).toContain('saveProductItem')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })

  it('履歴を残す', async () => {
    await supabaseDb.createItemHistory('WC-001', '返却', 'rented', 'returned', 'テスト')
    expect(calls).toContain('createItemHistory')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })

  it('発注を1件引く（割り当て済みの発注を探すのに使う）', async () => {
    await supabaseDb.getOrderById('ORD-DEMO-1')
    expect(calls).toContain('getOrderById')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})

describe('初期ロードと一覧', () => {
  it.each([
    ['getAllProductItems', () => supabaseDb.getAllProductItems()],
    ['getProductById', () => supabaseDb.getProductById('PRD-1')],
    ['getProductsByCategory', () => supabaseDb.getProductsByCategory('wheelchair')],
    ['getProductItemsByStatus', () => supabaseDb.getProductItemsByStatus('available')],
    ['getUserById', () => supabaseDb.getUserById('USER-1')],
  ])('%s がモックへ行く', async (name, run) => {
    await run()
    expect(calls).toContain(name)
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})

describe('履歴・作業管理・分析', () => {
  it.each([
    ['getItemHistories', () => supabaseDb.getItemHistories()],
    ['getItemHistoriesByItemId', () => supabaseDb.getItemHistoriesByItemId('WC-001')],
    ['getItemHistoriesPaginated', () => supabaseDb.getItemHistoriesPaginated(1, 50)],
    ['getWorkHistories', () => supabaseDb.getWorkHistories(2026, 9)],
    ['getHistoriesForAnalysis', () => supabaseDb.getHistoriesForAnalysis(2026, 9)],
  ])('%s がモックへ行く', async (name, run) => {
    await run()
    expect(calls).toContain(name)
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})

describe('ラベル印刷キュー', () => {
  it.each([
    ['updateLabelPrintQueueStatus', () => supabaseDb.updateLabelPrintQueueStatus('LQ-1', 'completed', 'テスト')],
    ['requeueLabelPrint', () => supabaseDb.requeueLabelPrint('LQ-1')],
  ])('%s がモックへ行く', async (name, run) => {
    await run()
    expect(calls).toContain(name)
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})

describe('商品マスタの追加（新規登録ダイアログ）', () => {
  it('saveProduct がモックへ行く', async () => {
    await supabaseDb.saveProduct({
      id: 'PRD-9', name: 'テスト商品', category_id: 'wheelchair',
      description: '', manufacturer: '', model: '',
    })
    expect(calls).toContain('saveProduct')
    expect(supabaseTouched).not.toHaveBeenCalled()
  })
})
