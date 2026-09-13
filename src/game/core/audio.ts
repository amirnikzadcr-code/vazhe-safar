/* ------------------------------------------------------------------
 *  واژه‌سفر — core/audio.ts
 *  Procedural audio engine (Web Audio API) — traditional-Iranian style:
 *   • Dastgāh-inspired microtonal scales (koron ≈ −60..−80 cents)
 *   • Phrase-based melodic generator (santur / ney / kamancheh voices)
 *     with ornaments: grace notes, tremolo repeats, call & response
 *   • Persian percussion: tombak (tom/bak/tak) and daf (frame + jingle),
 *     in 4/4 and 6/8 feel
 *   • Convolution reverb from a synthesized impulse
 *   • SFX synth one-shots for UI + gameplay feedback
 *  100% original — no samples, no copyrighted melodies, zero audio files.
 * ------------------------------------------------------------------ */

export type Meter = 4 | 6;                 // 4/4 or 6/8 feel
export type LeadVoice = "santur" | "ney" | "kamancheh";
export type PercVoice = "tombak" | "daf" | "none";

export interface MusicConfig {
  root: number;          // root frequency (Hz), e.g. D4 ≈ 293.66
  cents: number[];       // scale degrees in cents from root (incl. 0)
  bpm: number;
  meter: Meter;
  perc: PercVoice;
  lead: LeadVoice;
  density: number;       // 0..1 — melody note density
  octave: number;        // melody octave shift (-1 | 0 | 1)
  drone: number;         // drone volume 0..1
}

const ROOTS: Record<string, number> = {
  D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
};

/** Approximated Persian dastgāh scales in cents (koron ≈ −60..−80c) */
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

/** phrase contour archetypes (scale-degree walk recipes) */
type Contour = "upArc" | "downArc" | "pendulum" | "neighbor" | "descent";
const CONTOURS: Contour[] = ["upArc", "downArc", "pendulum", "neighbor", "descent"];

