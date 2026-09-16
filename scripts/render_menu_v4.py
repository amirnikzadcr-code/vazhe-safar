#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — main-menu theme v4 (session Z, user:
«موسیقی صفحه اصلی خیلی سنتی و بی کیفیته — یک موسیقی ایرانی ولی
غیر سنتی بساز با کیفیت بالا»)

A brand-new MODERN IRANIAN-POP menu theme — 100% original, no samples:
  • غیر سنتی: pop production — soft four-on-the-floor kick, warm
    sidechained synth pads, saturated octave-pop bass, claps + hats,
    a bright PLUCK hook with a dotted echo, and a modern strings-lead
    answer. The Persian soul stays in the NOTES (D-minor with the Shur
    «کرون» wink + a quiet santur arpeggio), not in a dastgāh groove.
  • با کیفیت: 48 kHz stereo, constant-power pans, per-stem ducking
    (sidechain feel), tanh saturation + 7.6 kHz warm lowpass master,
    peak-normalized, SEAMLESS loop (all tails fold back into the head).
  • شاد و هیجانی: 16-bar build — groove → pluck hook → strings answer
    → full drop with the santur counter-line.
Output: public/assets/music/menu4.ogg  (~37 s seamless loop)
"""
import math
import os
import subprocess

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
OUT = "/home/z/my-project/public/assets/music/menu4.ogg"
rng = np.random.default_rng(20260916)

BPM = 104.0
E8 = 60.0 / BPM / 2.0          # eighth note (s)
BAR = 8                        # eighths per bar (4/4)
LOOP_BARS = 16
LOOP = LOOP_BARS * BAR * E8    # ≈ 36.9 s

D4 = 293.66


def hz(semi):                   # semitones from D4
    return D4 * 2 ** (semi / 12.0)


# ───────────────────────────── helpers ───────────────────────────────
def exp_env(n, t60):
    k = math.log(1000) / max(t60, 1e-3)
    return np.exp(-k * np.arange(n) / SR)


def soft_attack(sig, atk):
    n = min(int(atk * SR), len(sig))
    sig[:n] *= np.linspace(0, 1, n) ** 2
    return sig


def pan(sig, p):
    l = math.sqrt((1 - p) / 2)
    r = math.sqrt((1 + p) / 2)
    return np.stack([sig * l, sig * r], axis=1)


def butter_lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x)


def butter_hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x)


def butter_bp(x, lo, hi):
    sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)


STEMS = ("main", "duck")     # duck = bass+pads (sidechained)
music = {s: [np.zeros(int((LOOP + 4) * SR)), np.zeros(int((LOOP + 4) * SR))] for s in STEMS}


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


# ─────────────────────────── instruments ─────────────────────────────
def kick(vel=1.0):
    """soft round pop kick — felt thump, never boomy."""
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    fr = 118 * np.exp(-t * 26) + 44
    ph = 2 * np.pi * np.cumsum(fr) / SR
    sig = np.sin(ph) * exp_env(n, 0.075)
    click = butter_bp(rng.standard_normal(int(0.006 * SR)), 700, 1500) * np.linspace(1, 0, int(0.006 * SR)) * 0.3
    sig[: len(click)] += click
    return butter_lp(sig * vel * 0.5, 2600)


def clap(vel=1.0):
    """layered pop clap — 3 micro-bursts + body, warm band."""
    n = int(0.22 * SR)
    sig = np.zeros(n)
    for d, v in [(0.0, 0.8), (0.011, 1.0), (0.023, 0.7)]:
        m = rng.standard_normal(int(0.05 * SR))
        m = butter_bp(m, 1100, 3600) * exp_env(len(m), 0.022) * v
        i = int(d * SR)
        sig[i:i + len(m)] += m[: len(sig) - i]
    body = butter_bp(rng.standard_normal(n), 500, 1400) * exp_env(n, 0.05)
    return (sig * 0.8 + body * 0.5) * vel * 0.34


def hat(open_it=False, vel=1.0):
    n = int((0.09 if open_it else 0.035) * SR)
    m = rng.standard_normal(n)
    m = butter_hp(butter_bp(m, 6000, 9800), 5200)
    return m * exp_env(n, 0.03 if open_it else 0.014) * vel * 0.11


def bassnote(freq, dur, vel):
    """saturated octave-pop bass: saw body + deep sub, tight release."""
    n = int((dur + 0.12) * SR)
    t = np.arange(n) / SR
    saw = 2 * ((freq * t) % 1.0) - 1.0
    sig = 0.5 * np.sin(2 * math.pi * freq * 0.5 * t)      # sub an octave below
    sig += 0.42 * np.sin(2 * math.pi * freq * t)
    sig += 0.24 * saw
    sig = butter_lp(sig, 900)
    sig = np.tanh(sig * 1.9) * 0.62
    env = np.ones(n)
    rel = int(0.09 * SR)
    env[-rel:] *= np.linspace(1, 0, rel)
    return soft_attack(sig * env * vel, 0.006)


def padchord(semis, dur, vel=1.0):
    """warm detuned-saw pad, heavily lowpassed (the pop glue)."""
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for s in semis:
        for det in (-6.5, 5.2):
            fr = hz(s - 12) * 2 ** (det / 1200)
            saw = 2 * ((fr * t + rng.uniform(0, 1)) % 1.0) - 1.0
            sig += 0.16 * saw
    sig = butter_lp(sig, 1500)
    a = int(0.5 * SR)
    sig[:a] *= np.linspace(0, 1, a) ** 1.5
    rel = int(0.35 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel * 0.5


def pluck(semi, dur, vel):
    """bright pop pluck — filtered square+saw, fast decay, echo added
    by the caller (dotted-eighth feedback feel)."""
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    fr = hz(semi)
    sq = np.sign(np.sin(2 * math.pi * fr * t)) * 0.30
    saw = (2 * ((fr * t) % 1.0) - 1.0) * 0.34
    sig = sq + saw + 0.16 * np.sin(2 * math.pi * fr * 2 * t)
    sig = butter_lp(sig, 3400) * exp_env(n, 0.16)
    return soft_attack(sig * vel * 0.5, 0.003)


def strings(semi, dur, vel):
    """modern strings-lead: detuned saws + slow vibrato, singing."""
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    fr = hz(semi)
    vib = 5.2 * 2 * math.pi * t
    vib_amp = fr * 0.008 * np.clip((t - 0.22) / 0.4, 0, 1)
    sig = np.zeros(n)
    for det in (-7.0, 6.0, 0.0):
        f2 = (fr + vib_amp * np.sin(vib)) * 2 ** (det / 1200)
        saw = 2 * ((f2 * t + rng.uniform(0, 1)) % 1.0) - 1.0
        sig += 0.3 * saw
    sig = butter_lp(sig, 2700)
    a = int(0.07 * SR)
    sig[:a] *= np.linspace(0, 1, a) ** 1.4
    rel = int(0.28 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel * 0.42


def santur(freq, dur, vel, t60=1.7):
    """the Persian identity layer — same warm santur as the chapters."""
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det, amp in [(-3.6, 0.34), (0.0, 0.44), (3.4, 0.30)]:
        frq = freq * 2 ** (det / 1200)
        ph = rng.uniform(0, 2 * math.pi)
        sig += amp * np.sin(2 * math.pi * frq * t + ph)
        sig += amp * 0.28 * np.sin(2 * math.pi * frq * 2.003 * t + ph)
    sig = butter_lp(sig, 5200) * exp_env(n, t60) * vel
    m = rng.standard_normal(int(0.02 * SR))
    m = butter_bp(m, 1500, 3400) * np.linspace(1, 0, len(m)) * vel * 0.1
    sig[: len(m)] += m
    return soft_attack(sig, 0.004)


def place(stem, t0, mono_sig, p=0.0):
    for chn in (0, 1):
        pass
    sig = pan(mono_sig, p)
    mix(stem, t0, sig)


# ─────────────────────────── composition ─────────────────────────────
# 4-bar pop cycle in D minor: Dm | B♭ | F | C  (i VI III VII)
CHORDS = [
    dict(root=hz(-24), pad=[-12, -9, -5]),     # Dm: D3 F3 A3
    dict(root=hz(-28), pad=[-16, -12, -9]),    # B♭: Bb2 D3 F3
    dict(root=hz(-19), pad=[-9, -5, -1]),      # F:  F3 A3 C4
    dict(root=hz(-22), pad=[-14, -10, -3]),    # C:  C3 E3 G3 (E natural)
]

# Hook A — pluck theme (D minor pop, Shur «کرون» wink on the Eb)
A = [
    (0, .5), (3, .5), (5, 1), (7, 1), (5, 1), (3, 1), (2, 1),
    (3, .5), (2, .5), (1, 1), (2, 1), (0, 1), (1, 1), (3, 1),
    (5, .5), (7, .5), (10, 1), (8, 1), (7, 1), (5, 1), (3, 1),
    (5, 1), (3, 1), (2, 1), (0, 2), (-1, 1),
]
# Hook B — the strings answer, an octave up, softer & soaring
B = [
    (12, 1), (10, 1), (8, 1), (10, 1), (7, 1), (5, 1), (3, 1),
    (7, .5), (8, .5), (7, 1), (5, 1), (3, 1), (2, 1), (0, 1),
    (3, 1), (5, 1), (7, 1), (10, 1), (8, 1), (7, 1), (5, 1),
    (7, 1), (5, 1), (3, 1), (2, 1), (0, 2), (-1, 2),
]


def phrase_notes(notes):
    out, pos = [], 0
    for deg, dur in notes:
        if deg >= 0:
            out.append((pos, deg, dur))
        pos += dur
    return out


A_notes, B_notes = phrase_notes(A), phrase_notes(B)

# ── drums: soft four-on-the-floor + claps + offbeat hats ──
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    section = bar // 4                    # 0 groove, 1 hookA, 2 hookB, 3 drop
    for beat in range(4):
        place("main", t0 + beat * 2 * E8, kick(1.0 if beat == 0 else 0.9))
    if section >= 1:
        for cl in (2, 6):
            place("main", t0 + cl * E8, clap(0.9 if bar % 4 != 3 else 1.0))
        for off in (1, 3, 5, 7):
            place("main", t0 + off * E8, hat(open_it=(off == 7 and bar % 2 == 1), vel=0.9))
        for tick in range(8):             # 16th ghost ticks
            place("main", t0 + tick * E8 + E8 / 2, hat(vel=0.4))
    if bar == LOOP_BARS - 1:              # turnaround fill
        for i, v in enumerate([0.5, 0.7, 0.9, 1.0]):
            place("main", t0 + (4 + i) * E8, clap(v))

# ── bass + pads (sidechained stem) ──
for bar in range(LOOP_BARS):
    t0 = bar * BAR * E8
    ch = CHORDS[(bar // 4) % 4]
    # octave-pop bass pattern (eighth positions)
    for pos, mul, dur, v in [(0, 1, 0.5, 0.5), (2, 2, 0.22, 0.34), (3.5, 1.5, 0.2, 0.3),
                             (4, 1, 0.45, 0.46), (6, 2, 0.24, 0.32), (7, 1.5, 0.2, 0.28)]:
        place("duck", t0 + pos * E8, bassnote(ch["root"] * mul, dur, v))
    seg = padchord(ch["pad"], 4 * 2 * E8)
    place("duck", t0, seg, p=0.0)

# ── sidechain duck envelope (kick pumps the duck stem) ──
total_n = int(LOOP * SR)
duck_env = np.ones(total_n)
for bar in range(LOOP_BARS):
    for beat in range(4):
        t0 = int((bar * BAR + beat * 2) * E8 * SR)
        dip = int(0.05 * SR)
        rec = int(0.24 * SR)
        duck_env[t0:t0 + dip] *= np.linspace(1, 0.5, dip)
        duck_env[t0 + dip:t0 + dip + rec] *= np.linspace(0.5, 1, rec) ** 0.7
for chn in (0, 1):
    music["duck"][chn][:total_n] *= duck_env

# ── hooks ──
def render_hook(notes, start_bar, voice, vel, echo=None):
    for pos, deg, dur in notes:
        t = start_bar * BAR * E8 + pos * E8
        d = dur * E8
        if voice == "pluck":
            sig = pan(pluck(deg, d, vel), 0.0)
            mix("main", t, sig)
            if echo:                            # dotted-eighth echo
                sig2 = pan(pluck(deg, d, vel * echo[1]), 0.25)
                mix("main", t + echo[0] * E8, sig2)
        else:
            sig = pan(strings(deg, d, vel), -0.12)
            mix("main", t, sig)


render_hook(A_notes, 4, "pluck", 0.42, echo=(3, 0.30))       # hook A + echo
render_hook(B_notes, 8, "strings", 0.40)                     # strings answer
render_hook(A_notes, 12, "pluck", 0.5, echo=(3, 0.34))       # full drop
render_hook(B_notes, 12, "strings", 0.3)                     # + high strings

# ── santur counter-line (bars 8-15, 16th broken chords, quiet) ──
for bar in range(8, LOOP_BARS):
    t0 = bar * BAR * E8
    ch = CHORDS[(bar // 4) % 4] if bar < 12 else CHORDS[0]
    tones = ch["pad"] + [ch["pad"][0] + 12]
    for i in range(8):
        semi = tones[i % len(tones)] + 12
        sig = pan(santur(hz(semi), 0.16, 0.10), -0.4 if i % 2 else 0.4)
        mix("main", t0 + i * E8, sig)

# ────────────────────── loop fold + mastering ──────────────────────
L = int(LOOP * SR)
mixdown = np.zeros((L, 2))
for stem in STEMS:
    for chn in (0, 1):
        head = music[stem][chn][:L].copy()
        tail = music[stem][chn][L:L + int(3.5 * SR)]      # ring-out wraps
        head[: len(tail)] += tail[:L]
        mixdown[:, chn] += head

mixdown = butter_hp(mixdown, 26, order=2)
mixdown = butter_lp(mixdown, 7600, order=2)
mixdown = np.tanh(mixdown * 1.28) * 0.86
mixdown /= max(np.abs(mixdown).max(), 1e-9) * 1.02

raw = "/tmp/menu4_f32.raw"
mixdown.astype(np.float32).tofile(raw)
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
    "-c:a", "libvorbis", "-q:a", "5", OUT,
], check=True)
os.remove(raw)
print(f"OK menu4.ogg  loop={LOOP:.1f}s  size={os.path.getsize(OUT)//1024}KB")
