/**
 * カメラエラーのあとの「再試行」が本当に効くかのテスト
 *
 * 背景（2026-09-08）:
 *  田口さんの「カメラスキャンはローカルだから使えないの？」から調べていて見つかった。
 *
 *  resetCamera は既存のスキャナを destroy したあと、再初期化のつもりで
 *  setFacingMode(prev => prev) を呼んでいた。しかし React は同じ値なら
 *  状態を更新せず再描画もしないので、依存配列 [hasCamera, isActive, facingMode] は
 *  変化せず useEffect が走らない。
 *  結果、「再試行」を押すとスキャナだけ壊れて何も起きない無反応状態になっていた。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const startMock = vi.fn()
const stopMock = vi.fn()
const destroyMock = vi.fn()
const constructedTimes: number[] = []

vi.mock('qr-scanner', () => {
  class FakeQrScanner {
    constructor() {
      constructedTimes.push(Date.now())
    }
    start = startMock
    stop = stopMock
    destroy = destroyMock
    setCamera = vi.fn()
    toggleFlash = vi.fn()
    hasFlash = vi.fn(async () => false)
    static hasCamera = vi.fn(async () => true)
  }
  return { default: FakeQrScanner }
})

const { QRCameraScanner } = await import('../qr-camera-scanner')

describe('カメラエラー後の「再試行」', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    startMock.mockReset()
    stopMock.mockReset()
    destroyMock.mockReset()
    constructedTimes.length = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('カメラの起動に失敗したらエラーと再試行ボタンを出す', async () => {
    startMock.mockRejectedValue('Camera not found.')
    render(<QRCameraScanner onScanResult={() => {}} />)

    await waitFor(() => expect(screen.getByText('カメラエラー')).toBeTruthy())
    expect(screen.getByRole('button', { name: /再試行/ })).toBeTruthy()
  })

  it('「再試行」を押すとカメラを開き直す', async () => {
    startMock.mockRejectedValueOnce('Camera not found.')
    render(<QRCameraScanner onScanResult={() => {}} />)

    await waitFor(() => expect(screen.getByText('カメラエラー')).toBeTruthy())
    const firstAttempts = startMock.mock.calls.length
    expect(firstAttempts).toBeGreaterThan(0)

    startMock.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: /再試行/ }))

    // resetCamera は 500ms 待ってから再初期化する
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    await waitFor(() => {
      expect(startMock.mock.calls.length).toBeGreaterThan(firstAttempts)
    })
  })

  // エラー表示が消えるだけなら修正前でも通ってしまう（setCameraError(null) だけは
  // 走るため）。実際にスキャンが再開したことまで見る
  it('再試行に成功したらスキャンが再開する', async () => {
    startMock.mockRejectedValueOnce('Camera not found.')
    render(<QRCameraScanner onScanResult={() => {}} />)
    await waitFor(() => expect(screen.getByText('カメラエラー')).toBeTruthy())

    startMock.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: /再試行/ }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    await waitFor(() => {
      expect(screen.queryByText('カメラエラー')).toBeNull()
      // スキャナが作り直されている（＝本当に開き直した）
      expect(constructedTimes.length).toBeGreaterThan(1)
      expect(screen.getByText(/スキャン中/)).toBeTruthy()
    })
  })
})
