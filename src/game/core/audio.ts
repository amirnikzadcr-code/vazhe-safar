/* ------------------------------------------------------------------
 *  واژه‌سفر — core/audio.ts
 *  Procedural audio engine (Web Audio API):
 *   • Generative chapter music inspired by Persian dastgah intervals
 *     (microtonal via cents) — 100% original, no sampled melodies.
 *   • SFX synth one-shots for UI + gameplay feedback.
 *  No audio files needed → tiny footprint, offline-friendly, original.
 * ------------------------------------------------------------------ */

export interface MusicConfig {
  root: number;        // root frequency (Hz), e.g. D4 ≈ 293.66
  cents: number[];     // scale degrees in cents from root (incl. 0)
  bpm: number;
  perc: boolean;       // percussion layer on/off
  density: number;     // 0..1 — melody note density
  octaveBase: number;  // melody octave shift (-1 | 0 | 1)
  drone: number;       // drone volume 0..1
}

const ROOTS: Record<string, number> = {
  D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
};

/** Approximated Persian dastgāh scales in cents (koron ≈ -60..-80c) */
export const SCALES = {
  mahur:     [0, 204, 408, 498, 702, 906, 1108],          // major-like, bright
  shur:      [0, 160, 316, 498, 702, 892, 1030],          // the "mother" mode
  homayun:   [0, 204, 340, 498, 702, 906, 1040],          // majestic
  segah:     [0, 150, 316, 498, 702, 854, 1016],          // contemplative
  dashti:    [0, 150, 316, 498, 660, 854],                // folk, intimate
  nava:      [0, 204, 316, 498, 702, 890, 996],           // mystical
  chahargah: [0, 204, 408, 560, 702, 906, 1108],          // spirited
  rast:      [0, 204, 356, 498, 702, 906, 1050],          // luminous
  abuata:    [0, 150, 316, 498, 660, 854, 1016],          // dawn-like
  afshari:   [0, 160, 316, 498, 672, 892, 1022],          // wistful
} as const;
export type ScaleName = keyof typeof SCALES;

