import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SCAN_RATE_PER_SECOND, calculateScanRegion } from '../../lib/scan-region'

/**
 * スキャナに渡している読み取り設定のテスト
 *
 * 田口さん（2026-09-09）:
 *   「カメラは起動していて、QRコードをかざしても全く無反応。
 *     フローのダイアログも出ないし、エラーも出ない」
 *
 * 原因はこちらの設定だった。ライブラリの既定は25回/秒なのに、
 * 連続モードで5回/秒・単発モードで1回/秒まで落としていた。
 * ピント合わせの遅い端末では、撮れた数枚が全部ボケていて
 * 一度も読めない状態になり得る。
 *
 * ここを再び絞ると同じ症状が戻るので、値そのものを固定する。
 */

const optionsSeen: Record<string, unknown>[] = []
const startMock = vi.fn()

vi.mock('qr-scanner', () => {
  class FakeQrScanner {
    constructor(_v: unknown, _cb: unknown, options: Record<string, unknown>) {
      optionsSeen.push(options)
    }
    start = startMock
    stop = vi.fn()
    destroy = vi.fn()
    setCamera = vi.fn()
    toggleFlash = vi.fn()
    hasFlash = vi.fn(async () => false)
    static hasCamera = vi.fn(async () => true)
  }
  return { default: FakeQrScanner }
})

const { QRCameraScanner } = await import('../qr-camera-scanner')

describe('読み取り設定', () => {
  beforeEach(() => {
    optionsSeen.length = 0
    startMock.mockReset()
    startMock.mockResolvedValue(undefined)
  })

  it('連続モードでも単発モードでも、読み取り回数を絞らない', async () => {
    render(<QRCameraScanner onScanResult={() => {}} continuousMode={true} />)
    await waitFor(() => expect(optionsSeen.length).toBeGreaterThan(0))
    expect(optionsSeen[0].maxScansPerSecond).toBe(SCAN_RATE_PER_SECOND)

    optionsSeen.length = 0
    render(<QRCameraScanner onScanResult={() => {}} continuousMode={false} />)
    await waitFor(() => expect(optionsSeen.length).toBeGreaterThan(0))
    // 単発モードは「1回読めたら止める」で二重処理を防ぐ。回数を絞る必要は無い
    expect(optionsSeen[0].maxScansPerSecond).toBe(SCAN_RATE_PER_SECOND)
  })

  it('読み取り範囲を自前の計算に差し替えている（既定の中央2/3・400pxではない）', async () => {
    render(<QRCameraScanner onScanResult={() => {}} />)
    await waitFor(() => expect(optionsSeen.length).toBeGreaterThan(0))
    expect(optionsSeen[0].calculateScanRegion).toBe(calculateScanRegion)
  })

  it('背面カメラを優先する', async () => {
    render(<QRCameraScanner onScanResult={() => {}} />)
    await waitFor(() => expect(optionsSeen.length).toBeGreaterThan(0))
    expect(optionsSeen[0].preferredCamera).toBe('environment')
  })
})
