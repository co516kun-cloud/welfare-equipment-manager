import { useEffect, useState } from 'react'
import { Menu } from './menu'
import { MyPage } from './mypage'

/**
 * トップ（/）の入り口
 *
 * 2026-09-07 田口さんの指示:
 *   「PCで起動したときにマイページからではなく、全体のメニュー画面から始まるようにしてほしい。
 *     モバイル版は今のままでいい」
 *
 * PC   → メニュー画面（全体が見渡せる）
 * モバイル → マイページ（下部タブで移動する作りなので今のまま）
 *
 * 判定はアプリ全体と同じ 768px。他の画面（layout.tsx:12, menu.tsx:146 ほか）と揃えている。
 * ⚠️ 初期値を false（＝PC）にすると、モバイルで一瞬メニューが見えてから切り替わる。
 *    描画前に window.innerWidth を読んで決める。
 */
const MOBILE_BREAKPOINT = 768

const isMobileWidth = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT

export function Home() {
  const [isMobile, setIsMobile] = useState(isMobileWidth)

  useEffect(() => {
    const check = () => setIsMobile(isMobileWidth())
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isMobile ? <MyPage /> : <Menu />
}
