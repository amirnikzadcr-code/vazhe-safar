#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — menu theme v2 (user: «موزیک صفحه اصلی ب شدت رو مخه… یچی دلنواز
و خوشگل بساز بزار با ریتم»).

A brand-new, hand-composed MAIN MENU theme:
  • دلنواز: warm santur melody over a soft pad in D-Shur (the mother
    dastgāh — nostalgic, homely, instantly Persian)
  • با ریتم: a gentle 6/8 «ruhābi» groove — tombak/daf pattern that
    breathes (dum . tak . tak), a light bass heartbeat on the dum
  • ney answers the santur — call & response, long resolving cadence
  • seamless ~26 s loop, studio-style: FFT reverb, warm mastering
100% original composition. Output: public/assets/music/menu2.ogg
"""
import math
import subprocess
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
OUT = "/home/z/my-project/public/assets/music/menu2.ogg"
rng = np.random.default_rng(20260914)

# ─────────────────────────────── tuning ────────────────────────────────
# D shur-ish (koron ≈ -50c neutral 2nd, gentle), cents from D4
CENTS = [0, 150, 294, 498, 702, 792, 996, 1200]      # 0..7 (8 = octave)
R4 = 293.66                                           # D4
def f(deg, oct_shift=0):
    return R4 * 2 ** (oct_shift + CENTS[deg] / 1200.0)

# 6/8 groove, eighth = 0.20 s → dotted-quarter ≈ 100 bpm, lilting
E8 = 0.20
BAR = 6                                               # eighths per bar
LOOP_BARS = 22                                        # ≈ 26.4 s
LOOP = LOOP_BARS * BAR * E8                           # loop length (s)

# ───────────────────────────── helpers ─────────────────────────────────
def mix(buf, start, sig, gain=1.0):
    i = int(start * SR)
    n = len(sig)
    if i < 0:
        sig = sig[-i:]; n = len(sig); i = 0
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
    l = math.sqrt((1 - p) / 2); r = math.sqrt((1 + p) / 2)
    return np.stack([sig * l, sig * r], axis=1)

# ─────────────────────────── instruments ───────────────────────────────
def santur(freq, dur, vel, t60=2.6):
    """hammered dulcimer: 3 detuned strings, inharmonic shimmer, mallet."""
    n = int((dur + 2.0) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det, amp in [(-3.6, 0.34), (0.0, 0.44), (3.4, 0.30)]:
        fr = freq * 2 ** (det / 1200)
        ph = rng.uniform(0, 2 * math.pi)
        sig += amp * np.sin(2 * math.pi * fr * t + ph)
        sig += amp * 0.30 * np.sin(2 * math.pi * fr * 2.003 * t + ph)   # string 2nd mode
        sig += amp * 0.12 * np.sin(2 * math.pi * fr * 3.01 * t + ph)
    sig *= exp_env(n, t60) * vel
    # mallet transient
    m = rng.standard_normal(int(0.03 * SR))
    m = butter_bp(m, 2200, 4200) * np.linspace(1, 0, len(m)) * vel * 0.16
    sig[:len(m)] += m
    return soft_attack(sig, 0.004)

def ney(freq, dur, vel, vib_depth=0.008):
    """breathy end-blown flute: warm sine + 2nd harmonic, delayed vibrato,
    soft breath noise, rounded entrances."""
    n = int((dur + 0.35) * SR)
    t = np.arange(n) / SR
    vib = 5.1 * 2 * math.pi * t
    vib_amp = vib_depth * freq * np.clip((t - 0.28) / 0.5, 0, 1)
    fr = freq + vib_amp * np.sin(vib)
    phase = 2 * math.pi * np.cumsum(fr) / SR
    sig = np.sin(phase) + 0.20 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    breath = butter_bp(rng.standard_normal(n), 900, 3000) * 0.035
    sig = (sig + breath) * vel
    a = min(int(0.09 * SR), n // 3)
    sig[:a] *= np.linspace(0, 1, a) ** 1.5                     # soft attack
    rel = int(0.30 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)                       # gentle release
    return sig * 0.9

def pad(root, dur, vel=1.0):
    """warm pad: root + fifth + octave, slow swell."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for fr, a in [(root, 0.5), (root * 1.5, 0.28), (root * 2, 0.30),
                  (root * 2 ** (150 / 1200), 0.10)]:
        sig += a * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6))
        sig += a * 0.4 * np.sin(2 * math.pi * fr * 1.003 * t)  # chorus
    env = np.concatenate([np.linspace(0, 1, int(1.4 * SR)),
                          np.ones(n - int(1.4 * SR) - int(1.4 * SR)),
                          np.linspace(1, 0, int(1.4 * SR))])
    return sig[:n] * env[:n] * vel * 0.14

