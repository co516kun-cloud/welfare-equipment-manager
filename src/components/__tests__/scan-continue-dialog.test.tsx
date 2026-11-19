/**
 * 処理ダイアログの「処理中」と「完了ビュー」のテスト（2026-11-19・田口さん依頼）
 *
 * 背景: 1 台に複数の工程を続けて行いたいとき、今は 1 工程ごとにスキャンし直す必要がある。
 *  成功後にダイアログを閉じず「完了・次の工程」に切り替え、同じ台の次の工程を続けられるようにする。
 *  あわせて、処理中が見て分かるようにし、二度押しも防ぐ（今は保存が 2 回走る）。
 *  設計書: docs/superpowers/specs/2026-11-19-scan-continue-design.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'

const { getProductItemById, saveProductItem, createItemHistory } = vi.hoisted(() => ({
  getProductItemById: vi.fn(),
  saveProductItem: vi.fn(),
  createItemHistory: vi.fn(),
}))
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    getProductItemById,
    saveProductItem,
    createItemHistory,
    getOrderById: vi.fn(),
    saveOrder: vi.fn(),
    addLabelPrintQueue: vi.fn(async () => ({ id: 'LQ-1' })),
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
const storeState = { items: [], users: [] }
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState, setState: vi.fn() }),
}))

import { ScanActionDialog } from '../scan-action-dialog'

type Props = ComponentProps<typeof ScanActionDialog>

const returnedItem = {
  id: 'WC-004', product_id: 'PRD-1', status: 'returned', condition: 'good',
  location: '倉庫', qr_code: 'WC-004',
  product: { id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair' },
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

function dialogElement(p: Partial<Props> = {}) {
  return (
    <ScanActionDialog
      open
      onOpenChange={() => {}}
      selectedItem={returnedItem as never}
      actionType="clean"
      availableOrders={[]}
      onSuccess={() => {}}
      getCurrentUserName={() => 'テスト太郎'}
      orders={[]}
      {...p}
    />
  )
}
function renderDialog(p: Partial<Props> = {}) {
  return render(dialogElement(p))
}

beforeEach(() => {
  getProductItemById.mockReset()
  saveProductItem.mockReset().mockResolvedValue(undefined)
  createItemHistory.mockReset().mockResolvedValue(undefined)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('処理中の表示', () => {
  it('処理実行を押すと「処理中…」になり、終わるまで実行もキャンセルも押せない', async () => {
    const pending = deferred<unknown>()
    getProductItemById.mockReturnValueOnce(pending.promise)
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    const busy = await screen.findByRole('button', { name: '処理中…' })
    expect(busy).toBeDisabled()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
    pending.resolve(returnedItem)
    await waitFor(() => expect(saveProductItem).toHaveBeenCalledTimes(1))
  })

  it('処理中に二度押ししても保存は 1 回', async () => {
    const pending = deferred<unknown>()
    getProductItemById.mockReturnValueOnce(pending.promise)
    renderDialog()
    const btn = screen.getByRole('button', { name: '処理実行' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    pending.resolve(returnedItem)
    await waitFor(() => expect(saveProductItem).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(saveProductItem).toHaveBeenCalledTimes(1)
  })
})
