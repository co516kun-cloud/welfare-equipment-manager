/**
 * ラベル印刷状況ページのテスト
 *
 * 背景（2026-09-04）:
 *  印刷は PC 常駐のエージェントが自動で行うようになった。
 *  この画面は「押す場所」ではなく「状況を見る・失敗したら再印刷する」場所になる。
 *   - pending / printing / completed / failed を全部出す（以前は pending のみ）
 *   - failed 行にはエラー内容と「再印刷」ボタンが出る
 *   - 「再印刷」は行を pending に戻す（エージェントが拾い直す）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))

const getLabelPrintQueue = vi.fn()
const requeueLabelPrint = vi.fn()
const updateLabelPrintQueueStatus = vi.fn()
vi.mock('../../lib/supabase-database', () => ({
  supabaseDb: {
    getLabelPrintQueue: (...a: unknown[]) => getLabelPrintQueue(...a),
    requeueLabelPrint: (...a: unknown[]) => requeueLabelPrint(...a),
    updateLabelPrintQueueStatus: (...a: unknown[]) => updateLabelPrintQueueStatus(...a),
    deleteLabelPrintQueue: vi.fn(),
  },
}))
// b-PAC ブラウザ拡張の有無はテストごとに切り替える
let extensionAvailable = false
const printLabel = vi.fn()
vi.mock('../../lib/label-printer', () => ({
  LabelPrinter: {
    isAvailable: () => extensionAvailable,
    printLabel: (...a: unknown[]) => printLabel(...a),
    openExtensionInstallPage: vi.fn(),
  },
}))
// Supabase Auth の User には name が無い。表示名は user_metadata.name → email の順
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'tester@example.com', user_metadata: { name: 'テスト太郎' } },
    loading: false,
  }),
}))

import { LabelQueuePage } from '../label-queue'

function row(over: Record<string, unknown>) {
  return {
    id: 'q-' + String(over.management_id),
    item_id: over.management_id,
    product_name: '車いす A',
    management_id: 'WC-000',
    condition_notes: '',
    status: 'pending',
    created_by: 'テスト',
    created_at: '2026-09-04T00:00:00Z',
    ...over,
  }
}

describe('ラベル印刷状況ページ', () => {
  beforeEach(() => {
    extensionAvailable = false
    getLabelPrintQueue.mockReset()
    requeueLabelPrint.mockReset()
    updateLabelPrintQueueStatus.mockReset()
    printLabel.mockReset()
    getLabelPrintQueue.mockResolvedValue([
      row({ management_id: 'WC-001', status: 'pending' }),
      row({ management_id: 'WC-002', status: 'failed', error_message: 'spool: スプーラでジョブが止まっています' }),
      row({ management_id: 'WC-003', status: 'completed', printed_by: 'print-agent', printed_at: '2026-09-04T00:01:00Z' }),
    ])
  })

  it('pending だけでなく failed / completed の行も一覧に出る', async () => {
    render(<MemoryRouter><LabelQueuePage /></MemoryRouter>)
    expect(await screen.findByText('WC-001')).toBeInTheDocument()
    expect(screen.getByText('WC-002')).toBeInTheDocument()
    expect(screen.getByText('WC-003')).toBeInTheDocument()
  })

  it('failed の行にはエラー内容が出る', async () => {
    render(<MemoryRouter><LabelQueuePage /></MemoryRouter>)
    await screen.findByText('WC-002')
    expect(screen.getByText(/スプーラでジョブが止まっています/)).toBeInTheDocument()
  })

  it('failed の行の「再印刷」を押すと、その行を pending に戻す', async () => {
    requeueLabelPrint.mockResolvedValue(undefined)
    render(<MemoryRouter><LabelQueuePage /></MemoryRouter>)
    await screen.findByText('WC-002')

    const buttons = screen.getAllByRole('button', { name: '再印刷' })
    // failed と completed の 2 行にだけ出る（pending には出ない）
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[0])
    await waitFor(() => expect(requeueLabelPrint).toHaveBeenCalledWith('q-WC-002'))
  })

  it('b-PAC 拡張がある PC では pending 行を直接印刷でき、完了時に実行者名を記録する', async () => {
    // 旧コードは user.name（Supabase Auth の User に無い）を渡していて printed_by が常に undefined だった
    extensionAvailable = true
    printLabel.mockResolvedValue(undefined)
    updateLabelPrintQueueStatus.mockResolvedValue(undefined)
    render(<MemoryRouter><LabelQueuePage /></MemoryRouter>)
    await screen.findByText('WC-001')

    fireEvent.click(screen.getByRole('button', { name: 'この PC で印刷' }))

    await waitFor(() =>
      expect(updateLabelPrintQueueStatus).toHaveBeenCalledWith('q-WC-001', 'completed', 'テスト太郎')
    )
  })
})
