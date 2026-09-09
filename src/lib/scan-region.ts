/**
 * カメラの映像から、どこをどの解像度で読み取るか（2026-09-09）
 *
 * 田口さん:
 *   「カメラは起動していて、QRコードをかざしても全く無反応。
 *     フローのダイアログも出ないし、エラーも出ない。
 *     端末のカメラアプリでは読み取れるのに」
 *
 * 映っているのに読めない＝許可でも機器でもなく、デコード側の問題。
 * こちらの設定に2つ原因があった。
 *
 *  1. maxScansPerSecond をダイアログで1回/秒、スキャン画面で5回/秒に落としていた
 *     （ライブラリの既定は25回/秒）。ピント合わせの遅い端末では、
 *     たまたま撮れた数枚が全部ボケていて一度も読めない、が起こり得る。
 *     新しい端末は一瞬で合焦するので誰も気づかなかった。
 *     ※ 二重処理は「1回読めたら止める」で防いでいるので、回数を絞る必要はない
 *
 *  2. 読み取り範囲がライブラリ既定の「中央の 2/3・400px に縮小」だった。
 *     端末のカメラアプリは全画面を等倍で見るので、そちらでは読める。
 *     範囲を短辺いっぱいに広げ、縮小後の解像度も上げる。
 */

export interface ScanRegion {
  x: number
  y: number
  width: number
  height: number
  downScaledWidth: number
  downScaledHeight: number
}

/**
 * 1秒あたりの読み取り回数。
 * ライブラリの既定と同じ。実際にはデコードが終わるまで次を始めないので、
 * 遅い端末では自然に間引かれる。上限を下げる意味は無い。
 */
export const SCAN_RATE_PER_SECOND = 25

/** 縮小後の一辺。既定の400pxだと小さいラベルの模様が潰れる */
const TARGET_SIZE = 640

/** 映像の大きさがまだ取れていないときの仮の値（iOS は再生直後に0を返すことがある） */
const FALLBACK_SIDE = 480

export function calculateScanRegion(video: HTMLVideoElement): ScanRegion {
  const w = video.videoWidth || 0
  const h = video.videoHeight || 0

  // 大きさが取れていない段階でも、壊れた範囲（0×0）を返さない。
  // 0 を返すと以後ずっと読み取れないまま無反応になる
  if (w <= 0 || h <= 0) {
    return {
      x: 0, y: 0,
      width: FALLBACK_SIDE, height: FALLBACK_SIDE,
      downScaledWidth: FALLBACK_SIDE, downScaledHeight: FALLBACK_SIDE,
    }
  }

  // 短辺いっぱいの正方形を中央に。ライブラリ既定の 2/3 より広く取る
  const side = Math.min(w, h)
  const size = Math.min(TARGET_SIZE, side) // 元より引き伸ばさない

  return {
    x: Math.round((w - side) / 2),
    y: Math.round((h - side) / 2),
    width: side,
    height: side,
    downScaledWidth: Math.round(size),
    downScaledHeight: Math.round(size),
  }
}
