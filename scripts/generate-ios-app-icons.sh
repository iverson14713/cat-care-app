#!/usr/bin/env bash
# Generate iOS AppIcon.appiconset from Pet Care web icons (public/icon-512.png).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/icon-512.png"
MASTER="$ROOT/assets/app-icon-master.png"
OUT="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source icon: $SRC" >&2
  if [[ -f "$MASTER" ]]; then
    echo "Run: python3 scripts/process-app-icon.py (requires Pillow + numpy) to create public icons first." >&2
  fi
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required (macOS)." >&2
  exit 1
fi

mkdir -p "$OUT"

resize() {
  local px="$1"
  local file="$2"
  sips -z "$px" "$px" "$SRC" --out "$OUT/$file" >/dev/null
  echo "  $file (${px}x${px})"
}

echo "Source: $SRC"
echo "Output: $OUT"
echo "Generating icons..."

resize 40  "AppIcon-20@2x.png"
resize 60  "AppIcon-20@3x.png"
resize 58  "AppIcon-29@2x.png"
resize 87  "AppIcon-29@3x.png"
resize 80  "AppIcon-40@2x.png"
resize 120 "AppIcon-40@3x.png"
resize 120 "AppIcon-60@2x.png"
resize 180 "AppIcon-60@3x.png"
resize 20  "AppIcon-ipad-20.png"
resize 40  "AppIcon-ipad-20@2x.png"
resize 29  "AppIcon-ipad-29.png"
resize 58  "AppIcon-ipad-29@2x.png"
resize 40  "AppIcon-ipad-40.png"
resize 80  "AppIcon-ipad-40@2x.png"
resize 76  "AppIcon-ipad-76.png"
resize 152 "AppIcon-ipad-76@2x.png"
resize 167 "AppIcon-ipad-83.5@2x.png"
resize 1024 "AppIcon-1024.png"

# Remove legacy Capacitor placeholder if present
rm -f "$OUT/AppIcon-512@2x.png"

echo "Done."
