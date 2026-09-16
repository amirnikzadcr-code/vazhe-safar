#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — main-menu theme v6 (session AB, user:
«تست کردم… تند و ریتم دار سریع شده — یچی خوب و پخته بساز، گوش هم اذیت
نکنه، صدای تیزش… از ساز سمپل‌های با کیفیت استفاده بکن»)

WHY v5 FELT WRONG: 121 BPM 6/8 + a busy tombak groove + a bright climax
(read: fast, rhythmic, sharp). v5's timbre was accepted — the TEMPO,
the GROOVE and the TOP-END were not.

v6 «شب‌نشینی» — the mature fireside version of the same semi-traditional
Iranian-game language:
  • TEMPO 66 BPM, 4/4 — a slow, breathing harmonic rhythm (one root
    every 2 bars), everything half-note-and-longer. No 6/8 lilt at all.
  • RHYTHM: the drum kit is GONE. Only a whisper-soft dum heartbeat on
    every OTHER downbeat (≈33 BPM pulse — felt, not heard) + a single
    daf swell at each section door. Zero teks, zero shakers.
  • HARMONY: still the bullet-proof drone practice — pads carry
    root+fifth+octave ONLY, so nothing can clash. The bass takes a slow
    modal walk D · C · B♭ · G · A — pure consonance against the drone.
  • LEAD: the v5 instruments, re-voiced warmer and softer — santur with
    the hammer knock reduced 65% and a lower internal LP (velvet
    mallets), ney answers long and breathy, Karplus oud murmuring
    sparse arpeggios, sub-rounded bass, wide slow pad.
  • MASTER: LP 5.3 kHz (every v5 «تیزی» frequency band removed),
    HP 26 Hz, gentle saturation, peak 0.88 — a calmer, quieter master.
  • FORM (24 bars ≈ 87 s seamless loop):
    intro 2 | A 8 (santur) | B 6 (ney) | A' 4 (santur, low dbl) |
    cadence 4 (the iconic A→G→F→E♭→D descent, held long).
