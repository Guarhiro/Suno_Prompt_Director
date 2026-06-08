#!/bin/zsh
set -euo pipefail
unsetopt bgnice 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
APP_URL="http://${HOST}:${PORT}"

echo "Suno Prompt Director を起動します。"
echo "場所: $SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が見つかりません。Node.js をインストールしてから再実行してください。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm が見つかりません。Node.js のインストール状態を確認してください。"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules が見つからないため、依存関係をインストールします。"
  npm install
fi

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  echo ".env.local が見つからないため、.env.example から作成します。"
  cp .env.example .env.local
  echo "必要に応じて .env.local に OpenRouter API キーを設定してください。"
fi

if curl -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "すでに起動しています: $APP_URL"
  open "$APP_URL"
  exit 0
fi

echo "開発サーバーを起動します: $APP_URL"
OPENED_BROWSER=0
npm run dev -- --hostname "$HOST" --port "$PORT" 2>&1 | while IFS= read -r line; do
  echo "$line"

  if [ "$OPENED_BROWSER" -eq 0 ] && echo "$line" | grep -Eq "Ready|Local:"; then
    open "$APP_URL"
    OPENED_BROWSER=1
  fi
done
