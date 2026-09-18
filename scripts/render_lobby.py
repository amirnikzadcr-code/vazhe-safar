#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — LOBBY THEME (session HH, user: «موزیک صفحه اصلی رو مثل فصل‌هایی
که تغییر دادیم بکن ولی مخصوص لابی»)

The old menu theme (menu6) is a slow 66-BPM shur mood piece — the user
wants the LOBBY to feel like the BRIGHT chapters we re-scored (mahur,
daf, dancing 6/8) but with its OWN melody, not a chapter clone.

Engine: reused verbatim from render_music.py (same santur/ney/daf
physical models, same reverb + mastering + seamless loop). Only the
musical config is new:
  • scale  mahur (bright, like ch20)
  • bpm    108  (lifts the lobby from sleepy to welcoming)
  • meter  6/8  (the swaying Iranian-game lilt)
  • perc   daf  • lead santur (octave 1) • drone 0.45
  • motif  brand-new A/B phrases written for this track (original)
Output: public/assets/music/lobby.ogg at 48 kHz (no resample in app).
"""
import json, os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, "/home/z/my-project/scripts")
from render_music import render_track, SR, OUT_DIR  # noqa: E402

# ---- pull mahur cents straight from the chapter configs (single source)
CFG = json.load(open("/home/z/my-project/scripts/music_configs.json"))
ch20 = next(it for it in CFG if it["id"] == 19)["music"]

LOBBY = dict(ch20)                      # mahur cents + mahur toolkit
LOBBY.update({
    "track": "lobby",
    "root": 329.63,                     # E4 — a touch brighter than ch20
    "bpm": 108,
    "meter": 6,
    "perc": "daf",
    "lead": "santur",
    "octave": 1,
    "drone": 0.45,
    # A-phrase (12-beat window): rising mahur welcome, dancing 6/8
    "motif": [
        [0, 1], [1, 0.5], [2, 0.5], [3, 1], [4, 1],
        [3, 0.5], [2, 0.5], [4, 1.5], [3, 0.5],
        [5, 1], [4, 1], [2, 1.5],
    ],
    # B-phrase (9-beat window): answering cadence back to the tonic
    "motifB": [
        [7, 1], [5, 0.5], [4, 0.5], [5, 1], [3, 1],
        [2, 0.5], [3, 0.5], [4, 2], [0, 1],
    ],
})

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"render lobby … bpm={LOBBY['bpm']} scale={LOBBY['scale']}", flush=True)
    audio = render_track(LOBBY, seed=4848)
    raw = "/tmp/lobby.wav"
    pcm = (audio.T * 32767).astype(np.int16)
    with wave.open(raw, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    ogg = f"{OUT_DIR}/lobby.ogg"
    # FF — render DIRECTLY at 48 kHz (game pins AudioContext to 48 kHz,
    # decodeAudioData then does zero resampling — no switch jank).
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw,
                    "-c:a", "libvorbis", "-q:a", "5", "-ar", "48000", ogg], check=True)
    print(f"  -> {ogg} {os.path.getsize(ogg)//1024}KB", flush=True)

if __name__ == "__main__":
    main()