function buildPhrase(len: number, contour: Contour, top: number): number[] {
  const p: number[] = [];
  switch (contour) {
    case "upArc":
      for (let i = 0; i < len; i++) p.push(Math.round((i / (len - 1 || 1)) * top));
      break;
    case "downArc":
      for (let i = 0; i < len; i++) p.push(Math.round((1 - i / (len - 1 || 1)) * top));
      break;
    case "pendulum":
      for (let i = 0; i < len; i++) {
        const t = i / (len - 1 || 1);
        p.push(Math.round(Math.abs(Math.sin(t * Math.PI * 1.5)) * top));
      }
      break;
    case "neighbor":
      for (let i = 0; i < len; i++) p.push(i % 2 === 0 ? 0 : Math.min(2, top));
      break;
    case "descent":
      for (let i = 0; i < len; i++) {
        const step = Math.floor((top * i) / len);
        p.push(Math.max(0, top - step));
      }
      break;
  }
  return p.map((d) => Math.max(0, Math.min(top, d)));
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
  private step = 0;               // step counter within the phrase cycle
  private cfg: MusicConfig | null = null;

  // phrase state
  private phrase: number[] = [0, 2, 1, 4];
  private phrasePos = 0;
  private barCount = 0;
  private leadOctave = 0;

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

      // simple synthesized convolution reverb
      this.wet = this.ctx.createGain();
      this.wet.gain.value = 0.22;
      const conv = this.ctx.createConvolver();
      conv.buffer = this.makeImpulse(2.1, 2.6);
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

  startMusic(cfg: MusicConfig): void {
    if (!this.ensure() || !this.ctx) return;
    this.cfg = cfg;
    if (this.timer) return; // already running; config swapped below
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.barCount = 0;
    this.phrase = buildPhrase(6, "upArc", cfg.cents.length - 1);
    this.phrasePos = 0;
    this.timer = setInterval(() => this.scheduler(), 80);
  }

  /** swap to another chapter's config with a gentle dip (crossfade feel) */
  setMusicConfig(cfg: MusicConfig): void {
    if (!this.ctx || !this.musicBus) { this.cfg = cfg; return; }
    this.cfg = cfg;
    this.barCount = 0;
    this.phrase = buildPhrase(6, CONTOURS[Math.floor(Math.random() * CONTOURS.length)], cfg.cents.length - 1);
    this.phrasePos = 0;
    const g = this.musicBus.gain, now = this.ctx.currentTime;
    if (this.musicOn) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this.musicVol * 0.35, now + 0.25);
      g.linearRampToValueAtTime(this.musicVol, now + 1.1);
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
    const eighth = 60 / cfg.bpm / (cfg.meter === 6 ? 3 : 2); // eighth-note dur
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextNoteTime, cfg, eighth);
      const barLen = cfg.meter === 6 ? 6 : 8; // eighth notes per bar
      this.step = (this.step + 1) % (barLen * 8); // 8-bar cycle
      if (this.step === 0) this.barCount++;
      this.nextNoteTime += eighth;
    }
  }

  private playStep(step: number, t: number, cfg: MusicConfig, eighth: number): void {
    const scale = cfg.cents;
    const barLen = cfg.meter === 6 ? 6 : 8;
    const inBar = step % barLen;
    const bar = Math.floor(step / barLen);
    const isDown = inBar === 0;

    // — drone —
    if (step === 0 && cfg.drone > 0) this.drone(t, cfg, eighth * barLen * 8);

    // — percussion —
    if (cfg.perc !== "none") this.percussion(inBar, bar, cfg.meter, cfg.perc, t, isDown);

    // — melody phrases (call & response: bars 0-3 lead, 4-5 answer lower, 6-3 rest-ish)
    const answering = cfg.meter === 6 ? bar % 4 === 3 : bar % 4 === 3;
    const restBar = bar % 8 === 6;
    if (restBar) return;

    // phrase refresh every 4 bars
    if (inBar === 0 && bar % 4 === 0) {
      const contour = CONTOURS[Math.floor(Math.random() * CONTOURS.length)];
      const len = 5 + Math.floor(Math.random() * 3);
      this.phrase = buildPhrase(len, contour, scale.length - 1);
      this.phrasePos = 0;
    }

    // note probability by beat strength
    const strong = inBar === 0 || inBar === Math.floor(barLen / 2);
    const mid = inBar % 2 === 0;
    const restP = strong ? 0.08 : mid ? cfg.density * 0.35 : (1 - cfg.density) * 0.9;
    if (Math.random() < restP) { this.phrasePos = (this.phrasePos + 1) % this.phrase.length; return; }

    let degree = this.phrase[this.phrasePos % this.phrase.length];
    this.phrasePos = (this.phrasePos + 1) % this.phrase.length;
    // occasional ornament: neighbor grace
    if (Math.random() < 0.16) {
      const gDeg = Math.min(scale.length - 1, degree + 1);
      this.leadNote(t, cfg, scale, gDeg, 0.12, eighth * 0.5);
    }
    // tremolo repeat (santur mezrāb feel)
    const trem = cfg.lead === "santur" && Math.random() < 0.14 && strong;
    const octaveShift = cfg.octave + (answering ? -1 : 0) + (Math.random() < 0.1 ? 1 : 0);
    const vol = (strong ? 0.34 : mid ? 0.24 : 0.16) * (answering ? 0.75 : 1);
    const dur = eighth * (Math.random() < 0.2 ? 3 : 1.7);
    if (trem) {
      for (let r = 0; r < 3; r++)
        this.leadNote(t + r * eighth * 0.34, cfg, scale, degree, vol * 0.7, eighth * 0.6, octaveShift);
    } else {
      this.leadNote(t, cfg, scale, degree, vol, dur, octaveShift);
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

  /* -------- instrument voices -------- */

  /** santur: bright hammered dulcimer — dual detuned courses + strike noise */
  private santur(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = Math.min(freq * 7, 7200); lp.Q.value = 0.6;

    // two slightly detuned strings per course (authentic chorus shimmer)
    for (const det of [-3, 2.4]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq * c2r(det);
      const og = ctx.createGain(); og.gain.value = 0.5;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.5);
    }
    // octave shimmer string
    const o2 = ctx.createOscillator();
    o2.type = "sine"; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    o2.connect(g2).connect(g);
    o2.start(t); o2.stop(t + dur * 0.7 + 0.3);

    // hammer strike transient
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 3400; bp.Q.value = 1.4;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      src.connect(bp).connect(ng).connect(bus);
      src.start(t); src.stop(t + 0.06);
    }
    g.connect(lp).connect(bus);
  }

  /** ney: breathy end-blown flute — sine + breath noise + delayed vibrato */
  private ney(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.9, t + 0.07);
    g.gain.setValueAtTime(vol * 0.9, t + Math.max(0.08, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.12);

    const o = ctx.createOscillator();
    o.type = "sine"; o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine"; o2.frequency.value = freq * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.08;

    // delayed vibrato (player's lip settles into the note)
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.011, t + Math.min(0.35, dur * 0.5));
    vib.connect(vibG).connect(o.frequency);

    // breath
    let breath: AudioNode | null = null;
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = freq * 1.7; bp.Q.value = 1.1;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(vol * 0.16, t + 0.09);
      bg.gain.setTargetAtTime(0, t + dur * 0.75, 0.08);
      src.connect(bp).connect(bg).connect(bus);
      src.start(t); src.stop(t + dur + 0.2);
      breath = bg;
    }

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = Math.min(freq * 4.5, 5200);
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(lp).connect(bus);
    o.start(t); o2.start(t); vib.start(t);
    o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2); vib.stop(t + dur + 0.2);
    void breath;
  }

  /** kamancheh: bowed spike fiddle — filtered saw + expressive vibrato */
  private kamancheh(t: number, freq: number, vol: number, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.75, t + 0.09);
    g.gain.setValueAtTime(vol * 0.75, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.1);

    const o = ctx.createOscillator();
    o.type = "sawtooth"; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(freq * 3, 2600), t);
    lp.frequency.linearRampToValueAtTime(Math.min(freq * 5.5, 4200), t + 0.18);
    lp.Q.value = 2.2;

    const vib = ctx.createOscillator();
    vib.frequency.value = 6.1;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.017, t + 0.25);
    vib.connect(vibG).connect(o.frequency);

    o.connect(lp).connect(g).connect(bus);
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.15); vib.stop(t + dur + 0.15);
  }

  /** tonic drone (root + fifth) */
  private drone(t: number, cfg: MusicConfig, dur: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const fifth = cfg.cents[Math.min(4, cfg.cents.length - 1)];
    for (const [mult, vol] of [[1, cfg.drone], [c2r(fifth), cfg.drone * 0.5]] as const) {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = cfg.root * mult * 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.14, t + 1.4);
      g.gain.setValueAtTime(vol * 0.14, t + dur - 1.8);
      g.gain.linearRampToValueAtTime(0, t + dur);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12 + Math.random() * 0.05;
      const lfoG = ctx.createGain(); lfoG.gain.value = vol * 0.045;
      lfo.connect(lfoG).connect(g.gain);
      o.connect(g).connect(bus);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    }
  }

  /** Persian percussion patterns */
  private percussion(inBar: number, bar: number, meter: Meter, voice: PercVoice, t: number, isDown: boolean): void {
    const fill = bar % 4 === 3;
    if (meter === 6) {
      // Persian 6/8 (like a light rang): TOM - - BAK - TAK | variations
      if (inBar === 0) this.tombakTom(t, isDown ? 0.5 : 0.42);
      if (inBar === 3) this.tombakBak(t, 0.4);
      if (inBar === 5) this.tombakTak(t, 0.3);
      if (fill && inBar === 4) this.tombakTak(t, 0.24);
      if (fill && inBar === 2) this.tombakTak(t, 0.2);
    } else {
      // 4/4: TOM . tak . BAK . tak . with fills
      if (inBar === 0) this.tombakTom(t, 0.5);
      if (inBar === 4) this.tombakBak(t, 0.42);
      if (inBar === 2 || inBar === 6) this.tombakTak(t, 0.26);
      if (fill && inBar === 7) this.tombakTak(t, 0.3);
      if (fill && inBar === 5) this.tombakTak(t, 0.2);
    }
    // daf jingle shimmers on top
    if (voice === "daf" && isDown) this.dafJingle(t, 0.16);
    if (voice === "daf" && (meter === 6 ? inBar === 3 : inBar === 4)) this.dafJingle(t + 0.02, 0.1);
  }

  private tombakTom(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(185, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + 0.22);
  }

  private tombakBak(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(250, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + 0.14);
    if (this.noiseBuf) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.22, t);
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
    bp.type = "bandpass"; bp.frequency.value = 2600 + Math.random() * 700; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(bp).connect(g).connect(bus);
    src.start(t); src.stop(t + 0.08);
  }

  private dafJingle(t: number, vol: number): void {
    const ctx = this.ctx!; const bus = this.musicBus!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 5600;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 7400; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(hp).connect(bp).connect(g).connect(bus);
    src.start(t); src.stop(t + 0.2);
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

  sfxClick(): void { this.sfxOsc({ type: "sine", f0: 620, f1: 420, dur: 0.07, vol: 0.22 }); }

  sfxLetter(idx: number): void {
    // walk up the current chapter scale for a musical feel
    const cfg = this.cfg;
    if (cfg && this.musicOn) {
      const deg = idx % cfg.cents.length;
      const f = cfg.root * c2r(cfg.cents[deg] + 1200 * (cfg.octave + 1));
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.12, vol: 0.24, filter: 6000 });
    } else {
      const base = 520 * Math.pow(1.059, Math.min(idx, 10));
      this.sfxOsc({ type: "triangle", f0: base, dur: 0.12, vol: 0.26, filter: 6000 });
    }
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

  /** low boom for fireworks/finale */
  sfxBoom(): void {
    this.sfxOsc({ type: "sine", f0: 220, f1: 46, dur: 0.5, vol: 0.4 });
    this.sfxNoise({ dur: 0.7, vol: 0.12, freq: 900, q: 0.6, type: "lowpass" });
    this.sfxNoise({ dur: 0.9, vol: 0.06, freq: 6000, q: 2, delay: 0.05 });
  }
}

export const Audio = new AudioEngine();
