<#
  印刷エージェントを WSL 上で起動する（Windows 側・タスクスケジューラから呼ばれる）

  手でも呼べる:
    powershell -ExecutionPolicy Bypass -File scripts\print-agent\launch.ps1

  🔴 wsl.exe は Start-Process -WindowStyle Hidden で起動すると、コンソールを持たずに即終了する
     （2026-09-04 実測: タスクは「正常終了」なのにエージェントが立ち上がらなかった）。
     だからここでは wsl.exe を**インラインで呼んで待つ**。窓を隠すのは呼び出し側（install-task.ps1 が
     powershell.exe -WindowStyle Hidden で起動する）。この PowerShell はエージェントが生きている間ずっと
     待ち続け、タスクは「実行中」のままになる。Stop-ScheduledTask で止まる。

  リポジトリの場所はこのファイルの位置から計算するので、パスをここに書かない。
  ※ このファイルは UTF-8 BOM 付きで保存すること（PowerShell 5.1 が日本語を Shift-JIS と誤読して壊れる）
#>
param(
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

# このファイル → scripts/print-agent → scripts → リポジトリ直下
$repoWin = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path.TrimEnd('\')
$repoWsl = (& wsl.exe -d $Distro -- wslpath -u ($repoWin -replace '\\', '/')).Trim()
if (-not $repoWsl) { throw "wslpath でパス変換できませんでした（Distro=$Distro）" }

# インラインで呼んで待つ（引数は個別に渡す。文字列を組み立てると引用符の入れ子で壊れる）
& wsl.exe -d $Distro -- bash -lc "cd '$repoWsl' && exec bash scripts/print-agent/run.sh"
exit $LASTEXITCODE
