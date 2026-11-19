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

describe('完了ビュー', () => {
  const cleaningItem = { ...returnedItem, status: 'cleaning' }

  it('消毒完了の成功後、同じダイアログが完了ビューになり次の工程だけが出る', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce(cleaningItem)
    const onSuccess = vi.fn(), onItemUpdated = vi.fn()
    renderDialog({ onSuccess, onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    expect(screen.getByText('返却済み → 消毒済み')).toBeInTheDocument()
    expect(screen.getByText('続けて処理しますか？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メンテナンス完了' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '廃棄' })).toBeNull()
    expect(screen.queryByRole('button', { name: '処理実行' })).toBeNull()
    expect(onItemUpdated).toHaveBeenCalledTimes(1)
    expect(onItemUpdated.mock.calls[0][0]).toMatchObject({ id: 'WC-004', status: 'cleaning' })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('次の工程を押すと、完了した台で onContinue が呼ばれる', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce(cleaningItem)
    const onContinue = vi.fn(), onItemUpdated = vi.fn()
    const { rerender } = renderDialog({ onContinue, onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    // カメラが別の台を読んで selectedItem が差し替わった状況（Review Focus 3）
    rerender(dialogElement({ selectedItem: { ...returnedItem, id: 'WC-009', qr_code: 'WC-009' } as never, onContinue, onItemUpdated }))
    fireEvent.click(screen.getByRole('button', { name: 'メンテナンス完了' }))
    expect(onItemUpdated).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'WC-004', status: 'cleaning' }))
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ key: 'maintenance' }))
    expect(screen.queryByText('処理が完了しました')).toBeNull()
  })

  it('「続けない」で閉じて onSuccess が 1 回呼ばれる', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce(cleaningItem)
    const onSuccess = vi.fn(), onOpenChange = vi.fn()
    renderDialog({ onSuccess, onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    fireEvent.click(screen.getByRole('button', { name: '続けない（次の台をスキャン）' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('完了ビューの外側をクリックして閉じても「続けない」と同じ片付けになる', async () => {
    // ui/dialog.tsx は自作で、閉じる経路は外側（半透明の覆い）のクリックだけ。Esc は扱っていない
    getProductItemById.mockResolvedValueOnce(returnedItem).mockResolvedValueOnce(cleaningItem)
    const onSuccess = vi.fn(), onOpenChange = vi.fn()
    renderDialog({ onSuccess, onOpenChange })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    const overlay = document.querySelector('.mobile-dialog-overlay .bg-black\\/50')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay!)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('最新の取り直しに失敗しても、保存した値で完了ビューを出す', async () => {
    getProductItemById.mockResolvedValueOnce(returnedItem).mockRejectedValueOnce(new Error('network down'))
    const onItemUpdated = vi.fn()
    renderDialog({ onItemUpdated })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByText('処理が完了しました')
    expect(screen.getByText('返却済み → 消毒済み')).toBeInTheDocument()
    expect(onItemUpdated.mock.calls[0][0]).toMatchObject({ id: 'WC-004', status: 'cleaning' })
  })

  it('入庫処理は利用可能になるので完了ビューを出さず、今までどおり印刷確認に進む', async () => {
    const maintenanceItem = { ...returnedItem, id: 'BD-003', qr_code: 'BD-003', status: 'maintenance' }
    getProductItemById.mockResolvedValue(maintenanceItem)
    renderDialog({ selectedItem: maintenanceItem as never, actionType: 'storage' })
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await screen.findByRole('button', { name: 'ラベルを印刷する' })
    expect(screen.queryByText('処理が完了しました')).toBeNull()
  })
})