/** cents → frequency ratio */
const c2r = (c: number) => Math.pow(2, c / 1200);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private musicOn = true;
  private sfxOn = true;
  private musicVol = 0.8;
  private sfxVol = 0.9;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;               // 16th-step counter within 2-bar loop (32 steps)
  private cfg: MusicConfig | null = null;
  private motif: number[] = [0, 2, 1, 4];
  private lastScaleIdx = 0;

  /* ---------------- lifecycle ---------------- */

  /** must be called from a user gesture */
  ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      // gentle limiter-ish compressor to avoid clipping in fanfares
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? this.musicVol : 0;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? this.sfxVol : 0;
      this.sfxBus.connect(this.master);

      // shared noise buffer (1s)
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      console.warn("[audio] unavailable", e);
      this.ctx = null;
    }
    return this.ctx;
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (this.musicBus && this.ctx)
      this.musicBus.gain.setTargetAtTime(on ? this.musicVol : 0, this.ctx.currentTime, 0.15);
  }
  setSfxOn(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx)
      this.sfxBus.gain.setTargetAtTime(on ? this.sfxVol : 0, this.ctx.currentTime, 0.05);
  }
  setMusicVol(v: number): void {
    this.musicVol = v;
    if (this.musicBus && this.ctx && this.musicOn)
      this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  setSfxVol(v: number): void {
    this.sfxVol = v;
    if (this.sfxBus && this.ctx && this.sfxOn)
      this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  /* ---------------- music ---------------- */

  startMusic(cfg: MusicConfig): void {
    if (!this.ensure() || !this.ctx) return;
    this.cfg = cfg;
    if (this.timer) return; // already running; config swapped below
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.motif = [0, 2, 1, 4];
    this.timer = setInterval(() => this.scheduler(), 90);
  }

  /** swap to another chapter's config without restarting the clock */
  setMusicConfig(cfg: MusicConfig): void {
    this.cfg = cfg;
    this.motif = [0, 2, 1, 4];
  }

  stopMusic(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private scheduler(): void {
    const ctx = this.ctx, cfg = this.cfg;
    if (!ctx || !cfg || !this.musicOn) {
      if (ctx) this.nextNoteTime = Math.max(this.nextNoteTime, ctx.currentTime + 0.05);
      return;
    }
    const stepDur = 60 / cfg.bpm / 4; // 16th note
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextNoteTime, cfg, stepDur);
      this.step = (this.step + 1) % 64; // 4-bar phrase
      this.nextNoteTime += stepDur;
    }
  }

  private playStep(step: number, t: number, cfg: MusicConfig, stepDur: number): void {
    const scale = cfg.cents;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);

    // — drone (re-pierce every 4 bars start) —
    if (step === 0 && cfg.drone > 0) this.drone(t, cfg, stepDur * 64);

    // — percussion (daf-like) —
    if (cfg.perc) {
      if (inBar === 0 || inBar === 6 || inBar === 10) this.percThump(t, inBar === 0 ? 1 : 0.7);
      if (inBar % 4 === 2) this.percSnap(t, 0.25);
      if (bar % 2 === 1 && inBar % 2 === 1) this.percSnap(t, 0.12);
    }

    // — melody (santur-like plucks) —
    // every 16th step: decide with density; contour = motif walk over scale
    const isEighth = inBar % 2 === 0;
    const strong = inBar === 0 || inBar === 8;
    const restP = strong ? 0.12 : isEighth ? cfg.density * 0.45 : (1 - cfg.density) * 0.92;
    if (Math.random() < restP) return;

    // motif variation: every 2 bars mutate one degree
    if (inBar === 0 && bar % 2 === 0) {
      const i = Math.floor(Math.random() * this.motif.length);
      const delta = Math.random() < 0.5 ? -1 : 1;
      this.motif[i] = Math.max(0, Math.min(scale.length - 1, this.motif[i] + delta));
    }
    const pos = step % this.motif.length;
    let degree = this.motif[pos];
    if (Math.random() < 0.18) degree = (degree + (Math.random() < 0.5 ? 1 : -1) + scale.length) % scale.length;
    this.lastScaleIdx = degree;

    const octave = cfg.octaveBase + (Math.random() < 0.12 ? 1 : 0);
    const cents = scale[degree] + 1200 * octave;
    const freq = cfg.root * c2r(cents);
    const gain = strong ? 0.5 : isEighth ? 0.36 : 0.22;
    this.pluck(t, freq, gain, stepDur * (Math.random() < 0.15 ? 4 : 2.2));

    // gentle harmonic shimmer on strong beats
    if (strong && Math.random() < 0.4) this.pluck(t + stepDur / 2, freq * 2, 0.1, stepDur * 2);
  }

  /* -------- instrument voices -------- */

  private pluck(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const o1 = ctx.createOscillator();
    o1.type = "triangle"; o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine"; o2.frequency.value = freq * 2.004; // shimmering octave, slight beat
    const g2 = ctx.createGain(); g2.gain.value = 0.35;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = Math.min(freq * 6, 6500); lp.Q.value = 0.7;

    o1.connect(g); o2.connect(g2).connect(g);
    g.connect(lp).connect(bus);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  private drone(t: number, cfg: MusicConfig, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const fifth = cfg.cents[Math.min(4, cfg.cents.length - 1)];
    for (const [mult, vol] of [[1, cfg.drone], [c2r(fifth), cfg.drone * 0.55]] as const) {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = cfg.root * mult * 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.16, t + 1.2);
      g.gain.setValueAtTime(vol * 0.16, t + dur - 1.5);
      g.gain.linearRampToValueAtTime(0, t + dur);
      // slow breathing
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13 + Math.random() * 0.05;
      const lfoG = ctx.createGain(); lfoG.gain.value = vol * 0.05;
      lfo.connect(lfoG).connect(g.gain);
      o.connect(g).connect(bus);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    }
  }

  private percThump(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + 0.2);
  }

  private percSnap(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.3;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2400 + Math.random() * 900; bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.34, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(bp).connect(g).connect(bus);
    src.start(t); src.stop(t + 0.1);
  }

  /* ---------------- SFX ---------------- */

  private sfxOsc(opts: {
    type: OscillatorType; f0: number; f1?: number; dur: number; vol: number;
    delay?: number; curve?: "exp" | "lin"; filter?: number;
  }): void {
    const ctx = this.ctx; if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator(); o.type = opts.type;
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1 != null) {
      if (opts.curve === "lin") o.frequency.linearRampToValueAtTime(opts.f1, t + opts.dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t + opts.dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + opts.dur);
    let node: AudioNode = g;
    if (opts.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = opts.filter;
      g.connect(lp); node = lp;
    }
    o.connect(g); node.connect(this.sfxBus!);
    o.start(t); o.stop(t + opts.dur + 0.05);
  }

  private sfxNoise(opts: { dur: number; vol: number; freq: number; q?: number; delay?: number; type?: BiquadFilterType }): void {
    const ctx = this.ctx; if (!ctx || !this.sfxOn || !this.noiseBuf) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass"; f.frequency.value = opts.freq; f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + opts.dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(t); src.stop(t + opts.dur + 0.05);
  }

  /** musical note SFX helper (uses last music scale if available) */
  private note(freq: number, vol = 0.35, dur = 0.4, delay = 0): void {
    this.sfxOsc({ type: "triangle", f0: freq, dur, vol, delay, filter: 5200 });
    this.sfxOsc({ type: "sine", f0: freq * 2, dur: dur * 0.7, vol: vol * 0.4, delay });
  }

  // — public SFX vocabulary —

  sfxClick(): void { this.sfxOsc({ type: "sine", f0: 620, f1: 420, dur: 0.07, vol: 0.22 }); }

  sfxLetter(idx: number): void {
    const base = 520 * Math.pow(1.059, Math.min(idx, 10));
    this.sfxOsc({ type: "triangle", f0: base, dur: 0.12, vol: 0.26, filter: 6000 });
    this.sfxNoise({ dur: 0.05, vol: 0.06, freq: 3600 });
  }

  sfxWordFound(step: number = 0): void {
    const roots = [523.25, 587.33, 659.25];
    const base = roots[step % 3];
    [1, 1.26, 1.5].forEach((m, i) =>
      this.note(base * m, 0.3, 0.5, i * 0.07));
    this.sfxNoise({ dur: 0.3, vol: 0.05, freq: 5200, q: 3, delay: 0.05 });
  }

  sfxBonus(): void {
    this.note(784, 0.3, 0.35);
    this.note(1046.5, 0.32, 0.55, 0.09);
    this.sfxNoise({ dur: 0.45, vol: 0.07, freq: 6800, q: 4, delay: 0.1 });
  }

  sfxWrong(): void {
    this.sfxOsc({ type: "sawtooth", f0: 190, f1: 120, dur: 0.22, vol: 0.16, filter: 700 });
    this.sfxOsc({ type: "sine", f0: 96, dur: 0.2, vol: 0.2 });
  }

  sfxCoin(): void {
    this.sfxOsc({ type: "sine", f0: 1244, dur: 0.1, vol: 0.2 });
    this.sfxOsc({ type: "sine", f0: 1661, dur: 0.22, vol: 0.2, delay: 0.06 });
  }

  sfxHint(): void {
    this.sfxOsc({ type: "sine", f0: 660, f1: 1760, dur: 0.5, vol: 0.16, curve: "exp" });
    this.sfxNoise({ dur: 0.5, vol: 0.05, freq: 4400, q: 2 });
  }

  sfxShuffle(): void {
    for (let i = 0; i < 5; i++)
      this.sfxNoise({ dur: 0.06, vol: 0.08, freq: 2200 + i * 400, delay: i * 0.045 });
  }

  sfxLevelComplete(stars: number): void {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.note(f, 0.34, 0.6, i * 0.13));
    for (let i = 0; i < stars; i++)
      this.note(1567.98, 0.3, 0.7, 0.65 + i * 0.22);
    this.sfxNoise({ dur: 0.8, vol: 0.05, freq: 7200, q: 3, delay: 0.5 });
  }

  sfxChapterUnlock(): void {
    const seq = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => this.note(f, 0.3, 0.9, i * 0.12));
    this.sfxNoise({ dur: 1.4, vol: 0.06, freq: 5200, q: 2, delay: 0.4 });
  }

  sfxPropAppear(): void {
    this.sfxOsc({ type: "sine", f0: 880, f1: 1560, dur: 0.3, vol: 0.14 });
    this.sfxNoise({ dur: 0.35, vol: 0.05, freq: 6000, q: 5, delay: 0.03 });
  }

  sfxStar(): void { this.note(1318.5, 0.3, 0.6); }
}

export const Audio = new AudioEngine();
