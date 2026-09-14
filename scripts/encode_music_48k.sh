#!/usr/bin/env bash
# v4 PERF — re-encode every music OGG at 48 kHz.
# The game pins its AudioContext to 48 kHz (src/game/core/audio.ts); with
# matching files, decodeAudioData skips the main-thread 44.1→48 kHz
# resample — the stall phones felt on every section switch.
set -euo pipefail
DIR="/home/z/my-project/public/assets/music"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for f in "$DIR"/*.ogg; do
  name=$(basename "$f")
  ffmpeg -y -loglevel error -i "$f" -ar 48000 -c:a libvorbis -q:a 5 "$TMP/$name"
  mv "$TMP/$name" "$f"
  echo "ok $name"
done
echo "--- result ---"
for f in "$DIR"/*.ogg; do
  rate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$f")
  size=$(stat -c%s "$f")
  echo "$f  ${rate}Hz  ${size}B"
done