Output: public/assets/music/menu6.ogg  (menu5 deleted by caller)
"""
import math
import os
import subprocess

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
OUT = "/home/z/my-project/public/assets/music/menu6.ogg"
rng = np.random.default_rng(2604)

BPM = 66
E8 = 60.0 / BPM / 2          # eighth note = 0.4545 s
BAR = 8                      # eighths per bar (4/4)
LOOP_BARS = 24
LOOP = LOOP_BARS * BAR * E8  # ≈ 87.3 s

D4 = 293.66


def hz(deg):
    """semitones above D4"""
    return D4 * 2 ** (deg / 12.0)


# one root per bar, changes every 2 bars — the slow modal walk
ROOTS = ["D", "D", "D", "D", "C", "C", "D", "D",
         "Bb", "Bb", "D", "D", "G", "G", "C", "C",
         "Bb", "Bb", "A", "A", "D", "D", "D", "D"]
SEMI = {"D": -24, "C": -21, "Bb": -20, "G": -19, "A": -17}

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
music = {s: [np.zeros(int((LOOP + 7) * SR)), np.zeros(int((LOOP + 7) * SR))] for s in STEMS}


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
def santur(f, dur, vel, t60=2.6):
    """4-string course, v6 VOICING: hammer knock reduced 65 %, internal
    LP 4.6 kHz (velvet mallets), longer sustain — a warm bed, never pingy."""
    n = int((dur + 3.0) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det in (-6.0, -2.0, 2.2, 6.5):
        fr = f * 2 ** (det / 1200)
        ph = rng.uniform(0, 2 * math.pi)
        sig += 0.25 * np.sin(2 * math.pi * fr * t + ph)
        sig += 0.25 * 0.30 * np.sin(2 * math.pi * fr * 2.003 * t + ph)
        sig += 0.25 * 0.13 * np.sin(2 * math.pi * fr * 2.99 * t + ph)
        sig += 0.25 * 0.05 * np.sin(2 * math.pi * fr * 4.02 * t + ph)
    sig = butter_lp(sig, 4600) * exp_env(n, t60)
    m = rng.standard_normal(int(0.006 * SR))                # hammer, -65 %
    sig[: len(m)] += butter_bp(m, 1300, 3000) * np.linspace(1, 0, len(m)) * vel * 0.05
    b = int(0.05 * SR)                                      # body knock, soft
    sig[:b] += 0.045 * np.sin(2 * math.pi * 158 * np.arange(b) / SR) * np.linspace(1, 0, b)
    # soften the very first 8 ms (kill the click)
    a = int(0.008 * SR)
    sig[:a] *= np.linspace(0.3, 1, a)
    return sig * vel


def ney(f, dur, vel):
    """breathy reed flute — v6: slower vibrato onset, softer air, longer."""
    n = int((dur + 0.9) * SR)
    t = np.arange(n) / SR
    vib = f * 0.005 * np.clip((t - 0.45) / 0.9, 0, 1) * np.sin(2 * math.pi * 4.1 * t)
    fr = f + vib
    ph = 2 * math.pi * np.cumsum(fr) / SR
    sig = np.sin(ph) + 0.20 * np.sin(2 * ph)
    air = butter_bp(rng.standard_normal(n), f * 0.75, f * 1.3) * 0.12
    swell = np.clip(t / 0.6, 0, 1)
    sig += air * swell
    a = int(0.22 * SR)
    sig[:a] *= np.linspace(0, 1, a) ** 1.3
    rel = int(0.55 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel) ** 1.4
    return butter_lp(sig, 3600) * vel


def oud(f, dur, vel):
    """Karplus-Strong pluck — v6: darker excitation, LP 2.4 kHz murmur."""
    n = int(max(dur, 1.2) * SR)
    N = max(int(SR / f), 2)
    exc = butter_lp(rng.standard_normal(N), min(f * 7, 3200), order=1)
    exc /= np.abs(exc).max() + 1e-9
    decay = 0.9968 - f * 8e-8
    y = np.zeros(n)
    y[:N] = exc
    for i in range(N, n):
        y[i] = decay * 0.5 * (y[i - N] + y[i - N + 1])
    y[: int(0.005 * SR)] *= np.linspace(0.3, 1, int(0.005 * SR))
    return butter_lp(y, 2400) * vel


def bassnote(f, dur, vel):
    """deep round bass, v6: even softer attack, LP 380 — felt not pointed."""
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    sig = 0.60 * np.sin(2 * math.pi * f * t)
    sig += 0.26 * np.sin(2 * math.pi * f * 2 * t)
    sig += 0.08 * np.sin(2 * math.pi * f * 3 * t)
    sub = 0.08 * np.sin(2 * math.pi * f * 0.5 * t)
    sig = butter_lp(sig + sub, 300)
    a = int(0.05 * SR)                       # slow, soft onset
    sig[:a] *= np.linspace(0, 1, a) ** 0.8
    rel = int(0.18 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel


def padfifth(root_semi, dur, vel=1.0):
    """open-fifth pad — v6: 1.1 s attack, LP 1.0 kHz, gentle 2-bar glue."""
    n = int((dur + 1.1) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for s, a in [(0, 0.10), (7, 0.070), (12, 0.055), (19, 0.026)]:
        for det in (-3.2, 3.2):
            fr = hz(root_semi + s) * 2 ** (det / 1200)
            sig += a * 0.5 * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6.28))
    sig = butter_lp(sig, 1000)
    at = int(1.1 * SR)
    sig[:at] *= np.linspace(0, 1, at) ** 1.5
    rel = int(0.9 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel


def dum_soft(vel=1.0):
    """the whisper heartbeat — v5's dum, halved in level, LP 700."""
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    fr = 130 * np.exp(-t * 20) + 78
    sig = np.sin(2 * math.pi * np.cumsum(fr) / SR) * exp_env(n, 0.19)
    m = butter_bp(rng.standard_normal(int(0.025 * SR)), 80, 300) * exp_env(int(0.025 * SR), 0.03)
    sig[: len(m)] += m * 0.22
    return butter_lp(sig, 700) * vel * 0.30


def daf_swell(vel=1.0):
    """one soft daf swell at a section door — body only, jingle almost nil."""
    n = int(0.20 * SR)
    body = butter_bp(rng.standard_normal(n), 240, 850) * exp_env(n, 0.085)
    jingle = butter_bp(rng.standard_normal(n), 4200, 6400) * exp_env(n, 0.05)
    return (body * 0.85 + jingle * 0.10) * vel * 0.13


