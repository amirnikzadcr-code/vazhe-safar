/* ------------------------------------------------------------------
 *  واژه‌سفر — core/audio.ts
 *  Procedural audio engine (Web Audio API) — traditional-Iranian style.
 *  v2 "روح‌دار" rewrite:
 *   • HAND-COMPOSED melodic motifs per chapter (no random note walks)
 *   • call & response form: phrase A — breath bar — phrase B (lower,
 *     quieter), long cadential notes that actually resolve to the tonic
 *   • humanized performance: micro-timing jitter, delayed vibrato,
 *     soft appoggiatura ornaments, legato overlaps
 *   • warm pad layer (root + fifth + octave) instead of dry sine drone
 *   • sparse, gentle tombak/daf — breath bars stay silent
 *   • spacious convolution reverb
 *   • SFX synth one-shots for UI + gameplay feedback
 *  100% original — no samples, no copyrighted melodies, zero audio files.
 * ------------------------------------------------------------------ */

export type Meter = 4 | 6;                 // 4/4 or 6/8 feel
export type LeadVoice = "santur" | "ney" | "kamancheh";
export type PercVoice = "tombak" | "daf" | "none";

/** one melodic event: [scaleDegree | -1(rest), durationInBeats] */
export type Motif = [number, number][];

export interface MusicConfig {
  root: number;          // root frequency (Hz)
  cents: number[];       // scale degrees in cents from root (incl. 0)
  bpm: number;
  meter: Meter;
  perc: PercVoice;
  lead: LeadVoice;
  octave: number;        // melody octave shift (-1 | 0 | 1)
  drone: number;         // pad volume 0..1
  motif: Motif;          // phrase A (statement)
  motifB?: Motif;        // phrase B (answer, lower & softer)
}

const ROOTS: Record<string, number> = {
  D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
};