def bass(freq, dur, vel):
    """soft round bass heartbeat."""
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * math.pi * freq * t) + 0.25 * np.sin(2 * math.pi * freq * 2 * t)
    sig *= exp_env(n, 0.9) * vel
    return soft_attack(sig, 0.006)

def butter_bp(x, lo, hi):
    sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)

def tom(tone, vel, n=None):
    """tombak/daf hit: pitched thump + skin snap."""
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    base = {"dum": 92, "tak": 210, "tek": 300}[tone]
    body = np.sin(2 * math.pi * base * t * (1 - 0.35 * t / 0.22))
    body *= exp_env(n, 0.10 if tone == "dum" else 0.05)
    skin = butter_bp(rng.standard_normal(n), 1400, 6500) * exp_env(n, 0.03)
    return (body * 0.9 + skin * (0.5 if tone != "dum" else 0.2)) * vel

def chime(freq, vel):
    """tiny bell sparkle (rare accents)."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * math.pi * freq * t) + 0.4 * np.sin(2 * math.pi * freq * 2.76 * t)
    return soft_attack(sig * exp_env(n, 0.9) * vel, 0.002)

# ─────────────────────────── composition ───────────────────────────────
# degrees are 0..7 into CENTS (7 = upper tonic); -1 = rest
# Phrase A — the theme, singing and warm (2 bars + 2 bars)
A = [
    (0, 1), (1, 1), (2, 1), (3, 1), (2, 1), (1, 1),        # rise
    (2, 1.5), (1, 0.5), (0, 2), (-1, 2),                    # settle
    (4, 1), (3, 1), (2, 1), (3, 1), (2, 1), (1, 1),        # answer rise
    (2, 2), (-1, 1), (0, 3),                                # cadence home
]
# Phrase B — the ney replies, lower & softer
B = [
    (3, 1), (2, 1), (1, 1), (2, 1), (1, 1), (0, 1),
    (1, 1.5), (0, 0.5), (-1, 2),
    (2, 1), (1, 1), (0, 1), (1, 1), (0, 1), (-1, 1),
    (0, 3), (-1, 3),
]
# santur arpeggio comp (per bar, 6 eighths: broken fifth pedal)
COMP = [(0, 1), (4, 1), (0, 1), (5, 1), (0, 1), (4, 1)]

def deg2freq(deg, oct_shift):
    return f(deg if deg >= 0 else 0, oct_shift)

music = {0: np.zeros(int((LOOP + 4) * SR)), 1: np.zeros(int((LOOP + 4) * SR))}

# ── pad: one long swell every 6 bars (roots D, then B♭-ish colour, G, A)
pad_roots = [f(0, -1), f(0, -1), f(5, -2), f(4, -1)]
for b in range(0, LOOP_BARS, 6):
    seg = pad(pad_roots[(b // 6) % len(pad_roots)], 6 * BAR * E8 + 0.6)
    seg2 = np.stack([seg, seg], axis=1) if seg.ndim == 1 else seg
    for chn in (0, 1):
        music[chn] = mix(music[chn], b * BAR * E8, seg2[:, chn])

def mix_groove(music, t0, dens):
    hits = [("dum", 0, 0.62), ("tak", 2, 0.34), ("tek", 3, 0.20),
            ("tak", 4, 0.40), ("tek", 5, 0.16)]
    for tone, pos, vel in hits:
        sig = pan(tom(tone, vel * dens), 0.12 if pos % 2 else -0.12)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + pos * E8, sig[:, chn])
    return music

# ── groove: 6/8 "dum . tak . tak" + bass heartbeat on the dum
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    dens = 1.0 if bar % 4 != 3 else 0.55          # every 4th bar breathes
    music = mix_groove(music, t0, dens)
    # bass on dum of odd bars (heartbeat)
    if bar % 2 == 0:
        bfr = f(0, -2) if bar % 8 < 6 else f(4, -2)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0, pan(bass(bfr, 0.5, 0.30), 0.0)[:, chn])

# ── santur arpeggio comp: soft, panned, every bar
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    for pos, (deg, dur) in enumerate(COMP):
        octv = 0 if bar % 2 == 0 else 0
        sig = pan(santur(deg2freq(deg, octv - 1), dur * E8, 0.16), -0.35 if pos % 2 else 0.35)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t0 + pos * E8, sig[:, chn])

# ── melody: A (santur, octave +1) bars 2..5 & 10..13, B (ney, octave 0) 6..9 & 14..17
def phrase_notes(notes, octv):
    out, pos = [], 0
    for deg, dur in notes:
        if deg >= 0:
            out.append((pos, deg, dur))
        pos += dur
    return out

def render_phrase(notes, start_bar, octv, voice, vel, swing=0.0):
    for pos, deg, dur in notes:
        t = (start_bar * BAR) * E8 + pos * E8
        fr = deg2freq(deg, octv)
        if voice == "santur":
            sig = santur(fr, dur * E8, vel, t60=2.4)
            p = 0.25 if pos % 2 else -0.2
        else:
            sig = ney(fr, dur * E8, vel)
            p = 0.0
        sig = pan(sig, p)
        for chn in (0, 1):
            music[chn] = mix(music[chn], t, sig[:, chn])

A_notes, B_notes = phrase_notes(A, 0), phrase_notes(B, 0)
render_phrase(A_notes, 2, 1, "santur", 0.42)          # theme statement
render_phrase(B_notes, 6, 0, "ney", 0.34)             # ney answer
render_phrase(A_notes, 10, 1, "santur", 0.46)         # theme, fuller
render_phrase(B_notes, 14, 0, "ney", 0.30)            # reply, softer
# cadence sparkle: tiny chime on the final home note
sig = pan(chime(f(0, 2), 0.10), 0.3)
for chn in (0, 1):
    music[chn] = mix(music[chn], 18 * BAR * E8 + 4 * E8, sig[:, chn])
sig = pan(chime(f(4, 1), 0.08), -0.3)
for chn in (0, 1):
    music[chn] = mix(music[chn], 20 * BAR * E8 + 1 * E8, sig[:, chn])

# ────────────────────── reverb + mastering + loop ──────────────────────
L = int(LOOP * SR)
stereo = np.stack([music[0][:L], music[1][:L]], axis=1)

ir_len = int(1.9 * SR)
ir = rng.standard_normal((ir_len, 2)) * np.exp(-np.arange(ir_len) / (SR * 0.32))[:, None]
ir[:40] *= np.linspace(0, 1, 40)[:, None]
wet = fftconvolve(stereo, ir / max(np.abs(ir).sum(axis=0).max(), 1e-9), mode="same")[:L]
mixdown = 0.82 * stereo + 0.18 * wet

# seamless loop: crossfade the tail into the head
xf = int(0.25 * SR)
ramp = np.linspace(0, 1, xf)[:, None]
tail = mixdown[-xf:] * ramp
head = mixdown[:xf] * (1 - ramp)
mixdown = mixdown[:-xf]
mixdown[:xf] += tail
# (head+tail folded — the loop point is now invisible)

# warm mastering: gentle LP + soft saturation + normalize
sos = butter(2, 8200 / (SR / 2), btype="low", output="sos")
mixdown = sosfilt(sos, mixdown, axis=0)
mixdown = np.tanh(mixdown * 1.25) * 0.86
mixdown /= max(np.abs(mixdown).max(), 1e-9) * 1.02

# encode
raw = "/tmp/menu2_f32.raw"
mixdown.astype(np.float32).tofile(raw)
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
    "-c:a", "libvorbis", "-q:a", "4", OUT,
], check=True)
import os
print(f"OK menu2.ogg  loop={LOOP:.1f}s  size={os.path.getsize(OUT)//1024}KB")
