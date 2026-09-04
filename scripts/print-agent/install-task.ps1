<#
  ラベル印刷エージェントを Windows ログオン時に自動起動するタスクとして登録する

  使い方（自分のユーザーで。管理者権限は不要）:
    powershell -ExecutionPolicy Bypass -File scripts\print-agent\install-task.ps1
  WSL から呼ぶなら:
    /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/print-agent/install-task.ps1)"

  やること:
    1. タスクスケジューラに "WelfareLabelPrintAgent" を登録（ログオン時・非表示・失敗時3回再試行）
    2. そのまま今すぐ起動する
  外し方:
    Unregister-ScheduledTask -TaskName WelfareLabelPrintAgent -Confirm:$false

  タスクの中身は launch.ps1 を -File で呼ぶだけ（引用符の入れ子を避けるため）。
#>
param(
  [string]$Distro   = "Ubuntu",
  [string]$TaskName = "WelfareLabelPrintAgent"
)

$ErrorActionPreference = "Stop"

$launcher = Join-Path $PSScriptRoot "launch.ps1"
if (-not (Test-Path $launcher)) { throw "launch.ps1 が見つかりません: $launcher" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`" -Distro $Distro"

$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable -Hidden

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "OK: $TaskName を登録して起動しました"
Write-Host "   ログ:  wsl.exe -d $Distro -- tail -f ~/print-agent.log"
Write-Host "   状態:  Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo"
Write-Host "   停止:  Stop-ScheduledTask -TaskName $TaskName"
