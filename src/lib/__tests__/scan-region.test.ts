import { describe, it, expect } from 'vitest'
import { calculateScanRegion, SCAN_RATE_PER_SECOND } from '../scan-region'

/**
 * カメラの映像から、どこをどの解像度で読み取るか
 *
 * 田口さん（2026-09-09）:
 *   「カメラは起動していて、QRコードをかざしても全く無反応。
 *     フローのダイアログも出ないし、エラーも出ない」
 *
 * 映っているのに読めない＝デコード側の問題。原因は2つあった。
 *  1. 読み取り回数を毎秒1回（ダイアログ）／5回（スキャン画面）に落としていた。
 *     ライブラリの既定は25回。ピント合わせが遅い端末では、
 *     たまたま撮れた数枚が全部ボケていて1度も読めない状態になり得る
 *  2. 読み取り範囲が中央の 2/3 だけで、400px に縮小されていた。
 *     端末のカメラアプリは全画面を等倍で見るので、そちらでは読める
 */

describe('SCAN_RATE_PER_SECOND', () => {
  // ここを下げるほど「たまたまボケた瞬間しか撮れない」端末が詰む
  it('ライブラリの既定（25回/秒）を下回らない', () => {
    expect(SCAN_RATE_PER_SECOND).toBeGreaterThanOrEqual(25)
  })
})

describe('calculateScanRegion', () => {
  const video = (w: number, h: number) =>
    ({ videoWidth: w, videoHeight: h }) as HTMLVideoElement

  it('短い辺いっぱいを読む（中央の一部だけに絞らない）', () => {
    const r = calculateScanRegion(video(1280, 720))
    expect(r.width).toBe(720)
    expect(r.height).toBe(720)
  })

  it('中央に置く', () => {
    const r = calculateScanRegion(video(1280, 720))
    expect(r.x).toBe(280)
    expect(r.y).toBe(0)
  })

  it('縦長の映像でも中央に置く', () => {
    const r = calculateScanRegion(video(720, 1280))
    expect(r.width).toBe(720)
    expect(r.x).toBe(0)
    expect(r.y).toBe(280)
  })

  // 縮小しすぎると、小さいラベルの細かい模様が潰れて読めなくなる
  it('既定の400pxより高い解像度で渡す', () => {
    const r = calculateScanRegion(video(1280, 720))
    expect(r.downScaledWidth).toBeGreaterThan(400)
    expect(r.downScaledHeight).toBe(r.downScaledWidth)
  })

  it('元より大きく引き伸ばさない（無駄に重くしない）', () => {
    const r = calculateScanRegion(video(480, 360))
    expect(r.downScaledWidth).toBeLessThanOrEqual(360)
  })

  // iOS は再生開始直後に大きさが 0 のことがある。ここで 0 を返すと永久に読めない
  it('大きさが取れていなくても、壊れた範囲を返さない', () => {
    const r = calculateScanRegion(video(0, 0))
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
    expect(r.downScaledWidth).toBeGreaterThan(0)
  })

  it('整数で返す（canvas に小数を渡さない）', () => {
    const r = calculateScanRegion(video(1281, 721))
    for (const v of [r.x, r.y, r.width, r.height, r.downScaledWidth, r.downScaledHeight]) {
      expect(Number.isInteger(v), String(v)).toBe(true)
    }
  })

  it('範囲が映像からはみ出さない', () => {
    const r = calculateScanRegion(video(640, 480))
    expect(r.x + r.width).toBeLessThanOrEqual(640)
    expect(r.y + r.height).toBeLessThanOrEqual(480)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
  })
})
