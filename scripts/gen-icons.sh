#!/usr/bin/env bash
# Rasterise the SVG sources in scripts/src-icons to the PNG icons in public/icons
# using headless Chrome/Chromium (no npm dependency needed).
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}"
render() { # src size out
  local html; html="$(mktemp --suffix=.html)"
  echo "<html><body style='margin:0;background:transparent'><img src='file://$PWD/$1' width=$2 height=$2 style='display:block'></body></html>" > "$html"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$2,$2" --screenshot="$PWD/$3" "file://$html" >/dev/null 2>&1
  rm -f "$html"
}
render scripts/src-icons/icon.svg 192 public/icons/icon-192.png
render scripts/src-icons/icon.svg 512 public/icons/icon-512.png
render scripts/src-icons/maskable.svg 512 public/icons/maskable-512.png
render scripts/src-icons/apple.svg 180 public/icons/apple-touch-icon.png
echo "icons written to public/icons"
