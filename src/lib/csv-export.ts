/**
 * CSV 書き出しの共通処理
 *
 * 書き出す値は DB 由来（顧客名・備考・商品名・実行者名）なので、
 * 素の join(',') では次の2つが起きる:
 *   1. カンマ・引用符・改行で列と行が崩れる
 *   2. = + - @ で始まる値を Excel / Google Sheets が **数式として実行**する
 *      （CSV インジェクション。開いた人の端末で任意の計算・外部参照が走りうる）
 * 両方をここで潰す。
 */

/** Excel / Sheets が数式と解釈する先頭文字 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@']
/** 数式の前に置かれても無視される制御文字（前置して検知を逃れる手口への対応） */
const LEADING_CONTROL = ['\t', '\r', '\n']
/** 純粋な数値（負数を含む）。日数や金額を無害化しないための除外 */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

function needsFormulaGuard(value: string): boolean {
  if (value === '') return false
  if (PLAIN_NUMBER.test(value)) return false

  // 先頭の制御文字を読み飛ばしてから判定する
  let i = 0
  while (i < value.length && LEADING_CONTROL.includes(value[i])) i++
  return i < value.length && FORMULA_TRIGGERS.includes(value[i])
}

/** 1セルを CSV として安全な形にする */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)

  if (needsFormulaGuard(s)) {
    // 先頭に ' を足すと Excel / Sheets は文字列として扱う。
    // ' 自体を見せないため引用符で囲む
    return `"'${s.replace(/"/g, '""')}"`
  }

  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }

  return s
}

/**
 * 二次元配列を CSV 文字列にする。
 * 先頭に BOM を付ける（付けないと Excel が UTF-8 と判別できず日本語が化ける）。
 * 行区切りは CRLF（Excel の既定）。
 */
export function toCsv(rows: unknown[][]): string {
  const body = rows.map(row => row.map(toCsvCell).join(',')).join('\r\n')
  return `﻿${body}`
}
