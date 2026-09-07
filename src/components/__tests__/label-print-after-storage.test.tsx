/**
 * 入庫処理のあとのラベル印刷が、時間が経っても効くことのテスト
 *
 * 背景（2026-09-07・デモモードのE2Eで発見）:
 *  入庫処理を実行すると、外側のダイアログは閉じずに「ラベル印刷」の確認が入れ子で開く
 *  （scan-action-dialog.tsx:292）。
 *
 *  一方 scan.tsx の handleActionSuccess は、連続モードのとき **3秒後に
 *  setSelectedItem(null)** する（scan.tsx:273-279）。
 *
 *  ラベル印刷ダイアログは selectedItem を使うため、ユーザーが3秒以上迷ってから
 *  「ラベルを印刷する」を押すと handleLabelPrintConfirm 冒頭の
 *  `if (!selectedItem) return` に当たり、**何も起きずに黙って終わる**。
 *  alert も出ずキューにも入らないので、現場では「押したのにラベルが出てこない」になる。
 *
 *  対策として、押した時点の個体を覚えておく（selectedItem が消えても印刷できる）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const addLabelPrintQueue = vi.fn()
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    addLabelPrintQueue: (...a: unknown[]) => { addLabelPrintQueue(...a); return Promise.resolve({ id: 'LQ-1' }) },
    getProductItemById: vi.fn(async () => null),
    saveProductItem: vi.fn(),
    createItemHistory: vi.fn(),
    getOrderById: vi.fn(),
    saveOrder: vi.fn(),
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))
const storeState = { items: [], setState: vi.fn() }
vi.mock('../../stores/useInventoryStore', () => ({
  useInventoryStore: Object.assign(() => storeState, { getState: () => storeState, setState: vi.fn() }),
}))

import { ScanActionDialog } from '../scan-action-dialog'

const item = {
  id: 'WC-003', product_id: 'PRD-1', status: 'maintenance', condition: 'good',
  location: '倉庫', qr_code: 'WC-003', condition_notes: '左ブレーキ調整済み',
  product: { id: 'PRD-1', name: '標準車いす', category_id: 'wheelchair' },
}

beforeEach(() => {
  addLabelPrintQueue.mockClear()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

function renderDialog(selectedItem: unknown) {
  return render(
    <ScanActionDialog
      open
      onOpenChange={() => {}}
      selectedItem={selectedItem as never}
      actionType="storage"
      availableOrders={[]}
      onSuccess={() => {}}
      getCurrentUserName={() => 'テスト太郎'}
      orders={[]}
    />
  )
}

describe('入庫処理のあとのラベル印刷', () => {
  it('処理を実行するとラベル印刷の確認が出る', async () => {
    renderDialog(item)
    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'ラベルを印刷する' })).toBeInTheDocument())
  })

  it('確認が出たあとに個体の選択が外れても、押せばキューに入る', async () => {
    const { rerender } = renderDialog(item)

    fireEvent.click(screen.getByRole('button', { name: '処理実行' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'ラベルを印刷する' })).toBeInTheDocument())

    // 連続モードの3秒タイマーで selectedItem が null になる状況を再現する
    rerender(
      <ScanActionDialog
        open
        onOpenChange={() => {}}
        selectedItem={null as never}
        actionType="storage"
        availableOrders={[]}
        onSuccess={() => {}}
        getCurrentUserName={() => 'テスト太郎'}
        orders={[]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ラベルを印刷する' }))

    await waitFor(() => expect(addLabelPrintQueue).toHaveBeenCalledTimes(1))
    expect(addLabelPrintQueue.mock.calls[0][0]).toMatchObject({
      item_id: 'WC-003',
      management_id: 'WC-003',
      product_name: '標準車いす',
      status: 'pending',
    })
  })
})
