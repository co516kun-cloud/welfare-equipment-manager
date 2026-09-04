/**
 * ラベル印刷エージェント（PC 常駐）
 *
 * 2026-09-04 作成。田口さん「スマホで押したら即 PC に飛んで PC から実行したことになる方法」。
 *
 * スマホと PC は直接つながらない。両方がつながっている Supabase の label_print_queue を
 * 郵便受けにして、ここが行の到着を拾い scripts/print-label.ps1（b-PAC COM）を呼ぶ。
 * ユーザーから見れば「押したらプリンタから出る」。キュー画面は状況確認用になる。
 *
 * 拾い方は2本立て:
 *   - Realtime: INSERT / status→pending の UPDATE を購読して即座に drain
 *   - polling : 既定 15 秒ごとに drain（Realtime の取りこぼし・PC 復帰時の保険）
 *
 * 認証: PRINT_AGENT_EMAIL / PRINT_AGENT_PASSWORD（無ければ MCP_USER_* を流用）。
 * .env は ~/secrets/welfare-equipment-manager/.env を最優先で読む（CLAUDE.md の規約）。
 *
 * 起動: node mcp-server/dist/print-agent/index.js
 *       （Windows 起動時の自動実行は scripts/print-agent/install-task.ps1）
 */
import { createClient } from '@supabase/supabase-js'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv, defaultSecretsPath } from '../env.js'
import { parsePrintOutput, buildPrintArgs, type PrintResult } from './core.js'
import { createAgent, type QueueRow } from './agent.js'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------- paths / env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// dist/print-agent → mcp-server → リポジトリ直下
const REPO_ROOT = path.resolve(__dirname, '../../..')

/** .env は ~/secrets 優先・リポジトリ直下は補助（MCP サーバと同じ。../env.ts 参照） */
function loadEnv(): void {
  const secrets = defaultSecretsPath()
  const info = loadLayeredEnv({
    secretsPath: secrets,
    fallbackPath: path.join(REPO_ROOT, '.env'),
    watch: /^(VITE_SUPABASE_|MCP_USER_|PRINT_AGENT_|LABEL_)/,
  })
  if (info.filledFromFallback.length > 0) {
    log(`⚠️ ${info.filledFromFallback.join(', ')} をリポジトリ直下の .env から補いました。${secrets} へ移してください`)
  }
  if (info.loadedFrom.length === 0) {
    log(`⚠️ .env が見つかりません（${secrets} / ${path.join(REPO_ROOT, '.env')}）`)
  }
}

function log(message: string): void {
  process.stderr.write(`${new Date().toISOString()} ${message}\n`)
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.PRINT_AGENT_EMAIL ?? process.env.MCP_USER_EMAIL
const PASSWORD = process.env.PRINT_AGENT_PASSWORD ?? process.env.MCP_USER_PASSWORD
const AGENT_NAME = process.env.PRINT_AGENT_NAME ?? `print-agent@${os.hostname()}`
const POLL_MS = Number(process.env.PRINT_AGENT_POLL_MS ?? 15_000)
const PRINTER_NAME = process.env.LABEL_PRINTER_NAME ?? 'Brother QL-800'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  log('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です')
  process.exit(1)
}
if (!EMAIL || !PASSWORD) {
  log('PRINT_AGENT_EMAIL / PRINT_AGENT_PASSWORD（または MCP_USER_*）が未設定です。RLS で 0 件になるので起動しません')
  process.exit(1)
}

// ---------------------------------------------------------------- PowerShell
const IS_WIN = process.platform === 'win32'
const POWERSHELL = IS_WIN
  ? 'powershell.exe'
  : '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

/** print-label.ps1 の Windows パス。WSL からは wslpath で変換する（ハードコードしない） */
function printScriptWinPath(): string {
  if (process.env.LABEL_PRINT_SCRIPT) return process.env.LABEL_PRINT_SCRIPT
  const local = path.join(REPO_ROOT, 'scripts', 'print-label.ps1')
  if (IS_WIN) return local
  return execFileSync('wslpath', ['-w', local]).toString().trim()
}
const PRINT_SCRIPT_WIN = printScriptWinPath()

