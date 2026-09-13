#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Visual QA for rendered music: waveform + spectrogram PNG per track."""
import sys, wave
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
try:
    fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf')
except Exception:
    pass
import matplotlib.pyplot as plt
from scipy.signal import spectrogram

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

path = sys.argv[1]
out = sys.argv[2]
import subprocess, tempfile
with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
    tmpwav = tf.name
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ar", "44100", "-ac", "2", tmpwav], check=True)
w = wave.open(tmpwav)
sr = w.getframerate()
pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
stereo = pcm.reshape(-1, 2)
mono = stereo.mean(axis=1)
dur = len(mono)/sr

fig, axes = plt.subplots(2, 1, figsize=(11, 6), constrained_layout=True)
axes[0].plot(np.arange(len(mono))/sr, mono, lw=0.15, color="#8a5a24")
axes[0].set_title(f"{path.split('/')[-1]}  dur={dur:.1f}s  peak={np.abs(mono).max():.2f}  rms={np.sqrt((mono**2).mean()):.3f}")
axes[0].set_ylabel("amp")
f, t, Sxx = spectrogram(mono, sr, nperseg=4096, noverlap=3072)
Sd = 10*np.log10(Sxx + 1e-10)
im = axes[1].pcolormesh(t, f, Sd, shading="auto", cmap="magma", vmin=-110, vmax=-30)
axes[1].set_ylim(0, 8000)
axes[1].set_ylabel("Hz"); axes[1].set_xlabel("s")
fig.colorbar(im, ax=axes[1], label="dB")
fig.savefig(out, dpi=90)
print(f"OK {out}  dur={dur:.1f}s peak={np.abs(mono).max():.2f} rms={np.sqrt((mono**2).mean()):.3f}")
# loudness balance over 3-second windows (dynamics check)
wins = int(3*sr)
rms3 = [float(np.sqrt((mono[i:i+wins]**2).mean())) for i in range(0, len(mono)-wins, wins)]
print("rms windows:", " ".join(f"{v:.3f}" for v in rms3))
