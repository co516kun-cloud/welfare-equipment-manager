<#
  ラベル1枚を Brother QL-800 に印刷する（b-PAC COM 経由・ブラウザ不要）

  2026-08-18 作成。田口さん「携帯などの外から指示を出す手段」の最後の1歩。
  アプリ側 src/lib/label-printer.ts は b-PAC の **ブラウザ拡張**を呼んでいて、
  画面を開いて人が押さないと刷れない。ここは同じ b-PAC を **COM** で叩くので、
  WSL のリスナー（L4）から powershell.exe 越しに呼べる。

  🔴 オンライン確認はしない。
     プリンタが消えていてもジョブは Windows のスプーラに溜まり、電源を入れると出る
     （田口さん 2026-08-18「プリンタが落ちてても電源を入れたときに出てくる仕様じゃないの？」）。
     ただし USB 接続なので、電源OFF中にジョブがエラー化する環境もある。
     だから **投げた後にジョブの様子を見て、そのまま返す**。判断は呼び出し側に任せる。

  出力は JSON 1行（stdout）。UTF-8 固定。
#>
param(
  [Parameter(Mandatory = $true)][string]$ManagementId,
  [string]$ProductName    = "",
  [string]$ConditionNotes = "",
  [string]$QrCode         = "",
  [int]$Copies            = 1,
  [string]$Template       = "C:\Users\taguchi\Desktop\claude-kanri\welfare-equipment-manager\public\templates\equipment-label.lbx",
  [string]$PrinterName    = "Brother QL-800",
  # 指定すると印刷せずに画像を書き出す。テープを使わずに差し込み内容を確認する用。
  [string]$PreviewPath    = ""
)

$ErrorActionPreference = "Stop"
# 🔴 これが無いと日本語が CP932 で出て、WSL 側で文字化けする（2026-08-18 実測）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($obj) {
  $obj | ConvertTo-Json -Compress -Depth 4
  exit 0
}

$doc = $null
try {
  $doc = New-Object -ComObject bpac.Document
  if (-not $doc.Open($Template)) {
    Emit @{ ok = $false; stage = "open"; message = "テンプレートを開けません: $Template" }
  }

  # テンプレ側のオブジェクト名。lbx を作り直したら**ここも直す**
  $fields = @{
    ManagementID   = $ManagementId
    ProductName    = $ProductName
    ConditionNotes = $ConditionNotes
    QRCode         = if ($QrCode) { $QrCode } else { $ManagementId }
  }
  $missing = @()
  foreach ($name in $fields.Keys) {
    $obj = $doc.GetObject($name)
    if ($null -eq $obj) { $missing += $name; continue }
    $obj.Text = $fields[$name]
  }
  if ($missing.Count -gt 0) {
    $doc.Close() | Out-Null
    Emit @{ ok = $false; stage = "bind"; message = ("テンプレに無いオブジェクト: " + ($missing -join ",")) }
  }

  # --- 確認モード（印刷しない）---
  if ($PreviewPath) {
    # Export(type, path, dpi)。type=4 が PNG（b-PAC の ExportType）
    $ret = $doc.Export(4, $PreviewPath, 300)
    $doc.Close() | Out-Null
    Emit @{ ok = [bool]$ret; stage = "preview"; path = $PreviewPath }
  }

  # --- 印刷 ---
  $before = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue).Count
  $doc.StartPrint("", 0) | Out-Null
  $doc.PrintOut($Copies, 0)  | Out-Null
  $doc.EndPrint()            | Out-Null
  $doc.Close()               | Out-Null
  $doc = $null

  # スプーラから消えるまで待つ。ラベル1枚は数秒で出る。
  # ⚠️ 2.5秒固定だと、出ているのに "queued" と誤報した（2026-08-18 実測・SL-117）。
  #    消えたら即抜ける／12秒残っていたら本当に待ち行列にいる、と見なす。
  $jobs = @()
  $states = @()
  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Milliseconds 500
    $jobs = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue)
    $states = @($jobs | ForEach-Object { $_.JobStatus.ToString() })
    if ($jobs.Count -le $before) { break }
    if ($states -match "Error|Blocked|PaperOut") { break }
  }
  $errored = @($states | Where-Object { $_ -match "Error|Blocked|Paused|Offline|PaperOut" })

  if ($errored.Count -gt 0) {
    Emit @{ ok = $false; stage = "spool"; jobs = $jobs.Count; states = $states;
            message = "スプーラでジョブが止まっています" }
  }
  if ($jobs.Count -gt $before) {
    # まだキューにいる = プリンタが受け取っていない（電源が入れば出る）
    Emit @{ ok = $true; stage = "queued"; jobs = $jobs.Count; states = $states;
            message = "プリンタに送信しました。まだ待ち行列にいます（電源が入れば出ます）" }
  }
  Emit @{ ok = $true; stage = "printed"; jobs = $jobs.Count; states = $states;
          message = "印刷しました" }
}
catch {
  if ($doc) { try { $doc.Close() | Out-Null } catch {} }
  Emit @{ ok = $false; stage = "exception"; message = $_.Exception.Message }
}
