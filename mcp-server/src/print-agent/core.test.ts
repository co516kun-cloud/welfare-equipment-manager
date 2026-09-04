/**
 * 印刷エージェントの純粋ロジックのテスト
 *
 * 背景（2026-09-04）:
 *  「ラベル印刷する」を押したら、キュー画面を開かなくてもプリンタから出るようにする。
 *  スマホと PC は直接つながらないので、Supabase の label_print_queue を郵便受けにし、
 *  PC 常駐のエージェントが行の到着を拾って scripts/print-label.ps1 を呼ぶ。
 *
 *  ここでは I/O（Supabase・PowerShell）を持たない判断部分だけを固定する:
 *   - PowerShell の stdout（BOM や余計な行が混ざる）から JSON を取り出す
 *   - 印刷結果 → キュー行をどう更新するか
 *   - PowerShell に渡す引数の組み立て（null を空文字にする）
 */
import { describe, it, expect } from 'vitest'
import { parsePrintOutput, queueUpdateForResult, buildPrintArgs } from './core.js'

describe('parsePrintOutput', () => {
  it('JSON 1行をそのまま読む', () => {
    const r = parsePrintOutput('{"ok":true,"stage":"printed","message":"印刷しました"}')
    expect(r).toEqual({ ok: true, stage: 'printed', message: '印刷しました' })
  })

  it('BOM と前後のノイズ行があっても JSON 部分だけ取り出す', () => {
    const stdout = '\uFEFFWARNING: something\r\n{"ok":true,"stage":"queued","jobs":1}\r\n'
    const r = parsePrintOutput(stdout)
    expect(r.ok).toBe(true)
    expect(r.stage).toBe('queued')
  })

  it('JSON が無ければ stage=parse の失敗として返す（例外にしない）', () => {
    const r = parsePrintOutput('powershell: command not found')
    expect(r.ok).toBe(false)
    expect(r.stage).toBe('parse')
    expect(r.message).toContain('command not found')
  })
})

describe('queueUpdateForResult', () => {
  const now = new Date('2026-09-04T00:00:00.000Z')
  const by = 'print-agent'

  it('printed → completed。印刷日時と実行者を入れ、前回の error_message を消す', () => {
    const u = queueUpdateForResult({ ok: true, stage: 'printed' }, { by, now })
    expect(u).toEqual({
      status: 'completed',
      printed_at: '2026-09-04T00:00:00.000Z',
      printed_by: 'print-agent',
      error_message: null,
    })
  })

  it('queued（スプーラで待機中）→ printing のまま。出たかどうか未確定なので completed にしない', () => {
    const u = queueUpdateForResult({ ok: true, stage: 'queued' }, { by, now })
    expect(u.status).toBe('printing')
    expect(u.printed_by).toBe('print-agent')
    expect(u).not.toHaveProperty('printed_at')
  })

  it('失敗 → failed。error_message は "stage: message" で 500 文字に切る', () => {
    const long = 'x'.repeat(600)
    const u = queueUpdateForResult({ ok: false, stage: 'spool', message: long }, { by, now })
    expect(u.status).toBe('failed')
    expect(u.error_message).toMatch(/^spool: x+$/)
    expect(u.error_message!.length).toBe(500)
  })
})

describe('buildPrintArgs', () => {
  it('ps1 を -File で呼び、3項目を名前付き引数で渡す', () => {
    const args = buildPrintArgs('C:\\repo\\scripts\\print-label.ps1', {
      management_id: 'WC-001',
      product_name: '車いす A',
      condition_notes: '小傷あり',
    })
    expect(args.slice(0, 5)).toEqual(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\repo\\scripts\\print-label.ps1'])
    expect(args).toContain('-ManagementId')
    expect(args[args.indexOf('-ManagementId') + 1]).toBe('WC-001')
    expect(args[args.indexOf('-ProductName') + 1]).toBe('車いす A')
    expect(args[args.indexOf('-ConditionNotes') + 1]).toBe('小傷あり')
  })

  it('product_name / condition_notes が null なら空文字を渡す（PowerShell 側で $null にしない）', () => {
    const args = buildPrintArgs('x.ps1', { management_id: 'WC-002', product_name: null, condition_notes: null })
    expect(args[args.indexOf('-ProductName') + 1]).toBe('')
    expect(args[args.indexOf('-ConditionNotes') + 1]).toBe('')
  })
})
