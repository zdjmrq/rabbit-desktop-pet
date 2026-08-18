#!/usr/bin/env bash
set -euo pipefail

mkdir -p build/RabbitDesktopPet.iconset
swift scripts/make-macos-icon.swift assets/rabbit-idle.png build/RabbitDesktopPet-1024.png

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" build/RabbitDesktopPet-1024.png \
    --out "build/RabbitDesktopPet.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" build/RabbitDesktopPet-1024.png \
    --out "build/RabbitDesktopPet.iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns build/RabbitDesktopPet.iconset -o build/RabbitDesktopPet.icns
