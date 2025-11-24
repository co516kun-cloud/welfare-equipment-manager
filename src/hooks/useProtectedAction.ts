import { useState, useCallback, useRef } from 'react'

// プロセスタイプの定義
export enum ProcessType {
  SYNC = 'sync',
  QR_SCAN = 'qr_scan',
  ORDER_PROCESS = 'order_process',
  DEMO_MANAGEMENT = 'demo_management',
  STATUS_UPDATE = 'status_update',
  DELETE_OPERATION = 'delete_operation',
  DATA_SUBMISSION = 'data_submission'
}

// グローバルロック管理
const globalLocks: Record<ProcessType, boolean> = {
  [ProcessType.SYNC]: false,
  [ProcessType.QR_SCAN]: false,
  [ProcessType.ORDER_PROCESS]: false,
  [ProcessType.DEMO_MANAGEMENT]: false,
  [ProcessType.STATUS_UPDATE]: false,
  [ProcessType.DELETE_OPERATION]: false,
  [ProcessType.DATA_SUBMISSION]: false
}

// デバウンス管理
const lastExecutionTimes: Record<ProcessType, number> = {
  [ProcessType.SYNC]: 0,
  [ProcessType.QR_SCAN]: 0,
  [ProcessType.ORDER_PROCESS]: 0,
  [ProcessType.DEMO_MANAGEMENT]: 0,
  [ProcessType.STATUS_UPDATE]: 0,
  [ProcessType.DELETE_OPERATION]: 0,
  [ProcessType.DATA_SUBMISSION]: 0
}

interface ProtectedActionOptions {
  processType: ProcessType
  debounceMs?: number
  preventConcurrent?: boolean
  showLoadingFeedback?: boolean
}

/**
 * 重要なアクションを保護するカスタムフック
 * - 連打防止（デバウンス）
 * - 同時実行防止（グローバルロック）
 * - 視覚的フィードバック
 */
export function useProtectedAction<T extends any[]>(
  action: (...args: T) => Promise<void> | void,
  options: ProtectedActionOptions
) {
  const {
    processType,
    debounceMs = 1000,
    preventConcurrent = true,
    showLoadingFeedback = true
  } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const execute = useCallback(async (...args: T) => {
    const now = Date.now()

    // デバウンスチェック
    if (now - lastExecutionTimes[processType] < debounceMs) {
      console.log(`⚠️ Action too frequent for ${processType}, ignoring...`)
      return
    }

    // 同時実行チェック
    if (preventConcurrent && globalLocks[processType]) {
      console.log(`⚠️ ${processType} already in progress, ignoring...`)
      return
    }

    // ローディング状態をすでに設定している場合はスキップ
    if (isLoading) {
      console.log(`⚠️ Component already loading for ${processType}, ignoring...`)
      return
    }

    try {
      // ロックとローディング状態を設定
      if (preventConcurrent) {
        globalLocks[processType] = true
      }

      if (showLoadingFeedback) {
        setIsLoading(true)
      }

      setError(null)
      lastExecutionTimes[processType] = now

      console.log(`🔄 Executing protected action: ${processType}`)

      // アクション実行
      await action(...args)

      console.log(`✅ Protected action completed: ${processType}`)

    } catch (error) {
      console.error(`❌ Protected action failed: ${processType}`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(errorMessage)

      // エラー時は少し遅延してからエラーを表示する
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setError(null)
      }, 5000)

    } finally {
      // ロックとローディング状態を解除
      if (preventConcurrent) {
        globalLocks[processType] = false
      }

      if (showLoadingFeedback) {
        setIsLoading(false)
      }
    }
  }, [action, processType, debounceMs, preventConcurrent, showLoadingFeedback, isLoading])

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    execute,
    isLoading,
    error,
    cleanup
  }
}

/**
 * 軽量な連打防止フック（UI操作用）
 */
export function useDebounceClick(
  onClick: () => void,
  delayMs: number = 300
) {
  const [isDisabled, setIsDisabled] = useState(false)

  const handleClick = useCallback(() => {
    if (isDisabled) return

    setIsDisabled(true)
    onClick()

    setTimeout(() => {
      setIsDisabled(false)
    }, delayMs)
  }, [onClick, delayMs, isDisabled])

  return {
    handleClick,
    isDisabled
  }
}