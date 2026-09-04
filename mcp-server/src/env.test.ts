/**
 * 2段読みの .env ローダーのテスト
 *
 * MCP サーバと印刷エージェントが共通で使う。
 *   1. ~/secrets/welfare-equipment-manager/.env（CLAUDE.md の規約）
 *   2. リポジトリ直下の .env（移行が終わるまでの補助。1 に無い変数だけ補う）
 * 既に env にある変数は上書きしない（dotenv と同じ）。
 * 実ファイルは触らず、一時ディレクトリに .env を作って試す。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadLayeredEnv } from './env.js'

let dir: string
const p = (name: string) => path.join(dir, name)

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('loadLayeredEnv', () => {
  it('secrets 側だけあれば、そこから読む', () => {
    fs.writeFileSync(p('secrets'), 'A=1\nB=two\n')
    const env: Record<string, string | undefined> = {}
    const r = loadLayeredEnv({ secretsPath: p('secrets'), fallbackPath: p('missing'), env })
    expect(env).toEqual({ A: '1', B: 'two' })
    expect(r.loadedFrom).toEqual([p('secrets')])
    expect(r.filledFromFallback).toEqual([])
  })

  it('両方あるとき secrets が勝ち、secrets に無い変数だけ直下から補い、補った名前を返す', () => {
    fs.writeFileSync(p('secrets'), 'A=secret\n')
    fs.writeFileSync(p('fallback'), 'A=repo\nMCP_USER_EMAIL=x@example.com\nOTHER=1\n')
    const env: Record<string, string | undefined> = {}
    const r = loadLayeredEnv({
      secretsPath: p('secrets'),
      fallbackPath: p('fallback'),
      env,
      watch: /^MCP_USER_/,
    })
    expect(env.A).toBe('secret')
    expect(env.MCP_USER_EMAIL).toBe('x@example.com')
    expect(env.OTHER).toBe('1')
    // watch に当たるものだけ「移してください」の対象として返す
    expect(r.filledFromFallback).toEqual(['MCP_USER_EMAIL'])
  })

  it('既に env にある変数はどちらのファイルでも上書きしない', () => {
    fs.writeFileSync(p('secrets'), 'A=file\n')
    const env: Record<string, string | undefined> = { A: 'preset' }
    loadLayeredEnv({ secretsPath: p('secrets'), fallbackPath: p('missing'), env })
    expect(env.A).toBe('preset')
  })

  it('どちらも無くても例外にせず、空の結果を返す', () => {
    const env: Record<string, string | undefined> = {}
    const r = loadLayeredEnv({ secretsPath: p('no1'), fallbackPath: p('no2'), env })
    expect(r.loadedFrom).toEqual([])
    expect(r.filledFromFallback).toEqual([])
  })
})
