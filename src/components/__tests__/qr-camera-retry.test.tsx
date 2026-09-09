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

/**
 * 2026-09-09: 表示が「カメラエラー」の一言から、原因と対処を出す形に変わった。
 * 文言そのものは環境で変わる（許可が無い / HTTPS でない / 機器が無い）ので、
 * 「エラー状態になっていること」を再試行ボタンと案内文で確かめる。
 */
const errorShown = () => screen.getByRole('button', { name: /再試行/ })

/**
 * 「カメラを開こうとして失敗した」状態になるまで待つ。
 * 再試行ボタンだけで待つと、カメラの有無チェックで失敗した場合にも
 * 通ってしまい、start() が呼ばれる前に次の検査へ進んでしまう。
 */
const waitForStartFailed = async (startFn: typeof startMock) => {
  await waitFor(() => expect(startFn).toHaveBeenCalled())
  await waitFor(() => expect(errorShown()).toBeTruthy())
}

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

    await waitForStartFailed(startMock)
    // 原因が分からなくても、次にやること（手入力）は必ず出す
    expect(await screen.findByText(/手入力/)).toBeTruthy()
  })

  it('「再試行」を押すとカメラを開き直す', async () => {
    startMock.mockRejectedValueOnce('Camera not found.')
    render(<QRCameraScanner onScanResult={() => {}} />)

    await waitForStartFailed(startMock)
    const firstAttempts = startMock.mock.calls.length

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
    await waitForStartFailed(startMock)

    startMock.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: /再試行/ }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    await waitFor(() => {
      // エラー表示（再試行ボタン）が消えている
      expect(screen.queryByRole('button', { name: /再試行/ })).toBeNull()
      // スキャナが作り直されている（＝本当に開き直した）
      expect(constructedTimes.length).toBeGreaterThan(1)
      expect(screen.getByText(/スキャン中/)).toBeTruthy()
    })
  })
})
