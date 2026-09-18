#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
واژه‌سفر — render_party2.py  (session GG)
«یک موزیک هیجانی بزار برای اون قسمت وقتی بازی شروع میشه»

The high-energy GAME-PHASE theme for بازی دورهمی. Same original
musical identity (rast ۶/۸, physical-model santur/daf/tombak) but
engineered for adrenaline:
  • 138 BPM — noticeably faster than the menu/setup theme (118)
  • DOUBLE percussion: driving daf ۶/۸ + tombak accent layer with
    pre-cycle fills
  • a racing santur eighth-note ostinato under the melody
  • brighter drone, octave-up melody echoes every cycle
Renders to public/assets/music/party2.ogg — seamless loop, 48 kHz,
same mastering chain as the rest of the soundtrack (no lags: decoded
once, looped from a single AudioBuffer).
"""
import math, os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, "/home/z/my-project/scripts")
import render_music as rm   # reuse the physical models + mastering chain

SR = rm.SR
OUT_DIR = rm.OUT_DIR

# rast cents (same scale as PARTY_MUSIC / chapters.ts)
RAST = [0, 204, 356, 498, 702, 906, 1050]

CFG = {
    "track": "party2", "scale": "rast", "root": 293.66, "cents": RAST,
    "bpm": 138, "meter": 6, "perc": "daf", "lead": "santur",
    "octave": 1, "drone": 0.45,
    # rising, driving motif (matches PARTY_GAME_MUSIC in chapters.ts)
    "motif":  [[0,0.5],[4,0.5],[3,0.5],[5,0.5],[7,0.5],[5,0.5],
               [4,0.5],[3,0.5],[4,0.5],[1,0.5],[2,0.5],[3,1]],
    "motifB": [[7,0.5],[8,0.5],[7,0.5],[5,0.5],[4,1],[5,0.5],
               [3,0.5],[2,0.5],[1,1],[0,1]],
}

def c2r(c): return 2.0 ** (c / 1200.0)

def render_party2():
    cfg = CFG
    r = np.random.default_rng(20260918)
    bpm, meter = cfg["bpm"], cfg["meter"]
    eighth = 60/bpm/2
    barLen = 6
    breathStart = barLen*4
    breathEnd = breathStart + barLen
    cycle = barLen*8
    evA = rm.parse_motif(cfg["motif"], breathStart)
    evB = rm.parse_motif(cfg["motifB"], max(barLen, barLen*8 - breathEnd))
    cycSec = cycle*eighth
    cycles = 3
    total = int((cycles*cycSec + 3.5)*SR)
    L = np.zeros(total); R = np.zeros(total)

    def put(sig, t0):
        if t0 < 0:
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

    def note_freq(deg, octave_shift=0):
        oct_ = cfg["octave"] + octave_shift
        f = cfg["root"] * (2 ** oct_) * c2r(cfg["cents"][deg % len(cfg["cents"])])
        return f * (2 ** (deg // len(cfg["cents"])))

    for cyc in range(cycles):
        t_cyc = cyc*cycSec
        # ---- brighter, slightly louder drone (energy bed)
        put(rm.pad_chord(cfg["root"], cfg["cents"], cycSec+2.0, cfg["drone"]), t_cyc)

        # ---- melody (racing santur) + octave echo
        for role, evs in (("A", evA), ("B", evB)):
            base = t_cyc + (0 if role == "A" else breathEnd*eighth)
            rel = -1 if role == "B" else 0
            fade = 0.78 + 0.22*min(1, cyc/1.2)
            for deg, pos, e, strong in evs:
                vol = (0.185 if role == "B" else 0.26) * fade
                if strong: vol *= 1.15
                if e >= 4: vol *= 1.12
                jit = r.uniform(-0.012, 0.012)
                dur = e*eighth*r.uniform(0.92, 1.04) + 0.09
                t0 = base + pos*eighth + jit
                if t0 >= total/SR: continue
                f = note_freq(deg, rel)
                put(rm.santur(f, dur, vol), t0)
                # the "hype" layer: octave-up sparkle echo, every cycle
                put(rm.santur(f*2, dur*0.85, vol*0.30, pan=0.22), t0+0.018)
                # appoggiatura ornament (same identity as the base tracks)
                if e >= 2 and r.random() < 0.22:
                    f_g = note_freq(min(len(cfg["cents"])-1, deg+1), rel)
                    put(rm.santur(f_g, eighth*0.9, vol*0.4), t0+0.058)

        # ---- THE RACING OSTATINATO: steady santur eighths 1-5-4-3 of
        #      the scale, quiet but relentless — the engine of the track
        ost_deg = [0, 4, 3, 4]
        for bar in range(8):
            if bar == 4: continue
            base = t_cyc + bar*barLen*eighth
            v = 0.052 + 0.012*min(1, cyc)
            for k in range(barLen):
                deg = ost_deg[k % len(ost_deg)]
                f = note_freq(deg)
                put(rm.santur(f, eighth*0.95, v, pan=(-0.18 if k % 2 else 0.18)),
                    base + k*eighth)

        # ---- DOUBLE percussion: driving daf + tombak accents
        for bar in range(8):
            if bar == 4: continue
            base = t_cyc + bar*barLen*eighth
            dens = 0.9 if cyc == 0 else 1.0
            # daf ۶/۸ — the party groove, doubled density vs party.ogg
            daf_pat = [("DUM", 0, 1.0), ("TEK", 1, 0.4), ("TEK", 2, 0.65),
                       ("DUM", 3, 0.8), ("TEK", 4, 0.6), ("BAK", 5, 0.45)]
            for kind, off, v in daf_pat:
                if r.random() > 0.94*dens: continue
                vv = v*dens*r.uniform(0.88, 1.1)
                put(rm.daf(kind, vv, pan=r.uniform(-0.08, 0.08)),
                    base+off*eighth+r.uniform(-0.006, 0.006))
            # tombak accents — syncopated pops + a fill into the next bar
            tom_pat = [("TEK", 0.5, 0.5), ("DUM", 2.5, 0.65), ("TEK", 3.5, 0.5)]
            for kind, off, v in tom_pat:
                if r.random() > 0.9: continue
                put(rm.tombak(kind, v*dens*r.uniform(0.85, 1.1), pan=r.uniform(-0.1, 0.1)),
                    base+off*eighth)
            if bar in (3, 7):  # pre-phrase fill
                for i, v in enumerate((0.4, 0.5, 0.62, 0.75)):
                    put(rm.tombak("TEK", v, pan=r.uniform(-0.12, 0.12)),
                        base + (barLen - 4 + i)*eighth + i*0.012)
            # low boom on every cycle start — the "match start" hit
            # (4 ms fade-in kills the vorbis ringing overshoot)
            if bar == 0:
                f = cfg["root"]/2
                n = int(0.5*SR)
                tt = np.arange(n)/SR
                boom = np.exp(-tt*7.5)*np.sin(2*np.pi*f*tt*(1+tt*1.5))
                fi = min(192, n)
                boom[:fi] *= np.linspace(0, 1, fi)
                boom *= 0.34
                put(boom.astype(np.float32), base)

    return rm.stereo(total, L, R, cycSec)

def main():
    print("render party2 … bpm=138 lead=santur (double perc + ostinato)", flush=True)
    audio = render_party2()
    # the loop crossfade can sum two loud segments — renormalize to a
    # safe ceiling (vorbis ringing adds ~10% overshoot on decode)
    peak = float(np.abs(audio).max())
    if peak > 0.84:
        audio *= 0.84 / peak
    raw = "/tmp/party2.wav"
    pcm = (audio.T * 32767).astype(np.int16)
    with wave.open(raw, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    ogg = f"{OUT_DIR}/party2.ogg"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw,
                    "-c:a", "libvorbis", "-q:a", "5", "-ar", "48000", ogg], check=True)
    print(f"  -> {ogg} {os.path.getsize(ogg)//1024}KB", flush=True)

if __name__ == "__main__":
    main()
