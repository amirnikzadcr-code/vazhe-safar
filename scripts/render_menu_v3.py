#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — menu theme v3 (session Y, user: «موزیک صفحه اصلی رو حذف کن،
یک موزیک بیس دار شاد ایرانی بدون صدای تیز طراحی کن خیلی خفن و هیجانی»)

A brand-new hand-composed MAIN MENU theme — 100% original:
  • بیس‌دار: a deep round SATURATED sub-bass walking D → D → B♭ → A on
    every dum — the drive of the track (soft attack, never boomy)
  • شاد ایرانی: an energetic 6/8 «رنگارنگ» tombak+daf groove at ~125
    (dum . tak tak tak), full-bar fills every 8th bar, santur melody
    with a ney call-&-answer — instantly Persian, instantly joyful
  • بدون صدای تیز: NO bells/chimes at all; the whole master runs
    through a 7.2 kHz warm lowpass + soft tanh saturation, so every
    edge is rounded (weak phone speakers stay pleasant)
  • هیجانی: 4 escalating cycles — intro groove → theme → ney answer →
    fuller theme with octave accents → bass-walk turnaround
Seamless ~27 s loop, rendered at 48 kHz to match the game's pinned
AudioContext (no resample). Output: public/assets/music/menu3.ogg
"""
import math
import os
import subprocess

import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
OUT = "/home/z/my-project/public/assets/music/menu3.ogg"
rng = np.random.default_rng(20260916)

# ───────────────────────────── tuning ────────────────────────────────
# D-Shur (koron ≈ -50c neutral 2nd), cents from D4 — the mother dastgāh
CENTS = [0, 150, 294, 498, 702, 792, 996, 1200]      # 0..7 (7 = upper tonic)
R4 = 293.66                                           # D4

def f(deg, oct_shift=0):
    return R4 * 2 ** (oct_shift + CENTS[deg] / 1200.0)

E8 = 0.16          # eighth note (s) → dotted-quarter ≈ 125 bpm, driving 6/8
BAR = 6            # eighths per bar
LOOP_BARS = 28     # ≈ 26.9 s
LOOP = LOOP_BARS * BAR * E8

# ───────────────────────────── helpers ───────────────────────────────
def mix(buf, start, sig, gain=1.0):
    i = int(start * SR)
    n = len(sig)
    if i < 0:
        sig = sig[-i:]
        n = len(sig)
        i = 0
    end = i + n
    if end > len(buf):
        buf = np.pad(buf, (0, end - len(buf)))
    buf[i:end] += sig * gain
    return buf

def exp_env(n, t60):
    k = math.log(1000) / max(t60, 1e-3)
    return np.exp(-k * np.arange(n) / SR)

def soft_attack(sig, atk):
    n = min(int(atk * SR), len(sig))
    sig[:n] *= np.linspace(0, 1, n) ** 2
    return sig

def pan(sig, p):  # p in [-1, 1]
    l = math.sqrt((1 - p) / 2)
    r = math.sqrt((1 + p) / 2)
    return np.stack([sig * l, sig * r], axis=1)

def butter_lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x)

def butter_bp(x, lo, hi):
    sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)

# ─────────────────────────── instruments ─────────────────────────────
def santur(freq, dur, vel, t60=2.2):
    """hammered dulcimer: 3 detuned strings, inharmonic shimmer, mallet.
    Rendered WARM: internal 5.5k lowpass keeps every partial round."""
    n = int((dur + 1.8) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det, amp in [(-3.6, 0.34), (0.0, 0.44), (3.4, 0.30)]:
        fr = freq * 2 ** (det / 1200)
        ph = rng.uniform(0, 2 * math.pi)
        sig += amp * np.sin(2 * math.pi * fr * t + ph)
        sig += amp * 0.28 * np.sin(2 * math.pi * fr * 2.003 * t + ph)
        sig += amp * 0.10 * np.sin(2 * math.pi * fr * 3.01 * t + ph)
    sig = butter_lp(sig, 5500)                      # Y: no sharp overtones
    sig *= exp_env(n, t60) * vel
    m = rng.standard_normal(int(0.025 * SR))
    m = butter_bp(m, 1600, 3600) * np.linspace(1, 0, len(m)) * vel * 0.12
    sig[: len(m)] += m
    return soft_attack(sig, 0.004)

def ney(freq, dur, vel, vib_depth=0.007):
    """breathy end-blown flute: warm sine + soft 2nd harmonic, delayed
    vibrato, rounded entrances — the singing counter-voice."""
    n = int((dur + 0.35) * SR)
    t = np.arange(n) / SR
    vib = 5.1 * 2 * math.pi * t
    vib_amp = vib_depth * freq * np.clip((t - 0.28) / 0.5, 0, 1)
    fr = freq + vib_amp * np.sin(vib)
    phase = 2 * math.pi * np.cumsum(fr) / SR
    sig = np.sin(phase) + 0.20 * np.sin(2 * phase) + 0.04 * np.sin(3 * phase)
    breath = butter_bp(rng.standard_normal(n), 700, 2400) * 0.03
    sig = (sig + breath) * vel
    a = min(int(0.09 * SR), n // 3)
    sig[:a] *= np.linspace(0, 1, a) ** 1.5
    rel = int(0.30 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return butter_lp(sig, 4200) * 0.9

def pad(root, dur, vel=1.0):
    """warm low pad: root + fifth + octave, slow swell, heavily softened."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for fr, a in [(root, 0.5), (root * 1.5, 0.26), (root * 2, 0.28)]:
        sig += a * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6))
        sig += a * 0.35 * np.sin(2 * math.pi * fr * 1.004 * t)
    env = np.concatenate([
        np.linspace(0, 1, int(1.4 * SR)),
        np.ones(max(0, n - int(1.4 * SR) - int(1.4 * SR))),
        np.linspace(1, 0, int(1.4 * SR)),
    ])
    return butter_lp(sig[:n] * env[:n] * vel * 0.13, 2400)

