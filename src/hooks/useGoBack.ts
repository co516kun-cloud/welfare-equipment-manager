import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { canGoBackInApp } from '../lib/history-nav'

/**
 * 「一つ前に戻る」ボタン用のフック（2026-09-08）
 *
 * アプリ内に戻り先があれば一つ前へ、無ければ fallback へ。
 * fallback へ行くときは replace にして、戻る先が無いページに
 * 履歴を1つ増やさないようにしている。
 *
 * 使い方:
 *   const goBack = useGoBack('/inventory')
 *   <Button onClick={goBack}>← 戻る</Button>
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()

  return useCallback(() => {
    if (canGoBackInApp(typeof window !== 'undefined' ? window.history.state : null)) {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }, [navigate, fallback])
}
