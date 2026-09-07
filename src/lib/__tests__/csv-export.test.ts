/**
 * CSV 書き出しのエスケープのテスト
 *
 * 背景（2026-09-07）:
 *  history.tsx の CSV 出力は `row.join(',')` で値をそのまま連結していた。
 *  値は DB 由来（顧客名・備考・商品名・実行者名）なので、
 *   - カンマや改行が入ると列がずれ、以降の行が全部崩れる
 *   - 先頭が = + - @ の値は Excel/Google Sheets が **数式として実行**する（CSV インジェクション）
 *  という Stored 型の問題があった。書き出しは1か所に集約してエスケープする。
 */
import { describe, it, expect } from 'vitest'
import { toCsvCell, toCsv } from '../csv-export'

describe('toCsvCell', () => {
  it('普通の文字列はそのまま', () => {
    expect(toCsvCell('車いす')).toBe('車いす')
  })

  it('カンマを含む値は引用符で囲む', () => {
    expect(toCsvCell('山田, 太郎')).toBe('"山田, 太郎"')
  })

  it('引用符は二重にして囲む', () => {
    expect(toCsvCell('サイズ 15"')).toBe('"サイズ 15"""')
  })

  it('改行を含む値は引用符で囲む（列と行の両方が崩れるため）', () => {
    expect(toCsvCell('1行目\n2行目')).toBe('"1行目\n2行目"')
    expect(toCsvCell('1行目\r\n2行目')).toBe('"1行目\r\n2行目"')
  })

  it('= + - @ で始まる値は数式として実行されないよう無害化する', () => {
    // Excel / Google Sheets はこれらを数式と解釈する。先頭に ' を足して文字列に固定する
    expect(toCsvCell('=1+1')).toBe(`"'=1+1"`)
    expect(toCsvCell('+41234')).toBe(`"'+41234"`)
    expect(toCsvCell('-1+1')).toBe(`"'-1+1"`)
    expect(toCsvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
  })

  it('タブや復帰で始まる値も無害化する（前置文字を挟んだ数式回避）', () => {
    expect(toCsvCell('\t=1+1')).toBe(`"'\t=1+1"`)
  })

  it('マイナス始まりでも純粋な負の数はそのまま扱う（日数や金額を壊さない）', () => {
    expect(toCsvCell('-5')).toBe('-5')
    expect(toCsvCell('-3.14')).toBe('-3.14')
  })

  it('null / undefined / 数値も文字列にして扱う', () => {
    expect(toCsvCell(null)).toBe('')
    expect(toCsvCell(undefined)).toBe('')
    expect(toCsvCell(42)).toBe('42')
  })
})

describe('toCsv', () => {
  it('行と列を組み立て、先頭に BOM を付ける（Excel で日本語が化けないため）', () => {
    const csv = toCsv([
      ['日時', '顧客名'],
      ['2026-09-07', '山田, 太郎'],
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿日時,顧客名\r\n2026-09-07,"山田, 太郎"')
  })

  it('行区切りは CRLF（Excel の既定）', () => {
    expect(toCsv([['a'], ['b']])).toBe('﻿a\r\nb')
  })
})