def bass(freq, dur, vel, sub=True):
    """THE BASS (user: «بیس دار») — deep round sine + 2nd harmonic,
    soft-saturated for warmth, quick release so it stays tight."""
    n = int((dur + 0.18) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * math.pi * freq * t)
    sig += 0.22 * np.sin(2 * math.pi * freq * 2 * t)
    if sub:
        sig += 0.5 * np.sin(2 * math.pi * freq * 0.5 * t)
    sig = np.tanh(sig * 1.6) * 0.72                 # round saturation
    sig *= exp_env(n, max(0.5, dur * 0.9)) * vel
    return soft_attack(sig, 0.008)

def tom(tone, vel, n=None):
    """tombak/daf hit: pitched thump + skin snap (no bright crack)."""
    if n is None:
        n = int(0.20 * SR)
    t = np.arange(n) / SR
    base = {"dum": 88, "tak": 196, "tek": 264}[tone]
    body = np.sin(2 * math.pi * base * t * (1 - 0.35 * t / 0.20))
    body *= exp_env(n, 0.11 if tone == "dum" else 0.05)
    skin = butter_bp(rng.standard_normal(n), 1100, 4200) * exp_env(n, 0.03)
    return (body * 0.95 + skin * (0.42 if tone != "dum" else 0.16)) * vel

def deg2freq(deg, oct_shift):
    return f(deg if deg >= 0 else 0, oct_shift)

music = {
    0: np.zeros(int((LOOP + 4) * SR)),
    1: np.zeros(int((LOOP + 4) * SR)),
}

# ─────────────────────────── composition ─────────────────────────────
# Phrase A — the joyful theme (4 bars). degrees: 0..7, -1 = rest
A = [
    (0, .5), (2, .5), (4, 1), (5, 1), (4, 1), (3, 1), (2, 1),   # bar 1 rise
    (3, .5), (2, .5), (1, 1), (2, 1), (1, 1), (0, 1), (1, 1),   # bar 2 settle
    (4, .5), (5, .5), (6, 1), (5, 1), (4, 1), (3, 1), (2, 1),   # bar 3 climb
    (3, .5), (2, .5), (3, 1), (2, 1), (1, 1), (0, 2),           # bar 4 cadence
]
# Phrase B — the ney answers, lower & softer (4 bars)
B = [
    (3, 1), (2, 1), (1, 1), (2, 1), (1, .5), (0, .5), (1, 1),
    (2, 1), (1, 1), (0, 1), (1, 1), (0, 1), (4, 1),
    (5, .5), (4, .5), (3, 1), (4, 1), (3, 1), (2, 1), (1, 1),
    (2, 1), (1, 1), (0, 2), (-1, 2),
]
# santur arpeggio comp (broken fifth pedal, per bar)
COMP = [(0, 1), (4, 1), (0, 1), (5, 1), (0, 1), (4, 1)]

# 4-bar harmonic cycle: D  D  B♭  A (happy Shur cadence)
BASS_ROOTS = [f(0, -2), f(0, -2), f(0, -2) * 2 ** (-400 / 1200), f(0, -2) * 2 ** (-300 / 1200)]

def phrase_notes(notes):
    out, pos = [], 0
    for deg, dur in notes:
        if deg >= 0:
            out.append((pos, deg, dur))
        pos += dur
    return out

def render_phrase(notes, start_bar, octv, voice, vel):
    for pos, deg, dur in notes:
        t = (start_bar * BAR) * E8 + pos * E8
        fr = deg2freq(deg, octv)
        if voice == "santur":
            sig = santur(fr, dur * E8, vel, t60=2.1)
            p = 0.25 if pos % 2 else -0.2
        else:
            sig = ney(fr, dur * E8, vel)
            p = 0.0
        sig = pan(sig, p)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t, sig[:, chn])

A_notes, B_notes = phrase_notes(A), phrase_notes(B)

