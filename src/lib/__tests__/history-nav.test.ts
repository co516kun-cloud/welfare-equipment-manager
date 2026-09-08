import { describe, it, expect } from 'vitest'
import { canGoBackInApp } from '../history-nav'

/**
 * 「戻る」がアプリの外へ出たり、変な所へ飛んだりしないための判定
 *
 * 田口さんの指摘（2026-09-08）:
 *   「戻るを押した時にちゃんと一つ前に戻るようにしてほしい。
 *     変なとこへ飛んだり、戻りすぎたりが結構ある」
 *
 * react-router は history.state に { usr, key, idx } を入れる。
 * idx はこのタブでアプリが積んだ履歴の位置。0 なら後ろにアプリの画面は無い
 * （URL直打ち・ブックマーク・通知から直接開いた・新しいタブ）ので、
 * navigate(-1) を呼ぶとアプリの外へ出てしまう。
 */

describe('canGoBackInApp', () => {
  it('アプリ内で1回でも遷移していれば戻れる', () => {
    expect(canGoBackInApp({ idx: 1, key: 'abc', usr: null })).toBe(true)
  })

  it('入口のページ（idx=0）では戻れない', () => {
    expect(canGoBackInApp({ idx: 0, key: 'abc', usr: null })).toBe(false)
  })

  it('history.state が無ければ戻れない（URL直打ち・新しいタブ）', () => {
    expect(canGoBackInApp(null)).toBe(false)
    expect(canGoBackInApp(undefined)).toBe(false)
  })

  // inventory.tsx が window.history.replaceState({}, ...) で
  // react-router の {usr,key,idx} ごと消していたため、これが起きていた
  it('idx が消された空の state では戻れない', () => {
    expect(canGoBackInApp({})).toBe(false)
  })

  it('idx が数値でなければ戻れない', () => {
    expect(canGoBackInApp({ idx: '1' })).toBe(false)
    expect(canGoBackInApp({ idx: null })).toBe(false)
  })

  it('文字列や数値がそのまま入っていても落ちない', () => {
    expect(canGoBackInApp('nonsense')).toBe(false)
    expect(canGoBackInApp(42)).toBe(false)
  })

  it('負の idx は戻れない扱い', () => {
    expect(canGoBackInApp({ idx: -1 })).toBe(false)
  })
})