/** Approximated Persian dastgāh scales in cents (koron ≈ −60..−80c) */
export const SCALES = {
  mahur:     [0, 204, 408, 498, 702, 906, 1108],          // major-like, bright
  shur:      [0, 150, 294, 498, 702, 792, 996],           // the mother dastgah
  homayun:   [0, 204, 316, 498, 702, 906, 1016],          // majestic
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

interface NoteEv {
  degree: number;
  start: number;         // eighth-offset inside the phrase window
  eighths: number;       // duration in eighth notes
  role: "A" | "B";
  strong: boolean;       // starts on a strong beat
}

/** parse a composed motif into cycle-relative eighth-note events */
function parseMotif(motif: Motif, role: "A" | "B", windowEighths: number): NoteEv[] {
  const out: NoteEv[] = [];
  let pos = 0;
  for (const [deg, beats] of motif) {
    const e = Math.round(beats * 2);
    if (e <= 0) continue;
    if (deg >= 0 && pos + e <= windowEighths) {
      out.push({ degree: deg, start: pos, eighths: e, role, strong: pos % 4 === 0 || pos % 3 === 0 });
    }
    pos += e;
    if (pos >= windowEighths) break;
  }
  return out;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private wet: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private musicOn = true;
  private sfxOn = true;
  private musicVol = 0.8;
  private sfxVol = 0.9;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;               // absolute eighth counter
  private cfg: MusicConfig | null = null;
  private eventsA: NoteEv[] = [];
  private eventsB: NoteEv[] = [];

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
      comp.threshold.value = -20; comp.knee.value = 26; comp.ratio.value = 5;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? this.musicVol : 0;
      this.musicBus.connect(this.master);

      // simple synthesized convolution reverb — spacious, warm hall
      this.wet = this.ctx.createGain();
      this.wet.gain.value = 0.3;
      const conv = this.ctx.createConvolver();
      conv.buffer = this.makeImpulse(2.7, 2.2);
      this.wet.connect(conv).connect(this.master);
      this.musicBus.connect(this.wet);

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

  private makeImpulse(seconds: number, decay: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
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

  private rebuildEvents(cfg: MusicConfig): void {
    const barLen = cfg.meter === 6 ? 6 : 8;
    const breathStart = barLen * 4;          // after 4 bars
    const breathEnd = breathStart + barLen;  // 1 silent bar
    this.eventsA = parseMotif(cfg.motif, "A", breathStart);
    this.eventsB = parseMotif(cfg.motifB ?? cfg.motif, "B", Math.max(barLen, (barLen * 8) - breathEnd));
    (this as unknown as { _win: { breathStart: number; breathEnd: number; cycle: number } })._win =
      { breathStart, breathEnd, cycle: barLen * 8 };
  }

  startMusic(cfg: MusicConfig): void {
    if (!this.ensure() || !this.ctx) return;
    this.cfg = cfg;
    this.rebuildEvents(cfg);
    if (this.timer) return; // already running; config swapped below
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.scheduler(), 80);
  }

  /** swap to another chapter's config with a gentle dip (crossfade feel) */
  setMusicConfig(cfg: MusicConfig): void {
    if (!this.ctx || !this.musicBus) { this.cfg = cfg; return; }
    this.cfg = cfg;
    this.rebuildEvents(cfg);
    // restart the cycle so the new phrase begins promptly
    this.step = 0;
    this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.06);
    const g = this.musicBus.gain, now = this.ctx.currentTime;
    if (this.musicOn) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this.musicVol * 0.4, now + 0.25);
      g.linearRampToValueAtTime(this.musicVol, now + 1.2);
    }
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
    const eighth = 60 / cfg.bpm / 2; // eighth-note duration
    while (this.nextNoteTime < ctx.currentTime + 0.4) {
      this.playStep(this.step, this.nextNoteTime, cfg, eighth);
      const win = (this as unknown as { _win: { cycle: number } })._win;
      this.step = (this.step + 1) % win.cycle;
      this.nextNoteTime += eighth;
    }
  }

  private playStep(step: number, t: number, cfg: MusicConfig, eighth: number): void {
    const barLen = cfg.meter === 6 ? 6 : 8;
    const win = (this as unknown as { _win: { breathStart: number; breathEnd: number; cycle: number } })._win;
    const inBar = step % barLen;
    const bar = Math.floor(step / barLen);

    // — warm pad (retriggered once per cycle) —
    if (step === 0 && cfg.drone > 0) this.pad(t, cfg, eighth * win.cycle);

    // — percussion (silent on the breath bar, organic skips) —
    const breathBar = step >= win.breathStart && step < win.breathEnd;
    if (cfg.perc !== "none" && !breathBar && Math.random() > 0.1)
      this.percussion(inBar, bar, cfg.meter, cfg.perc, t);

    // — melody: phrase A, silent breath bar, phrase B —
    if (step < win.breathStart) {
      this.firePhrase("A", step, t, cfg, eighth);
    } else if (step >= win.breathEnd) {
      this.firePhrase("B", step - win.breathEnd, t, cfg, eighth);
    }
  }

  private firePhrase(role: "A" | "B", offset: number, t: number, cfg: MusicConfig, eighth: number): void {
    const events = role === "A" ? this.eventsA : this.eventsB;
    // phrase B answers an octave lower (relative shift; leadNote adds cfg.octave itself)
    const relShift = role === "B" ? -1 : 0;
    for (const n of events) {
      if (n.start !== offset) continue;
      const scale = cfg.cents;
      // dynamics: phrase B softer; strong beats a touch louder; long notes breathe
      let vol = n.role === "B" ? 0.17 : 0.24;
      if (n.strong) vol *= 1.15;
      if (n.eighths >= 4) vol *= 1.12;
      // humanize: micro-timing jitter + legato overlap
      const jit = (Math.random() - 0.5) * 0.028;
      const dur = n.eighths * eighth * (0.92 + Math.random() * 0.12) + 0.09;
      // appoggiatura ornament on longer notes
      if (n.eighths >= 2 && Math.random() < 0.16) {
        const gDeg = Math.min(scale.length - 1, n.degree + 1);
        this.leadNote(t + jit + 0.062, cfg, scale, gDeg, vol * 0.4, eighth * 0.9, relShift);
      }
      this.leadNote(t + jit, cfg, scale, n.degree, vol, dur, relShift);
    }
  }

  private leadNote(t: number, cfg: MusicConfig, scale: number[], degree: number, vol: number, dur: number, octaveShift = 0): void {
    const cents = scale[degree % scale.length] + 1200 * (cfg.octave + octaveShift);
    const freq = cfg.root * c2r(cents);
    switch (cfg.lead) {
      case "ney": this.ney(t, freq, vol, dur); break;
      case "kamancheh": this.kamancheh(t, freq, vol, dur); break;
      default: this.santur(t, freq, vol, dur);
    }
  }

  /* -------- instrument voices (soft, warm, "روح‌دار") -------- */

  /** santur: warm hammered dulcimer — gentle strike, singing decay */
  private santur(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.55);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = Math.min(freq * 5.5, 5600); lp.Q.value = 0.4;

    // two slightly detuned strings per course (authentic chorus shimmer)
    for (const det of [-2.6, 2]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq * c2r(det);
      const og = ctx.createGain(); og.gain.value = 0.5;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.65);
    }
    // octave shimmer string (quiet)
    const o2 = ctx.createOscillator();
    o2.type = "sine"; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.14;
    o2.connect(g2).connect(g);
    o2.start(t); o2.stop(t + dur * 0.6 + 0.3);

    // soft mallet transient (much gentler than before)
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.22, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(bp).connect(ng).connect(bus);
      src.start(t); src.stop(t + 0.05);
    }
    g.connect(lp).connect(bus);
  }

  /** ney: breathy end-blown flute — warm, vocal, delayed vibrato */
  private ney(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    const atk = Math.min(0.11, dur * 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.85, t + atk);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(atk + 0.02, dur * 0.62));
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur + 0.18);

    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine"; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.06;

    // delayed vibrato (player's lip settles into the note)
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.009, t + Math.min(0.45, dur * 0.55));
    vib.connect(vibG).connect(o.frequency);

    // gentle breath
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = freq * 1.6; bp.Q.value = 0.9;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(vol * 0.09, t + atk);
      bg.gain.setTargetAtTime(0, t + dur * 0.7, 0.09);
      src.connect(bp).connect(bg).connect(bus);
      src.start(t); src.stop(t + dur + 0.25);
    }

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = Math.min(freq * 4, 4400);
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(lp).connect(bus);
    o.start(t); o2.start(t); vib.start(t);
    o.stop(t + dur + 0.25); o2.stop(t + dur + 0.25); vib.stop(t + dur + 0.25);
  }

  /** kamancheh: bowed spike fiddle — smooth, singing vibrato */
  private kamancheh(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.62, t + 0.1);
    g.gain.setValueAtTime(vol * 0.62, t + dur * 0.66);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur + 0.14);

    const o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(freq * 2.6, 2200), t);
    lp.frequency.linearRampToValueAtTime(Math.min(freq * 4.5, 3600), t + 0.22);
    lp.Q.value = 1.6;

    const vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.012, t + 0.3);
    vib.connect(vibG).connect(o.frequency);

    o.connect(lp).connect(g).connect(bus);
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.2); vib.stop(t + dur + 0.2);
  }

  /** warm pad: root + fifth + octave, slow swell (replaces bare drone) */
  private pad(t: number, cfg: MusicConfig, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const fifth = cfg.cents[Math.min(4, cfg.cents.length - 1)];
    const parts: [number, number][] = [
      [0.5, cfg.drone * 0.05],
      [0.5 * c2r(fifth), cfg.drone * 0.032],
      [1, cfg.drone * 0.02],
    ];
    for (const [mult, vol] of parts) {
      const o = ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = cfg.root * mult;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(2.2, dur * 0.3));
      g.gain.setValueAtTime(vol, t + dur * 0.72);
      g.gain.linearRampToValueAtTime(0, t + dur);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09 + Math.random() * 0.04;
      const lfoG = ctx.createGain(); lfoG.gain.value = vol * 0.35;
      lfo.connect(lfoG).connect(g.gain);
      o.connect(lp).connect(g).connect(bus);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    }
  }

  /** Persian percussion — sparse, warm, unhurried */
  private percussion(inBar: number, bar: number, meter: Meter, voice: PercVoice, t: number): void {
    const soft = bar % 8 === 7; // last bar of cycle: even gentler
    const v = soft ? 0.72 : 1;
    if (meter === 6) {
      // 6/8 lilt: DUM - - BAK - TAK
      if (voice === "tombak") {
        if (inBar === 0) this.tombakTom(t, 0.3 * v);
        if (inBar === 3) this.tombakBak(t, 0.2 * v);
        if (inBar === 5) this.tombakTak(t, 0.13 * v);
      } else {
        if (inBar === 0) { this.tombakTom(t, 0.26 * v); this.dafJingle(t, 0.07 * v); }
        if (inBar === 3) { this.tombakTom(t, 0.14 * v); this.dafJingle(t + 0.02, 0.05 * v); }
        if (inBar === 4) this.tombakTak(t, 0.09 * v);
      }
    } else {
      // 4/4: DUM . tak . BAK . tak .
      if (voice === "tombak") {
        if (inBar === 0) this.tombakTom(t, 0.3 * v);
        if (inBar === 4) this.tombakBak(t, 0.2 * v);
        if (inBar === 6) this.tombakTak(t, 0.12 * v);
      } else {
        if (inBar === 0) { this.tombakTom(t, 0.24 * v); this.dafJingle(t, 0.06 * v); }
        if (inBar === 4) { this.tombakTom(t, 0.15 * v); this.dafJingle(t + 0.02, 0.05 * v); }
        if (inBar === 2) this.tombakTak(t, 0.08 * v);
      }
    }
  }

  private tombakTom(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(85, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 600;
    o.connect(g).connect(lp).connect(bus);
    o.start(t); o.stop(t + 0.24);
  }

  private tombakBak(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(235, t);
    o.frequency.exponentialRampToValueAtTime(135, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1200;
    o.connect(g).connect(lp).connect(bus);
    o.start(t); o.stop(t + 0.16);
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 1.1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.16, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(bp).connect(ng).connect(bus);
      src.start(t); src.stop(t + 0.07);
    }
  }

  private tombakTak(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.95 + Math.random() * 0.2;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2200 + Math.random() * 600; bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.36, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp).connect(g).connect(bus);
    src.start(t); src.stop(t + 0.08);
  }

  private dafJingle(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 5200;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 7000; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(hp).connect(bp).connect(g).connect(bus);
    src.start(t); src.stop(t + 0.18);
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

  /** musical note SFX helper */
  private note(freq: number, vol = 0.35, dur = 0.4, delay = 0): void {
    this.sfxOsc({ type: "triangle", f0: freq, dur, vol, delay, filter: 5200 });
    this.sfxOsc({ type: "sine", f0: freq * 2, dur: dur * 0.7, vol: vol * 0.4, delay });
  }

  // — public SFX vocabulary —

  sfxClick(): void { this.sfxOsc({ type: "sine", f0: 560, f1: 400, dur: 0.08, vol: 0.18 }); }

  sfxLetter(idx: number): void {
    // walk up the current chapter scale for a musical feel
    const cfg = this.cfg;
    if (cfg && this.musicOn) {
      const deg = idx % cfg.cents.length;
      const f = cfg.root * c2r(cfg.cents[deg] + 1200 * (cfg.octave + 1));
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.13, vol: 0.2, filter: 5200 });
    } else {
      const base = 500 * Math.pow(1.059, Math.min(idx, 10));
      this.sfxOsc({ type: "triangle", f0: base, dur: 0.13, vol: 0.22, filter: 5200 });
    }
    this.sfxNoise({ dur: 0.05, vol: 0.045, freq: 3400 });
  }

  sfxWordFound(step: number = 0): void {
    const roots = [523.25, 587.33, 659.25];
    const base = roots[step % 3];
    [1, 1.26, 1.5].forEach((m, i) =>
      this.note(base * m, 0.26, 0.55, i * 0.08));
    this.sfxNoise({ dur: 0.32, vol: 0.04, freq: 5000, q: 3, delay: 0.06 });
  }

  sfxBonus(): void {
    this.note(784, 0.26, 0.35);
    this.note(1046.5, 0.28, 0.6, 0.1);
    this.sfxNoise({ dur: 0.5, vol: 0.06, freq: 6600, q: 4, delay: 0.12 });
  }

  sfxWrong(): void {
    // soft, low "uh-oh" — never harsh
    this.sfxOsc({ type: "sine", f0: 165, f1: 105, dur: 0.25, vol: 0.16 });
    this.sfxOsc({ type: "sine", f0: 82, dur: 0.22, vol: 0.12, delay: 0.02 });
  }

  sfxCoin(): void {
    this.sfxOsc({ type: "sine", f0: 1244, dur: 0.1, vol: 0.16 });
    this.sfxOsc({ type: "sine", f0: 1661, dur: 0.22, vol: 0.16, delay: 0.06 });
  }

  sfxHint(): void {
    this.sfxOsc({ type: "sine", f0: 660, f1: 1760, dur: 0.5, vol: 0.14, curve: "exp" });
    this.sfxNoise({ dur: 0.5, vol: 0.04, freq: 4200, q: 2 });
  }

  sfxShuffle(): void {
    for (let i = 0; i < 5; i++)
      this.sfxNoise({ dur: 0.06, vol: 0.07, freq: 2000 + i * 380, delay: i * 0.05 });
  }

  sfxLevelComplete(stars: number): void {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.note(f, 0.3, 0.65, i * 0.14));
    for (let i = 0; i < stars; i++)
      this.note(1567.98, 0.26, 0.75, 0.7 + i * 0.24);
    this.sfxNoise({ dur: 0.9, vol: 0.04, freq: 7000, q: 3, delay: 0.55 });
  }

  sfxChapterUnlock(): void {
    const seq = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => this.note(f, 0.26, 0.95, i * 0.13));
    this.sfxNoise({ dur: 1.5, vol: 0.05, freq: 5000, q: 2, delay: 0.45 });
  }

  sfxPropAppear(): void {
    this.sfxOsc({ type: "sine", f0: 860, f1: 1480, dur: 0.3, vol: 0.1 });
    this.sfxNoise({ dur: 0.35, vol: 0.04, freq: 5800, q: 5, delay: 0.03 });
  }

  sfxStar(): void { this.note(1318.5, 0.26, 0.65); }

  /** low boom for fireworks/finale */
  sfxBoom(): void {
    this.sfxOsc({ type: "sine", f0: 200, f1: 44, dur: 0.55, vol: 0.34 });
    this.sfxNoise({ dur: 0.75, vol: 0.1, freq: 850, q: 0.6, type: "lowpass" });
    this.sfxNoise({ dur: 0.95, vol: 0.05, freq: 5800, q: 2, delay: 0.05 });
  }
}

export const Audio = new AudioEngine();