# ── groove: 6/8 «dum . tak tak tak» — driving, with breathing bars
def groove(t0, dens, extra=False):
    hits = [("dum", 0, 0.66), ("tak", 2, 0.38), ("tek", 3, 0.22),
            ("tak", 4, 0.44), ("tek", 5, 0.18)]
    if extra:
        hits += [("tak", 1, 0.26), ("tek", 2.5, 0.16)]
    for tone, pos, vel in hits:
        sig = pan(tom(tone, vel * dens), 0.12 if pos % 2 else -0.12)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + pos * E8, sig[:, chn])

# ── bass: root on the dum + bouncy octave/fifth pickups («بیس دار»)
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    dens = 1.0 if bar % 8 != 7 else 0.6          # every 8th bar breathes
    groove(t0, dens, extra=(bar % 4 == 3))
    root = BASS_ROOTS[(bar // 4) % 4]
    # main deep hit on the dum
    sig = pan(bass(root, 0.52, 0.5), 0.0)
    for chn in (0, 1):
        music[chn] = mix(music[chn], t0, sig[:, chn])
    # pickup on 3.5 — root*2 (bounce)
    if bar % 2 == 0:
        sig = pan(bass(root * 2, 0.22, 0.30), 0.08)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + 3.5 * E8, sig[:, chn])
    # pickup on 4 — fifth below for motion
    else:
        sig = pan(bass(root * 1.5 / 2, 0.24, 0.26), -0.08)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + 4 * E8, sig[:, chn])
    # turnaround fill (last 2 bars): tombak roll into the loop point
    if bar >= LOOP_BARS - 2:
        for k, pos in enumerate([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]):
            tone = "tek" if k % 2 else "tak"
            sig = pan(tom(tone, 0.2 + 0.02 * k), 0.2 if k % 2 else -0.2)
            for chn in (0, 1):
                music[chn] = mix(music[chn], t0 + pos * E8, sig[:, chn])

# ── santur arpeggio comp: soft, panned, every bar
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    for pos, (deg, dur) in enumerate(COMP):
        sig = pan(santur(deg2freq(deg, -1), dur * E8, 0.15), -0.35 if pos % 2 else 0.35)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + pos * E8, sig[:, chn])

# ── pad: one long swell every 8 bars on the cycle root
for b in range(0, LOOP_BARS, 8):
    seg = pad(BASS_ROOTS[(b // 4) % 4] * 2, 8 * BAR * E8 + 0.6)
    seg2 = np.stack([seg, seg], axis=1) if seg.ndim == 1 else seg
    for chn in (0, 1):
        music[chn] = mix(music[chn], b * BAR * E8, seg2[:, chn])

# ── melody: 4 escalating cycles
render_phrase(A_notes, 2, 1, "santur", 0.40)          # theme statement
render_phrase(B_notes, 6, 0, "ney", 0.34)             # ney answer
render_phrase(A_notes, 10, 1, "santur", 0.46)         # theme, fuller
render_phrase(B_notes, 14, 0, "ney", 0.30)            # reply, softer
render_phrase(A_notes, 18, 1, "santur", 0.52)         # final, brightest
# octave sparkle ACCENT (soft santur, NOT a sharp chime) on the peaks
for bar, pos in [(12, 2), (20, 2)]:
    sig = pan(santur(f(0, 2), 0.8, 0.14, t60=1.2), 0.3)
    for chn in (0, 1):
        music[chn] = mix(music[chn], bar * BAR * E8 + pos * E8, sig[:, chn])
render_phrase(B_notes, 22, 0, "ney", 0.32)            # last answer
# bars 26-27 = the bass/tombak turnaround (no melody → loop breathes)

# ────────────────────── reverb + mastering + loop ──────────────────────
L = int(LOOP * SR)
stereo = np.stack([music[0][:L], music[1][:L]], axis=1)

ir_len = int(1.4 * SR)
ir = rng.standard_normal((ir_len, 2)) * np.exp(-np.arange(ir_len) / (SR * 0.26))[:, None]
ir[:40] *= np.linspace(0, 1, 40)[:, None]
wet = fftconvolve(stereo, ir / max(np.abs(ir).sum(axis=0).max(), 1e-9), mode="same")[:L]
mixdown = 0.84 * stereo + 0.16 * wet

# seamless loop: crossfade the tail into the head
xf = int(0.28 * SR)
ramp = np.linspace(0, 1, xf)[:, None]
tail = mixdown[-xf:] * ramp
head = mixdown[:xf] * (1 - ramp)
mixdown = mixdown[:-xf]
mixdown[:xf] += tail

# warm mastering (user: «بدون صدای تیز»): 7.2k LP + gentle saturation
mixdown = butter_lp(mixdown, 7200, order=2)
mixdown = np.tanh(mixdown * 1.25) * 0.85
mixdown /= max(np.abs(mixdown).max(), 1e-9) * 1.02

# encode at the game's native 48 kHz — no resample on decode
raw = "/tmp/menu3_f32.raw"
mixdown.astype(np.float32).tofile(raw)
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
    "-c:a", "libvorbis", "-q:a", "5", OUT,
], check=True)
print(f"OK menu3.ogg  loop={LOOP:.1f}s  size={os.path.getsize(OUT)//1024}KB")
