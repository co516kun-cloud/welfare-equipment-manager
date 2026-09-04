/**
 * .env の 2 段読み（MCP サーバと印刷エージェントで共通）
 *
 *   1. ~/secrets/welfare-equipment-manager/.env  … CLAUDE.md の規約どおりの置き場（chmod 700）
 *   2. リポジトリ直下の .env                       … 移行が終わるまでの補助。1 に無い変数だけ補う
 *
 * 直下の .env は public リポの作業ツリー内で、/mnt/c 上なので WSL 側からは誰でも読める。
 * だから 1 を先に読み、2 から補ったものはログに出して「移してください」と促す。
 * 既に env にある変数はどちらのファイルでも上書きしない（dotenv.config と同じ）。
 *
 * ここでは process.env に直接触らず、渡された env オブジェクトに書く（テストのため）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import dotenv from 'dotenv'

export type LayeredEnvOptions = {
  secretsPath: string
  fallbackPath: string
  /** 書き込み先。省略時は process.env */
  env?: NodeJS.ProcessEnv
  /** fallback から補ったときに「移してください」と報告する変数名のパターン */
  watch?: RegExp
}

export type LayeredEnvResult = {
  /** 実際に読めたファイル */
  loadedFrom: string[]
  /** fallback から補った変数のうち watch に当たった名前 */
  filledFromFallback: string[]
}

function applyFile(file: string, env: NodeJS.ProcessEnv): string[] {
  if (!fs.existsSync(file)) return []
  const parsed = dotenv.parse(fs.readFileSync(file))
  const added: string[] = []
  for (const [k, v] of Object.entries(parsed)) {
    if (env[k] === undefined) {
      env[k] = v
      added.push(k)
    }
  }
  return added
}

export function loadLayeredEnv(opts: LayeredEnvOptions): LayeredEnvResult {
  const env = opts.env ?? process.env
  const loadedFrom: string[] = []

  if (fs.existsSync(opts.secretsPath)) {
    applyFile(opts.secretsPath, env)
    loadedFrom.push(opts.secretsPath)
  }

  let filledFromFallback: string[] = []
  if (fs.existsSync(opts.fallbackPath)) {
    const added = applyFile(opts.fallbackPath, env)
    loadedFrom.push(opts.fallbackPath)
    filledFromFallback = opts.watch ? added.filter(k => opts.watch!.test(k)) : added
  }

  return { loadedFrom, filledFromFallback }
}

/** このプロジェクトの規約の置き場 */
export function defaultSecretsPath(): string {
  return path.join(os.homedir(), 'secrets', 'welfare-equipment-manager', '.env')
}
