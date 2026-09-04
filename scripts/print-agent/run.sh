#!/usr/bin/env bash
# ラベル印刷エージェントを起動する（WSL 側）
#
# install-task.ps1 が Windows ログオン時にこれを呼ぶ。手で動かすときも同じ:
#   bash scripts/print-agent/run.sh
#
# ログ: ~/print-agent.log
set -euo pipefail

cd "$(dirname "$0")/../.."

# nvm 経由の node を使う（Task Scheduler から呼ばれると PATH が素の状態）
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi

if [ ! -f mcp-server/dist/print-agent/index.js ]; then
  echo "mcp-server/dist/print-agent/index.js がありません。先に (cd mcp-server && npm run build) を実行してください" >&2
  exit 1
fi

exec node mcp-server/dist/print-agent/index.js >> "$HOME/print-agent.log" 2>&1
