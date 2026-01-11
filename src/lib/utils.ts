import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 2つの日付間の日数を計算する
 * @param startDate 開始日（文字列またはDateオブジェクト）
 * @param endDate 終了日（文字列またはDateオブジェクト）。省略時は現在日時
 * @returns 日数（整数）
 */
export function calculateRentalDays(startDate: string | Date, endDate?: string | Date): number {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()

  // 時刻をリセットして日付のみで比較
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}