async function printViaPowerShell(row: QueueRow): Promise<PrintResult> {
  try {
    const { stdout } = await execFileAsync(POWERSHELL, buildPrintArgs(PRINT_SCRIPT_WIN, row), {
      timeout: 90_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    return parsePrintOutput(stdout)
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException
    const message = err.code === 'ENOENT' ? `powershell.exe が見つかりません: ${POWERSHELL}` : err.message ?? String(e)
    return { ok: false, stage: 'spawn', message }
  }
}

/** スプーラに残っているジョブ数。見に行けなければ null */
async function spoolerJobCount(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      POWERSHELL,
      ['-NoProfile', '-Command', `@(Get-PrintJob -PrinterName '${PRINTER_NAME.replace(/'/g, "''")}' -ErrorAction SilentlyContinue).Count`],
      { timeout: 20_000 }
    )
    const n = Number.parseInt(stdout.trim(), 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function signIn(): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! })
  if (error) {
    log(`ログイン失敗: ${error.message}`)
    process.exit(1)
  }
  log(`ログイン成功: ${EMAIL} として動作（printed_by = ${AGENT_NAME}）`)
}

/**
 * 自分が printing にしたまま終わった行の辻褄合わせ。
 * scripts/print-label.ps1 は 12 秒待って出なければ "queued" を返すが、
 * 実際にはその後に出ている（2026-08-18 SL-119 の実測）。
 * スプーラが空なら「送った分は全部出た」と見なして completed にする。
 * ⚠️ 対象は printed_by = 自分 の行だけ。他プロセス（ブラウザ拡張・MCP）の行は触らない。
 */
async function reconcileOwnPrinting(): Promise<void> {
  const n = await spoolerJobCount()
  if (n === null || n > 0) return
  const { data, error } = await supabase
    .from('label_print_queue')
    .update({ status: 'completed', printed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('status', 'printing')
    .eq('printed_by', AGENT_NAME)
    .select('management_id')
  if (error) {
    log(`reconcile 失敗: ${error.message}`)
    return
  }
  if (data && data.length > 0) {
    log(`reconcile: ${data.map(d => d.management_id).join(', ')} をスプーラ空を根拠に completed にした`)
  }
}

const agent = createAgent(
  {
    async listPending(limit) {
      const { data, error } = await supabase
        .from('label_print_queue')
        .select('id, management_id, product_name, condition_notes, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) {
        log(`pending 取得失敗: ${error.message}`)
        return []
      }
      return (data ?? []) as QueueRow[]
    },
    async claim(id, by) {
      // status='pending' を条件に入れることで、先に取られていたら 0 行更新になる
      const { data, error } = await supabase
        .from('label_print_queue')
        .update({ status: 'printing', printed_by: by, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
      if (error) {
        log(`claim 失敗 ${id}: ${error.message}`)
        return false
      }
      return (data?.length ?? 0) > 0
    },
    async applyUpdate(id, update) {
      const { error } = await supabase
        .from('label_print_queue')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) log(`更新失敗 ${id}: ${error.message}`)
    },
    print: printViaPowerShell,
    now: () => new Date(),
    log,
  },
  { by: AGENT_NAME }
)

// ---------------------------------------------------------------- run
let scheduled: NodeJS.Timeout | null = null
function scheduleDrain(reason: string): void {
  // 連続 INSERT を 1 回にまとめる
  if (scheduled) return
  scheduled = setTimeout(async () => {
    scheduled = null
    log(`drain (${reason})`)
    await agent.drain()
  }, 300)
}

async function main(): Promise<void> {
  await signIn()
  log(`印刷スクリプト: ${PRINT_SCRIPT_WIN}`)

  await reconcileOwnPrinting()
  await agent.drain()

  const channel = supabase
    .channel('print-agent')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'label_print_queue' }, () =>
      scheduleDrain('realtime INSERT')
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'label_print_queue', filter: 'status=eq.pending' },
      () => scheduleDrain('realtime 再印刷')
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') log('Realtime 購読開始（label_print_queue）')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        log(`Realtime ${status} — polling だけで続行します（${POLL_MS / 1000} 秒間隔）`)
      }
    })

  const poll = setInterval(async () => {
    await reconcileOwnPrinting()
    await agent.drain()
  }, POLL_MS)

  const shutdown = async (sig: string) => {
    log(`${sig} 受信、終了します`)
    clearInterval(poll)
    if (scheduled) clearTimeout(scheduled)
    await supabase.removeChannel(channel)
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  log(`待機中（polling ${POLL_MS / 1000} 秒）`)
}

main().catch(err => {
  log(`致命的エラー: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  process.exit(1)
})
