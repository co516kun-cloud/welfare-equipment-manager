# ラベル印刷エージェント

「ラベルを印刷する」を押したら、キュー画面を開かなくてもプリンタから出るようにする仕組み。

```
スマホ / PC で「ラベルを印刷する」
        │ INSERT
        ▼
Supabase: label_print_queue（status = pending）
        │ Realtime で即通知（無ければ 15 秒ごとの polling）
        ▼
事務所PC で常駐しているこのエージェント
        │ scripts/print-label.ps1（b-PAC COM）
        ▼
Brother QL-800 から出る → status = completed
```

キューのテーブルと画面（/label-queue）は残る。画面は「状況を見る・失敗したら再印刷」の場所になる。

## セットアップ（プリンタがつながっている Windows PC で 1 回だけ）

1. **認証情報** — `~/secrets/welfare-equipment-manager/.env`（WSL 側）に追記

   ```
   PRINT_AGENT_EMAIL=<Supabase Auth のメール>
   PRINT_AGENT_PASSWORD=<そのパスワード>
   ```

   専用アカウントを 1 つ作るのが望ましい。未設定なら `MCP_USER_EMAIL` / `MCP_USER_PASSWORD` を流用する。

2. **ビルド**（WSL）

   ```bash
   cd mcp-server && npm run build
   ```

3. **自動起動の登録**（Windows の PowerShell。管理者権限は不要）

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\print-agent\install-task.ps1
   ```

   ログオン時に自動で立ち上がり、その場でも起動する。

4. **（任意）Realtime を有効化** — `sql/enable-realtime-label-print-queue.sql` を Supabase の SQL Editor で実行。
   これを流すと「押して 1〜3 秒」になる。流さなくても 15 秒以内には出る。

## 確認

```bash
# WSL
tail -f ~/print-agent.log
```

起動直後にこう出ていれば動いている:

```
… ログイン成功: xxx@example.com として動作（printed_by = print-agent@PC名）
… 印刷スクリプト: C:\...\scripts\print-label.ps1
… Realtime 購読開始（label_print_queue）
… 待機中（polling 15 秒）
```

アプリのどこかで「ラベルを印刷する」を押すと、数秒後に `WC-001: completed` のような行が増える。

## 止める・外す

```powershell
Stop-ScheduledTask -TaskName WelfareLabelPrintAgent
Unregister-ScheduledTask -TaskName WelfareLabelPrintAgent -Confirm:$false
```

Stop で PowerShell は終わるが、WSL 側の node が残ることがある。念のため WSL で:

```bash
pkill -f '^node mcp-server/dist/print-agent/index.js'
```

動いているか:

```powershell
Get-ScheduledTask -TaskName WelfareLabelPrintAgent | Get-ScheduledTaskInfo
# LastTaskResult = 267009 が「実行中」。0 は終了、1 は起動失敗
```

## ハマりどころ（2026-09-04 実測）

- **`.ps1` は UTF-8 BOM 付きで保存する。** PowerShell 5.1 は BOM 無しを Shift-JIS として読み、日本語文字列の途中で閉じ引用符を食ってパースエラーになる。タスクは「正常終了」と言うのにエージェントが上がらない、という見え方になる。`head -c 3 file | od -An -tx1` が `ef bb bf` なら OK。
- **`wsl.exe` を `Start-Process -WindowStyle Hidden` で起動しない。** コンソール無しで起動された wsl.exe は即終了する。`launch.ps1` はインラインで呼んで待つ形にしてあり、窓を隠すのは外側の PowerShell（タスクの `-WindowStyle Hidden`）に任せている。

## 挙動の細かいところ

- **PC が落ちていたら** — 押した分は pending のまま残り、PC が起動した瞬間にまとめて出る。消えない。
- **同時に 2 プロセス**（MCP の `print_label_queue` と併用など）— 行を取るときに `status='pending'` を条件にしているので、先に取った方だけが刷る。二重には出ない。
- **12 秒待っても出ない**（`queued`）— スプーラに渡した状態で `printing` のまま置く。次の周回でスプーラが空なら「出た」と見なして `completed` にする。自分が `printing` にした行だけが対象。
- **失敗** — `failed` + エラー内容。/label-queue の「再印刷」で pending に戻せる。
- **1 分以上 pending のまま** — /label-queue に「エージェントが動いていない可能性」の警告が出る。

## 環境変数（すべて任意）

| 変数 | 既定 | 意味 |
|---|---|---|
| `PRINT_AGENT_NAME` | `print-agent@<PC名>` | `printed_by` に入る名前 |
| `PRINT_AGENT_POLL_MS` | `15000` | polling 間隔 |
| `LABEL_PRINTER_NAME` | `Brother QL-800` | プリンタ名 |
| `LABEL_PRINT_SCRIPT` | リポジトリから自動計算 | `print-label.ps1` の Windows パス |

## ファイル

| ファイル | 役割 |
|---|---|
| `mcp-server/src/print-agent/core.ts` | 判断部分（PowerShell 出力の解釈・更新内容の決定）。I/O なし |
| `mcp-server/src/print-agent/agent.ts` | キュー消化ループ。Supabase と PowerShell は依存注入 |
| `mcp-server/src/print-agent/index.ts` | 起動・認証・Realtime・polling・PowerShell 呼び出し |
| `scripts/print-agent/run.sh` | WSL 側の起動ラッパ（nvm を読んで node を起動、ログを `~/print-agent.log` へ） |
| `scripts/print-agent/launch.ps1` | Windows 側から WSL の run.sh を「見えない窓」で起動する |
| `scripts/print-agent/install-task.ps1` | Windows タスクスケジューラに launch.ps1 を登録 |
| `scripts/print-label.ps1` | 既存。b-PAC COM でラベル 1 枚を刷る |
