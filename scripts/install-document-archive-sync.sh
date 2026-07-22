#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${MESH_NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(find "$HOME/.cache/codex-runtimes" -path '*/dependencies/node/bin/node' -type f -print -quit 2>/dev/null || true)"
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js was not found. Set MESH_NODE_BIN to the full Node.js executable path." >&2
  exit 1
fi
PLIST="$HOME/Library/LaunchAgents/ae.m3m.document-archive-sync.plist"
LOG_DIR="$HOME/Library/Logs/MeshMedia"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

sed \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PROJECT_DIR/scripts/launchd/ae.m3m.document-archive-sync.plist.template" > "$PLIST"

launchctl bootout "gui/$(id -u)/ae.m3m.document-archive-sync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/ae.m3m.document-archive-sync"

echo "MeshMedia document archive sync installed."
