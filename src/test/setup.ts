import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * テストごとに描画結果を片付ける（2026-09-09 追加）
 *
 * これが無いと前のテストの DOM が body に残り、screen.getBy* が
 * 前のテストの要素を拾ってしまう。実際、カメラ診断を入れたときに
 * 「エラー表示が出ているのに中身が空」という不可解な失敗になり、
 * 追いかけたらこれが原因だった。
 * 見かけ上は通ってしまう分、気づきにくい。
 */
afterEach(() => {
  cleanup()
})
