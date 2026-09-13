#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — offline music renderer v1.3
Renders the 10 chapter soundscapes + menu theme as studio-quality OGG files.

Pipeline: physical-model synthesis (numpy) -> convolution reverb (FFT)
          -> mastering (warm LP, soft saturation, normalize)
          -> seamless loop crossfade -> ffmpeg (libvorbis q5)

Musical identity = the SAME hand-composed motifs & dastgāh scales from
src/game/data/chapters.ts (dumped to music_configs.json), arranged in
3 evolving cycles: A / breath / B  ×3 with layered build-up.
100% original composition — no samples, no copyrighted melodies.
"""
import json, math, os, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve

SR = 44100
OUT_DIR = "/home/z/my-project/public/assets/music"
CFG = json.load(open("/home/z/my-project/scripts/music_configs.json"))
rng = np.random.default_rng(20260913)

# ---------------------------------------------------------------- helpers
def c2r(c):  # cents -> ratio
    return 2.0 ** (c / 1200.0)

def adsr(n, a, d, s, r, sr=SR):
    """attack/decay/sustain/release envelope over n samples (levels 0..1)."""
    a, d, r = int(a*sr), int(d*sr), int(r*sr)
    sc = max(0, n - a - d - r)
    env = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.linspace(1, s, max(d, 1), endpoint=False),
        np.full(sc, s),
        np.linspace(s, 0, max(r, 1), endpoint=False),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))

def bandnoise(n, lo, hi, sr=SR):
    """white noise bandlimited to [lo,hi] Hz via FFT."""
    x = rng.standard_normal(n + 2048)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1/sr)
    m = ((f >= lo) & (f <= hi)).astype(float)
    m = np.convolve(m, np.hanning(129) / np.hanning(129).sum(), "same")  # soft skirt
    y = np.fft.irfft(X * m, n=len(x))
    return y[2048:n+2048] / (np.abs(y).max() + 1e-9)

def one_pole_lp(x, fc, sr=SR):
    a = math.exp(-2*math.pi*fc/sr)
    y = np.empty_like(x); acc = 0.0
    b = 1 - a
    for i in range(len(x)):
        acc = b*x[i] + a*acc; y[i] = acc
    return y

def butter_lp(x, fc, order=2, sr=SR, axis=-1):
    from scipy.signal import butter, sosfilt
    sos = butter(order, fc/(sr/2), btype="low", output="sos")
    return sosfilt(sos, x, axis=axis)

def env_exp(n, t60, sr=SR):
    """exponential decay reaching 1e-3 at t60 seconds."""
    k = math.log(1000) / max(t60, 1e-3)
    t = np.arange(n)/sr
    return np.exp(-k*t)

# ---------------------------------------------------------------- instruments
def santur(freq, dur, vel, pan=0.0):
    """hammered dulcimer: 3 slightly-detuned strings/course, inharmonic
    partials, mallet transient, long metallic decay. Warm & shimmering."""
    n = int((dur + 2.2) * SR)
    t = np.arange(n)/SR
    B = 3.2e-4                       # inharmonicity
    det = [-3.4, 0.0, 3.6]           # cents detune across the course
    course = np.zeros(n)
    t60 = (2.9 if freq < 500 else 2.9*(500/freq)**0.5)
    for dt in det:
        f0 = freq * c2r(dt)
        for k in range(1, 11):
            fk = k*f0*math.sqrt(1 + B*k*k)
            if fk > 10500: break
            amp = (1.0/k**1.32) * (0.92 if k in (1,2) else 1.0)
            # higher partials decay faster
            tk = t60 / (1 + 0.55*(k-1))
            course += amp * env_exp(n, tk) * np.sin(2*np.pi*fk*t + rng.uniform(0, 6.28))
    course /= (len(det) * 2.6)
    # mallet strike: short bandpassed thock
    ml = bandnoise(n, 900, 5200) * env_exp(n, 0.018)
    sig = course * adsr(n, 0.003, 0.05, 1.0, min(0.35, dur*0.3))
    sig += 0.35 * ml
    # subtle second mallet bounce on longer notes (tremolo feel)
    if dur > 0.42:
        d2 = int(0.045*SR)
        bounce = np.zeros(n); bounce[d2:] = course[:n-d2] * 0.34 * adsr(n-d2, 0.003, 0.04, 1.0, 0.3)
        sig += bounce
    sig *= vel
    return panned(sig, pan)

def ney(freq, dur, vel, pan=-0.15):
    """end-blown reed flute: airy fundamental w/ delayed vibrato, pitch
    scoop onset, breath noise — soft, breathy, emotional."""
    n = int((dur + 0.35) * SR)
    t = np.arange(n)/SR
    # pitch: scoop +25c -> target in 90ms; delayed vibrato after 0.4s
    scoop = 25 * np.exp(-t/0.045)
    vib_on = np.clip((t-0.4)/0.5, 0, 1)
    vib = 11 * vib_on * np.sin(2*np.pi*5.3*t + rng.uniform(0, 6.28))
    phase = 2*np.pi*np.cumsum(freq*c2r(scoop+vib)/SR)
    fund = np.sin(phase)
    h2 = 0.24*np.sin(2*phase + 0.4)
    h3 = 0.09*np.sin(3*phase + 1.1)
    tone = fund + h2 + h3
    # breath: bandpass noise hugging 2*f0 + gentle wide hiss
    br = bandnoise(n, freq*1.4, freq*2.6) * (0.055 + 0.05*vib_on)
    hiss = bandnoise(n, 2000, 6000) * 0.016
    a = min(0.075, dur*0.25)
    env = adsr(n, a, 0.12, 0.92, min(0.16, (dur)*0.35))
    sig = (tone + br + hiss) * env * vel
    return panned(sig, pan)

def kamancheh(freq, dur, vel, pan=0.16):
    """bowed spike fiddle: rich partials, two body formants, slow bow
    onset, expressive delayed vibrato, gentle swell."""
    n = int((dur + 0.4) * SR)
    t = np.arange(n)/SR
    vib_on = np.clip((t-0.42)/0.55, 0, 1)
    vib = 16 * vib_on * np.sin(2*np.pi*5.9*t + rng.uniform(0, 6.28))
    phase = 2*np.pi*np.cumsum(freq*c2r(vib)/SR)
    sig = np.zeros(n)
    for k in range(1, 13):
        if k*freq > 9000: break
        sig += (1.0/k**1.62) * np.sin(k*phase + 0.13*k)
    # body formants (peaks ~850Hz & 1750Hz) via time-domain 2nd-order resonators
    sig += 0.5 * resonator(sig, 850, 9) * 0.9
    sig += 0.35 * resonator(sig, 1750, 11) * 0.6
    sig /= 3.4
    bow = bandnoise(n, 1200, 4200) * 0.02
    env = adsr(n, min(0.09, dur*0.2), 0.15, 1.0, min(0.2, dur*0.4))
    swell = 1.0 + 0.10*np.clip((t-dur*0.4)/max(dur*0.6, 0.1), 0, 1)
    sig = (sig + bow) * env * swell * vel
    return panned(sig, pan)

def resonator(x, fc, q, sr=SR):
    """2-pole resonant bandpass — vectorized via scipy.lfilter (numerically
    stable & fast; the naive per-sample Python loop overflowed on some notes)."""
    from scipy.signal import lfilter
    w0 = 2*math.pi*fc/sr
    r = math.exp(-w0/(2*q))
    # poles at z = r·e^{±jw0}  →  denominator 1 − 2r·cos(w0)z⁻¹ + r²z⁻²
    A1, A2 = -2*r*math.cos(w0), r*r
    b0 = (1 - r*r)*0.5
    return lfilter([b0], [1.0, A1, A2], x)

def tombak(kind, vel, pan=0.0):
    """goblet drum via modal synthesis. DUM=bass, TEK=snap, BAK=mid-slap."""
    n = int(0.5*SR)
    t = np.arange(n)/SR
    if kind == "DUM":
        modes = [(92, 9, 0.30), (188, 11, 0.18), (310, 13, 0.07)]
        click = bandnoise(n, 300, 900) * env_exp(n, 0.006) * 0.5
    elif kind == "TEK":
        modes = [(470, 8, 0.11), (760, 7, 0.08), (1150, 6, 0.05)]
        click = bandnoise(n, 1500, 5200) * env_exp(n, 0.005) * 0.9
    else:  # BAK
        modes = [(240, 9, 0.14), (520, 8, 0.08), (900, 6, 0.04)]
        click = bandnoise(n, 800, 3000) * env_exp(n, 0.006) * 0.6
    sig = click.copy()
    for f, q, tk in modes:
        sig += q*0.05 * env_exp(n, tk) * np.sin(2*np.pi*f*t)
    sig *= vel * 0.9
    return panned(sig, pan)

def daf(kind, vel, pan=0.0):
    """frame drum: soft thud + membrane + pin-jingle ring."""
    n = int(0.55*SR)
    t = np.arange(n)/SR
    thud_f = 105 if kind == "DUM" else 190
    sig = env_exp(n, 0.22) * np.sin(2*np.pi*thud_f*t) * 0.75
    sig += 0.4 * env_exp(n, 0.09) * np.sin(2*np.pi*thud_f*2.3*t)
    swish = bandnoise(n, 350, 1500) * env_exp(n, 0.075) * 0.65
    jingle = bandnoise(n, 5500, 11000) * env_exp(n, 0.05) * 0.55
    ring = bandnoise(n, 7000, 12000) * env_exp(n, 0.12) * 0.22
    sig += swish + jingle + ring
    sig *= vel * 0.8
    return panned(sig, pan)

def panned(sig, pan):
    """equal-power pan; returns stereo [L, R] array."""
    th = (pan + 1) * math.pi/4
    return np.stack([sig*math.cos(th), sig*math.sin(th)])

def pad_chord(root, cents, dur, drone, pan=0.0):
    """warm slow pad: root + fifth + octave, detuned pair per voice."""
    n = int(dur*SR)
    sigL = np.zeros(n); sigR = np.zeros(n)
    for deg, g in [(0, 1.0), (4, 0.6), (min(7, len(cents)-1), 0.38)]:
        c = cents[deg % len(cents)] + 1200*(deg//len(cents))
        f = root * c2r(c)
        for det in (-4.2, 4.0):
            ff = f*c2r(det)
            ph = rng.uniform(0, 6.28)
            t = np.arange(n)/SR
            v = np.sin(2*np.pi*ff*t + ph) + 0.32*np.sin(2*np.pi*2*ff*t + ph*1.3)
            # slow chorus shimmer
            v *= (1 + 0.08*np.sin(2*np.pi*0.13*t + ph))
            p = panned(v, det/60 + pan)
            sigL += g*p[0]; sigR += g*p[1]
    sig = np.stack([sigL, sigR]) / 7.5
    from scipy.signal import butter, sosfilt
    sos = butter(2, 1300/(SR/2), btype="low", output="sos")
    sig = sosfilt(sos, sig, axis=1)
    env = adsr(n, min(2.2, dur*0.2), 0.5, 1.0, min(2.4, dur*0.25))
    return sig * (drone * 0.16 * env)

# ---------------------------------------------------------------- composition
def parse_motif(motif, win_eighths):
    """mirror audio.ts parseMotif: [degree|-1(rest), beats] -> eighth events."""
    out, pos = [], 0
    for deg, beats in motif:
        e = round(beats*2)
        if e <= 0: continue
        if deg >= 0 and pos+e <= win_eighths:
            out.append((deg, pos, e, pos % 4 == 0 or pos % 3 == 0))
        pos += e
        if pos >= win_eighths: break
    return out

def note_freq(cfg, degree, octave_shift=0):
    scale = cfg["cents"]
    return cfg["root"] * c2r(scale[degree % len(scale)] + 1200*(cfg["octave"]+octave_shift))

def render_track(cfg, cycles=None, seed=7):
    """render one seamless-loop track; returns stereo float array."""
    r = np.random.default_rng(seed)
    bpm, meter = cfg["bpm"], cfg["meter"]
    eighth = 60/bpm/2
    barLen = 6 if meter == 6 else 8
    breathStart = barLen*4
    breathEnd = breathStart + barLen
    cycle = barLen*8
    evA = parse_motif(cfg["motif"], breathStart)
    evB = parse_motif(cfg.get("motifB") or cfg["motif"], max(barLen, barLen*8 - breathEnd))
    cycSec = cycle*eighth
    if cycles is None:
        cycles = int(np.clip(round(52/cycSec), 2, 3))
    total = int((cycles*cycSec + 3.5)*SR)
    L = np.zeros(total); R = np.zeros(total)

    def put(sig, t0):
        if t0 < 0:  # tiny negative jitter — trim the head instead of underflow
            cut = int(-t0*SR)
            sig = sig[:, cut:] if sig.ndim == 2 else sig[cut:]
            t0 = 0.0
        i0 = int(t0*SR)
        if i0 >= total: return
        seg = sig[:, :total-i0] if sig.ndim == 2 else sig[:total-i0]
        if sig.ndim == 2:
            L[i0:i0+len(seg[0])] += seg[0]; R[i0:i0+len(seg[1])] += seg[1]
        else:
            L[i0:i0+len(seg)] += seg; R[i0:i0+len(seg)] += seg

    lead = cfg["lead"]; perc = cfg["perc"]
    for cyc in range(cycles):
        t_cyc = cyc*cycSec
        # ---- pad once per cycle
        if cfg["drone"] > 0:
            put(pad_chord(cfg["root"], cfg["cents"], cycSec+2.0, cfg["drone"]), t_cyc)
        # ---- melody
        for role, evs in (("A", evA), ("B", evB)):
            base = t_cyc + (0 if role == "A" else breathEnd*eighth)
            rel = -1 if role == "B" else 0
            fade = 0.75 + 0.25*min(1, cyc/1.5)          # settles in over cycles
            for deg, pos, e, strong in evs:
                vol = (0.17 if role == "B" else 0.24) * fade
                if strong: vol *= 1.15
                if e >= 4: vol *= 1.12
                jit = r.uniform(-0.014, 0.014)
                dur = e*eighth*r.uniform(0.92, 1.04) + 0.09
                t0 = base + pos*eighth + jit
                if t0 >= total/SR: continue
                f = note_freq(cfg, deg, rel)
                # appoggiatura ornament on longer notes
                if e >= 2 and r.random() < 0.18:
                    f_g = note_freq(cfg, min(len(cfg["cents"])-1, deg+1), rel)
                    if lead == "ney": put(ney(f_g, eighth*0.9, vol*0.4), t0+0.062)
                    elif lead == "kamancheh": put(kamancheh(f_g, eighth*0.9, vol*0.4), t0+0.062)
                    else: put(santur(f_g, eighth*0.9, vol*0.4), t0+0.062)
                if lead == "ney": put(ney(f, dur, vol), t0)
                elif lead == "kamancheh": put(kamancheh(f, dur, vol), t0)
                else: put(santur(f, dur, vol), t0)
                # cycle-2+ echo: shimmering santur an octave up, very soft
                if cyc >= 1 and role == "A" and e >= 2:
                    put(santur(f*2, dur*0.9, vol*0.28, pan=0.22), t0+0.02)
        # ---- santur shadow dyads on phrase downbeats (body & warmth)
        if cyc >= 0:
            for bar in range(8):
                if bar == 4: continue                    # breath stays open
                t0 = t_cyc + bar*barLen*eighth
                v = 0.10 if cyc == 0 else 0.13
                put(santur(cfg["root"], 1.6, v, pan=-0.2), t0+0.01)
                put(santur(cfg["root"]*c2r(cfg["cents"][4]), 1.5, v*0.8, pan=0.2), t0+0.03)
        # ---- percussion
        if perc != "none":
            for bar in range(8):
                if bar == 4: continue
                base = t_cyc + bar*barLen*eighth
                dens = 0.85 if cyc == 0 else 1.0
                if meter == 4:
                    pat = [("DUM", 0, 1.0), ("TEK", 2, 0.55), ("DUM", 4, 0.8),
                           ("TEK", 6, 0.6), ("BAK", 7, 0.4)]
                else:
                    pat = [("DUM", 0, 1.0), ("TEK", 2, 0.6), ("DUM", 3, 0.75),
                           ("TEK", 4, 0.55), ("BAK", 5, 0.35)]
                for kind, off, v in pat:
                    if r.random() > 0.9*dens: continue
                    vv = v*dens*r.uniform(0.85, 1.1)
                    if perc == "daf":
                        put(daf(kind, vv, pan=r.uniform(-0.08, 0.08)), base+off*eighth+r.uniform(-0.006, 0.006))
                    else:
                        put(tombak(kind, vv, pan=r.uniform(-0.1, 0.1)), base+off*eighth+r.uniform(-0.006, 0.006))
    return stereo(total, L, R, cycSec)

# ---------------------------------------------------------------- mastering
def stereo(total, L, R, loop_len):
    """assemble, reverb, master, seamless-loop crossfade."""
    # --- convolution reverb (spacious warm hall)
    ir_n = int(2.6*SR)
    t = np.arange(ir_n)/SR
    ir = rng.standard_normal((2, ir_n)) * (1 - t/2.6)**2.4
    ir = butter_lp(ir, 7000, axis=1)
    ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True)) * 1.6
    wet = np.stack([fftconvolve(L, ir[0])[:total], fftconvolve(R, ir[1])[:total]])
    dry = np.stack([L, R])
    mix = dry*(1-0.26) + wet*0.26
    # --- master: gentle lowpass (kill harshness), soft saturation, normalize
    mix = butter_lp(mix, 11000, order=2, axis=1)
    mix = np.tanh(mix*1.15)/1.15
    mix /= max(np.abs(mix).max(), 1e-9)
    # loudness consistency: pull every track to a common perceived level
    target_rms = 0.085
    rms = math.sqrt(float(np.mean(mix**2)))
    g = float(np.clip(target_rms/max(rms, 1e-6), 0.7, 3.6))
    mix *= g
    # soft-knee limiter (gentle squash only near the top — keeps RMS, no clicks)
    a = np.abs(mix)
    comp = np.where(a <= 0.55, a, 0.55 + 0.45*np.tanh((a - 0.55)/0.45))
    mix = np.sign(mix)*comp
    mix *= 0.92/max(np.abs(mix).max(), 1e-9)
    # --- seamless loop: crossfade the tail into the head
    xf = int(0.35*SR)
    loop_n = int(loop_len*SR)
    if loop_n + xf < total:
        tail = mix[:, loop_n:loop_n+xf]
        head = mix[:, :xf]
        ramp = np.linspace(0, 1, xf)[None, :]
        mix[:, :xf] = head*(1-ramp) + tail*ramp
        mix = mix[:, :loop_n]
        # hard fade micro-edges to be safe
        fe = 64
        mix[:, :fe] *= np.linspace(0, 1, fe)[None, :]
        mix[:, -fe:] *= np.linspace(1, 0, fe)[None, :]
    return mix

# ---------------------------------------------------------------- main
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    for item in CFG:
        cid = item["id"]
        name = "menu" if cid == 0 else f"ch{cid:02d}"
        if only and name not in only: continue
        cfg = item["music"]
        if "cents" not in cfg or not cfg["cents"]:
            from importlib import import_module
            sys.path.insert(0, "/home/z/my-project/scripts")
            # cents embedded in TS — fallback: dump already resolved them
            raise SystemExit(f"missing cents for {name}")
        print(f"render {name} … bpm={cfg['bpm']} lead={cfg['lead']}", flush=True)
        audio = render_track(cfg, seed=1000+cid)
        raw = f"/tmp/{name}.wav"
        import wave
        pcm = (audio.T * 32767).astype(np.int16)
        with wave.open(raw, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        ogg = f"{OUT_DIR}/{name}.ogg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw,
                        "-c:a", "libvorbis", "-q:a", "5", "-ar", "44100", ogg], check=True)
        print(f"  -> {ogg} {os.path.getsize(ogg)//1024}KB", flush=True)

if __name__ == "__main__":
    main()