# ─────────────────────────── composition ─────────────────────────────
# (semitone degree, durEighths) per bar — degree -1 = rest. Sums to 8.
# Palette: D F G A B♭ C — the E♭ (1) only as a passing neighbour to D.
MEL = {
 # intro (2 bars) — pad + bass only; a soft santur pickup leads in
 1: [(-1, 6), (0, 1), (3, 1)],
 # Theme A — slow Shur breathing: low murmur, rise, return
 2: [(0, 4), (3, 2), (5, 2)],
 3: [(7, 3), (5, 2), (3, 2), (0, 1)],
 4: [(10, 4), (7, 2), (5, 2)],
 5: [(7, 4), (5, 2), (3, 2)],
 6: [(8, 3), (7, 2), (5, 3)],
 7: [(5, 2), (3, 2), (1, 1), (0, 3)],
 # Theme B — the ney sings (bars 10-15), santur shimmer an octave above
 10: [(8, 2), (7, 2), (5, 2), (3, 2)],
 11: [(3, 2), (1, 2), (0, 4)],
 12: [(5, 4), (7, 2), (8, 2)],
 13: [(10, 3), (8, 2), (7, 3)],
 14: [(8, 4), (7, 2), (5, 2)],
 15: [(7, 2), (5, 2), (3, 2), (0, 2)],
 # A' — santur returns, richer (low octave double on the long notes)
 16: [(0, 2), (3, 2), (5, 2), (7, 2)],
 17: [(8, 3), (7, 2), (5, 3)],
 18: [(7, 3), (10, 2), (8, 3)],
 19: [(5, 2), (7, 2), (5, 2), (3, 2)],
 20: [(8, 2), (5, 2), (3, 2), (0, 2)],
 21: [(7, 3), (10, 2), (12, 3)],
 # cadence — the iconic descent, held long: A… G… F… E♭ D…
 22: [(7, 4), (5, 4)],
 23: [(3, 3), (1, 2), (0, 3)],
}
NEY_BARS = {10, 11, 12, 13, 14, 15}
SECTION_DOORS = {2, 10, 16, 22}          # daf swell here


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
            if deg >= 0:
                if b in NEY_BARS:
                    place(t0, ney(hz(deg + 12), max(d, 0.9), 0.42), -0.08)
                    place(t0, santur(hz(deg + 24), d + 0.8, 0.12), 0.30)
                else:
                    p = 0.20 if (int(pos * 2) % 2) else -0.20
                    place(t0, santur(hz(deg + 12), max(d, 0.9), 0.48), p)
                    # warm low double on the long held notes
                    if dur >= 3:
                        place(t0 + 0.012, santur(hz(deg), d + 0.7, 0.18), 0.0)
                    # dotted-quarter echo (1.5 beats at 66 BPM = 3 eighths)
                    place(t0 + 3 * E8, santur(hz(deg + 12), d + 0.7, 0.13), p * 0.6,
                          stem="echo")
            pos += dur


def render_bass_and_harmony():
    for b in range(0, LOOP_BARS, 2):
        t0 = bar_t(b)
        root = SEMI[ROOTS[b]]
        f = hz(root)
        place(t0, bassnote(f, (2 * BAR - 0.6) * E8, 0.20), 0.0)   # one bass per 2 bars
        place(t0, padfifth(root + 12, (2 * BAR - 0.4) * E8, 0.45))  # pad an octave up
        # sparse oud murmur arpeggio at the group start
        for i, s in enumerate([0, 7, 12, 19]):
            place(t0 + 0.5 * E8 + i * 0.045, oud(hz(root + s + 12), 1.7, 0.13), -0.24)
        # a single answering pluck mid-group
        place(t0 + 4 * E8, oud(hz(root + 19), 1.4, 0.09), -0.20)


def render_percussion():
    for b in range(0, LOOP_BARS, 2):
        place(bar_t(b), dum_soft(1.0))            # every OTHER downbeat ≈ 33 BPM
    for b in SECTION_DOORS:
        place(bar_t(b), daf_swell(1.0))


# ────────────────────── echo bus, loop fold, master ──────────────────
def fold_and_master():
    L = int(LOOP * SR)
    echo = music["echo"]
    main = music["main"]
    dq = 3 * E8                                    # dotted quarter = 1.364 s
    taps = [(0.0, 1.0), (dq, 0.40), (2 * dq, 0.18), (3 * dq, 0.085)]
    mixdown = np.zeros((L, 2))
    for chn in (0, 1):
        base = main[chn][:L].copy()
        tail = main[chn][L:L + int(6.5 * SR)]
        base[: len(tail)] += tail[:L]
        e = echo[chn][:L + int(6.5 * SR)]
        for delay, g in taps:
            src = e if delay == 0.0 else np.concatenate([e[int(delay * SR):], np.zeros(int(delay * SR))])
            src = butter_lp(src, 2800)
            if len(src) > L:
                base[: len(src) - L] += src[L:] * g * 0.5
                base += src[:L] * g * 0.5
            else:
                base[: len(src)] += src * g * 0.5
        mixdown[:, chn] = base

    mixdown = sosfilt(butter(2, 26 / (SR / 2), btype="high", output="sos"), mixdown, axis=0)
    mixdown = sosfilt(butter(3, 5300 / (SR / 2), btype="low", output="sos"), mixdown, axis=0)
    mixdown = np.tanh(mixdown * 1.10) * 0.86
    mixdown /= max(np.abs(mixdown).max(), 1e-9) * 1.43    # peak 0.70 → vorbis decode overshoot headroom
    return mixdown


if __name__ == "__main__":
    render_melody()
    render_bass_and_harmony()
    render_percussion()
    mixdown = fold_and_master()
    raw = "/tmp/menu6_f32.raw"
    mixdown.astype(np.float32).tofile(raw)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
        "-c:a", "libvorbis", "-q:a", "5", OUT,
    ], check=True)
    os.remove(raw)
    rms = float(np.sqrt((mixdown ** 2).mean()))
    print(f"OK menu6.ogg  loop={LOOP:.1f}s  rms={rms:.4f}  size={os.path.getsize(OUT)//1024}KB")
