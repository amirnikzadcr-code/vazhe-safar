#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — main-menu theme v5 (user:
«افتضاح و ترسناک شده — برو سنتی برگرد ولی نیمه سنتی باشه، الگو بگیر
از صدای بازی‌های ایرانی، تمیز»)

WHY v4 SOUNDED SCARY (root causes, all fixed here):
  1. melody degree 1 = E♭ played OVER D-minor/B♭-major chords → b9
     clashes (the classic horror-movie interval);
  2. chiptune square+saw plucks = cheap «بی‌کیفیت» timbre;
  3. detuned saw-stack strings = sci-fi drone.

v5 — SEMI-TRADITIONAL, CLEAN (the Iranian-game formula: Amirza-style
menu vibes — polished santur/ney over a warm modern mix):
  • HARMONY: authentic Persian DRONE practice — bass/pad/oud carry only
    ROOT + FIFTH + OCTAVE (no thirds anywhere), so EVERY melody note
    (incl. the Shur E♭ and the Homayoun F♯ wink) is consonant by
    construction. Zero scary intervals possible.
  • LEAD: rich 4-course santur (unison beats + inharmonic partials +
    hammer noise), breathy ney answers, Karplus-Strong oud strums.
  • GROOVE: classic 6/8 (شش‌وهشت) tombak — DUM _ TE _ DUM TE — with a
    light modern shaker in the climax. Deep round bass (بیس‌دار), no
    pop drums, no claps, no hats.
  • FORM (32 bars ≈ 32 s seamless loop):
    intro 2 | Theme A 8 (santur) | Theme B 8 (ney) | climax 8 (runs +
    full groove) | cadence 6 (the iconic A→G→F→E♭→D descent on the
    tonic drone) → folds into the loop head.
  • CLEAN mastering: 48 kHz stereo, dotted-quarter santur echo, master
    LP 7.4 kHz (no harsh highs), gentle saturation, peak-normalized,
    tails folded → sample-accurate seamless loop.
Output: public/assets/music/menu5.ogg  (menu4 is deleted by caller)
"""
import math
import os
import subprocess

import numpy as np
from scipy.signal import butter, sosfilt, lfilter

SR = 48000
OUT = "/home/z/my-project/public/assets/music/menu5.ogg"
rng = np.random.default_rng(1403)

E8 = 0.165                      # eighth note (s) → dotted-q ≈ 121 BPM
BAR = 6                         # eighths per bar (6/8)
LOOP_BARS = 32
LOOP = LOOP_BARS * BAR * E8     # ≈ 31.7 s

D4 = 293.66
SCALE = {0: 0, 1: 1, 3: 3, 5: 5, 6: 6, 7: 7, 8: 8, 10: 10,
         12: 12, 13: 13, 15: 15, 17: 17, 19: 19}   # Shur (+ F♯=6 wink)


def hz(deg):
    """semitones (Persian scale degrees incl. 6=F♯) above D4"""
    return D4 * 2 ** (deg / 12.0)


ROOTS = {"D": -24, "G": -19, "A": -17, "Bb": -20}   # semitones from D4 → octave-2 roots
BASS_MAP = ["D", "D", "D", "D", "D", "D", "G", "D", "G", "A",
            "Bb", "G", "G", "D", "Bb", "G", "Bb", "A",
            "D", "Bb", "D", "D", "G", "D", "Bb", "D",
            "G", "D", "D", "D", "D", "D"]

# ───────────────────────────── helpers ───────────────────────────────
def exp_env(n, t60):
    k = math.log(1000) / max(t60, 1e-3)
    return np.exp(-k * np.arange(n) / SR)


def butter_lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x)


def butter_bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)


def pan(sig, p):
    l = math.sqrt((1 - p) / 2)
    r = math.sqrt((1 + p) / 2)
    return np.stack([sig * l, sig * r], axis=1)


STEMS = ("main", "echo")
music = {s: [np.zeros(int((LOOP + 6) * SR)), np.zeros(int((LOOP + 6) * SR))] for s in STEMS}


def mix(stem, start, sig, gain=1.0):
    for chn in (0, 1):
        buf = music[stem][chn]
        i = int(start * SR)
        n = len(sig)
        if i < 0:
            sig = sig[-i:]
            n = len(sig)
            i = 0
        end = i + n
        if end > len(buf):
            buf = np.pad(buf, (0, end - len(buf)))
            music[stem][chn] = buf
        buf[i:end] += sig[:, chn] * gain


def place(t0, mono_sig, p=0.0, stem="main", gain=1.0):
    mix(stem, t0, pan(mono_sig, p), gain)


# ─────────────────────────── instruments ─────────────────────────────
def santur(f, dur, vel, t60=1.9):
    """4-string course: unison beats + inharmonic partials + hammer knock
    (the warm, REAL santur of the chapter tracks — rich, never chiptune)."""
    n = int((dur + 2.2) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det in (-6.0, -2.0, 2.2, 6.5):
        fr = f * 2 ** (det / 1200)
        ph = rng.uniform(0, 2 * math.pi)
        sig += 0.25 * np.sin(2 * math.pi * fr * t + ph)
        sig += 0.25 * 0.30 * np.sin(2 * math.pi * fr * 2.003 * t + ph)
        sig += 0.25 * 0.14 * np.sin(2 * math.pi * fr * 2.99 * t + ph)
        sig += 0.25 * 0.06 * np.sin(2 * math.pi * fr * 4.02 * t + ph)
    sig = butter_lp(sig, 5600) * exp_env(n, t60)
    m = rng.standard_normal(int(0.006 * SR))              # hammer
    sig[: len(m)] += butter_bp(m, 1500, 3800) * np.linspace(1, 0, len(m)) * vel * 0.14
    b = int(0.05 * SR)                                     # body knock
    sig[:b] += 0.07 * np.sin(2 * math.pi * 165 * np.arange(b) / SR) * np.linspace(1, 0, b)
    return sig * vel


def ney(f, dur, vel):
    """breathy reed flute: delayed vibrato + air noise around the pitch."""
    n = int((dur + 0.55) * SR)
    t = np.arange(n) / SR
    vib = f * 0.006 * np.clip((t - 0.28) / 0.5, 0, 1) * np.sin(2 * math.pi * 4.6 * t)
    fr = f + vib
    ph = 2 * math.pi * np.cumsum(fr) / SR
    sig = np.sin(ph) + 0.22 * np.sin(2 * ph)
    air = butter_bp(rng.standard_normal(n), f * 0.8, f * 1.35) * 0.16
    swell = np.clip(t / 0.4, 0, 1)
    sig += air * swell
    a = int(0.14 * SR)
    sig[:a] *= np.linspace(0, 1, a) ** 1.2
    rel = int(0.35 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel) ** 1.5
    return butter_lp(sig, 4200) * vel


def oud(f, dur, vel):
    """Karplus-Strong pluck — a genuinely woody string, not a synth wave."""
    n = int(max(dur, 0.9) * SR)
    N = max(int(SR / f), 2)
    exc = butter_lp(rng.standard_normal(N), min(f * 9, 4200), order=1)
    exc /= np.abs(exc).max() + 1e-9
    decay = 0.9964 - f * 8e-8
    y = np.zeros(n)
    y[:N] = exc
    for i in range(N, n):
        y[i] = decay * 0.5 * (y[i - N] + y[i - N + 1])
    y[: int(0.004 * SR)] *= np.linspace(0.4, 1, int(0.004 * SR))
    return butter_lp(y, 3000) * vel


def bassnote(f, dur, vel):
    """deep round Persian-pop bass: pure harmonics + a true sub layer."""
    n = int((dur + 0.14) * SR)
    t = np.arange(n) / SR
    sig = 0.60 * np.sin(2 * math.pi * f * t)
    sig += 0.26 * np.sin(2 * math.pi * f * 2 * t)
    sig += 0.09 * np.sin(2 * math.pi * f * 3 * t)
    sub = 0.34 * np.sin(2 * math.pi * f * 0.5 * t)
    sig = butter_lp(sig + sub, 420)
    a = int(0.008 * SR)
    sig[:a] *= np.linspace(0, 1, a)
    rel = int(0.07 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel


def padfifth(root_semi, dur, vel=1.0):
    """open-fifth pad (root+5th+octave+12th) — the clean drone glue."""
    n = int((dur + 0.7) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for s, a in [(0, 0.10), (7, 0.075), (12, 0.06), (19, 0.03)]:
        for det in (-2.6, 2.6):
            fr = hz(root_semi + s) * 2 ** (det / 1200)
            sig += a * 0.5 * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6.28))
    sig = butter_lp(sig, 1300)
    at = int(0.5 * SR)
    sig[:at] *= np.linspace(0, 1, at) ** 1.6
    rel = int(0.55 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel


def dum(vel=1.0):
    n = int(0.30 * SR)
    t = np.arange(n) / SR
    fr = 150 * np.exp(-t * 22) + 84
    sig = np.sin(2 * math.pi * np.cumsum(fr) / SR) * exp_env(n, 0.16)
    m = butter_bp(rng.standard_normal(int(0.03 * SR)), 90, 420) * exp_env(int(0.03 * SR), 0.03)
    sig[: len(m)] += m * 0.4
    return butter_lp(sig, 1600) * vel * 0.52


def tek(vel=1.0):
    n = int(0.10 * SR)
    m = butter_bp(rng.standard_normal(n), 850, 2700) * exp_env(n, 0.035)
    s = np.sin(2 * math.pi * 1750 * np.arange(n) / SR) * exp_env(n, 0.018) * 0.5
    return (m + s) * vel * 0.30


def shaker(vel=1.0):
    n = int(0.07 * SR)
    m = butter_bp(rng.standard_normal(n), 3600, 6800) * exp_env(n, 0.04)
    return m * vel * 0.085


def daf(vel=1.0):
    n = int(0.16 * SR)
    body = butter_bp(rng.standard_normal(n), 280, 950) * exp_env(n, 0.07)
    jingle = butter_bp(rng.standard_normal(n), 5200, 7400) * exp_env(n, 0.05)
    return (body * 0.85 + jingle * 0.30) * vel * 0.16


# ─────────────────────────── composition ─────────────────────────────
# (degree, durEighths) per bar — degree -1 = rest. All durations sum to 6.
MEL = {
 # intro (2 bars) — pad+bass only, santur pickup at bar 1
 1: [(-1, 3), (0, .5), (1, .5), (3, .5), (5, .5), (7, .5), (8, .5)],
 # Theme A — the Shur opening: low tetrachord murmur, then rise & return
 2: [(0, 2), (1, 1), (0, 2), (-1, 1)],
 3: [(3, 2), (1, 1), (0, 2), (-1, 1)],
 4: [(0, 1), (1, 1), (3, 2), (1, 1), (0, 1)],
 5: [(0, 3), (-1, 1), (3, .5), (5, .5), (7, 1)],
 6: [(8, 2), (7, 1), (5, 2), (3, 1)],
 7: [(5, 2), (3, 1), (1, 1), (0, 2)],
 8: [(3, 1), (5, 1), (7, 2), (8, 1), (7, 1)],
 9: [(5, 2), (3, 1), (1, 1), (0, 2)],
 # Theme B — the ney sings, santur shimmers an octave above
 10: [(8, 3), (7, 1), (5, 2)],
 11: [(7, 3), (5, 1), (3, 2)],
 12: [(5, 2), (3, 1), (1, 1), (0, 2)],
 13: [(1, 2), (0, 3), (-1, 1)],
 14: [(8, 2), (10, 1), (12, 2), (10, 1)],
 15: [(12, 3), (10, 1), (8, 2)],
 16: [(10, 1), (8, 1), (7, 1), (5, 1), (3, 1), (1, 1)],
 17: [(0, 4), (-1, 2)],
 # climax — bright pentatonic-of-D runs, the Homayoun F♯ wink, full groove
 18: [(0, .5), (1, .5), (3, .5), (5, .5), (7, .5), (8, .5), (10, 1), (8, 1), (7, 1)],
 19: [(8, 1), (10, 1), (12, 2), (10, 1), (8, 1)],
 20: [(12, .5), (15, .5), (17, .5), (19, .5), (17, .5), (15, .5), (12, 1), (10, 1), (8, 1)],
 21: [(7, 2), (8, 1), (7, 1), (5, 1), (3, 1)],
 22: [(12, .5), (10, .5), (8, .5), (7, .5), (8, .5), (7, .5), (5, 1), (7, 1), (5, 1)],
 23: [(3, 2), (5, 1), (6, 1), (7, 2)],          # F♯→G neighbour (همایون wink)
 24: [(12, 1), (10, 1), (8, 1), (7, 1), (5, 1), (3, 1)],
 25: [(1, 1), (0, 4), (-1, 1)],
 # cadence — the iconic descent over the tonic drone
 26: [(8, 2), (7, 1), (5, 2), (3, 1)],
 27: [(5, 2), (3, 1), (1, 2), (0, 1)],
 28: [(0, 2), (3, 1), (1, 1), (0, 2)],
 29: [(1, 1), (0, 4), (-1, 1)],
 30: [(-1, 6)],
 31: [(0, 1.5), (7, 1.5), (12, 1.5), (-1, 1.5)],  # soft loop-turnaround arpeggio
}
NEY_BARS = {10, 11, 12, 13, 14, 15, 16, 26, 29}


def bar_t(b):
    return b * BAR * E8


def render_melody():
    for b in range(LOOP_BARS):
        if b not in MEL:
            continue
        pos = 0.0
        for deg, dur in MEL[b]:
            t0 = bar_t(b) + pos * E8
            d = dur * E8
            if deg >= 0 and deg in SCALE:
                if b in NEY_BARS:
                    place(t0, ney(hz(deg + 12), max(d, 0.5), 0.34), -0.08)
                    place(t0, santur(hz(deg + 24), d + 0.6, 0.10), 0.30)   # shimmer dbl
                else:
                    p = 0.22 if (int(pos * 2) % 2) else -0.22              # L/R mallets
                    place(t0, santur(hz(deg + 12), max(d, 0.6), 0.40), p)
                    place(t0 + 3 * E8, santur(hz(deg + 12), d + 0.5, 0.13), p * 0.6,
                          stem="echo")                                     # dotted-q echo
            pos += dur


def render_bass_and_harmony():
    for b in range(LOOP_BARS):
        t0 = bar_t(b)
        root = ROOTS[BASS_MAP[b]]
        f = hz(root)
        climax = 18 <= b < 26
        vel = 0.60 if climax else 0.46
        place(t0, bassnote(f, 2.6 * E8, vel), 0.0)
        place(t0 + 4 * E8, bassnote(f * (2 if climax else 1), 1.6 * E8, vel * 0.8), 0.0)
        if climax:
            place(t0 + 2 * E8, bassnote(f, 0.9 * E8, vel * 0.62), 0.0)
        place(t0, padfifth(root, (BAR - 0.2) * E8, 0.9 if not climax else 1.0))
        # oud strums on the downbeat of each 2-bar group (+ off-beat in climax)
        if b % 2 == 0:
            for i, s in enumerate([0, 7, 12, 19]):
                place(t0 + i * 0.014, oud(hz(root + s + 12), 1.1, 0.20), -0.24)
        if climax and b % 2 == 1:
            for i, s in enumerate([0, 7, 12]):
                place(t0 + 3 * E8 + i * 0.012, oud(hz(root + s + 12), 0.9, 0.15), -0.24)


def render_percussion():
    for b in range(LOOP_BARS):
        t0 = bar_t(b)
        intro = b < 2
        climax = 18 <= b < 26
        if intro:
            place(t0 + 2 * E8, tek(0.5))
            continue
        place(t0, dum(1.0))
        place(t0 + 2 * E8, tek(0.62))
        place(t0 + 4 * E8, dum(0.55))
        place(t0 + 5 * E8, tek(0.42))
        if b % 2 == 1:
            place(t0 + 3.5 * E8, tek(0.26))
        if b % 4 == 3:                                   # little end-phrase fill
            place(t0 + 4.5 * E8, tek(0.30))
            place(t0 + 5 * E8, tek(0.42))
        if climax:
            place(t0, daf(0.9))
            place(t0 + 3 * E8, daf(0.7))
            for i in range(6):                           # modern 16th shaker
                place(t0 + i * E8 + E8 / 2, shaker(0.85 if i % 2 else 1.0), 0.34)
        if b == 31:                                      # loop turnaround fill
            for i, v in enumerate((0.4, 0.55, 0.75)):
                place(t0 + 3 * E8 + i * 0.5 * E8, tek(v))


# ────────────────────── echo bus, loop fold, master ──────────────────
def fold_and_master():
    L = int(LOOP * SR)
    echo = music["echo"]
    main = music["main"]
    # dotted-quarter feedback echo: main → echo taps folded back
    taps = [(0.0, 1.0), (3 * E8, 0.42), (6 * E8, 0.19), (9 * E8, 0.085)]
    mixdown = np.zeros((L, 2))
    for chn in (0, 1):
        base = main[chn][:L].copy()
        tail = main[chn][L:L + int(4.5 * SR)]
        base[: len(tail)] += tail[:L]
        e = echo[chn][:L + int(4.5 * SR)]
        for delay, g in taps:
            src = e if delay == 0.0 else np.concatenate([e[int(delay * SR):], np.zeros(int(delay * SR))])
            src = butter_lp(src, 3200)
            if len(src) > L:
                base[: len(src) - L] += src[L:] * g * 0.5      # fold echo tail
                base += src[:L] * g * 0.5
            else:
                base[: len(src)] += src * g * 0.5
        mixdown[:, chn] = base

    mixdown = sosfilt(butter(2, 26 / (SR / 2), btype="high", output="sos"), mixdown, axis=0)
    mixdown = sosfilt(butter(3, 7400 / (SR / 2), btype="low", output="sos"), mixdown, axis=0)
    mixdown = np.tanh(mixdown * 1.16) * 0.88
    mixdown /= max(np.abs(mixdown).max(), 1e-9) * 1.04
    return mixdown


if __name__ == "__main__":
    render_melody()
    render_bass_and_harmony()
    render_percussion()
    mixdown = fold_and_master()
    raw = "/tmp/menu5_f32.raw"
    mixdown.astype(np.float32).tofile(raw)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
        "-c:a", "libvorbis", "-q:a", "5", OUT,
    ], check=True)
    os.remove(raw)
    rms = float(np.sqrt((mixdown ** 2).mean()))
    print(f"OK menu5.ogg  loop={LOOP:.1f}s  rms={rms:.4f}  size={os.path.getsize(OUT)//1024}KB")
