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
 *   • SFX synth one-shots for UI + gameplay feedback
 *  v3 PERF (user: «گوشی داغ میکنه»): the always-on ConvolverNode (2.7s
 *  stereo IR) ran FFT convolution on EVERY audio callback, forever —
 *  on weak phones that alone burned a constant CPU slice, heated the
 *  device and starved the render thread → systemic lag. The rendered
 *  OGG tracks already carry studio reverb, and SFX are deliberately
 *  dry-and-juicy — so the convolver is GONE. The audio graph is now
 *  just buses → master → compressor → destination (near-zero CPU).
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
  /** pre-rendered studio track (/assets/music/<track>.ogg) — plays instead
   *  of the live synth when available (v1.3 سنتز فیزیکی رندرشده) */
  track?: string;
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
  private _lastLetterAt = 0;      // FF9 — sfxLetter rate limiter

  /* — v1.3 rendered-track playback (gapless loop + crossfade) —
   * v4 PERF (user: mobile «جا ب جایی بین صفحات لگ داره» + «گوشی داغ میکنه»):
   * 1) the context is pinned to 48 kHz — the rendered OGGs are encoded at
   *    48 kHz too, so decodeAudioData does NO resampling (a main-thread
   *    44.1→48 kHz resample of a 26 s stereo file is a visible stall on
   *    phones, exactly at the screen-change moment).
   * 2) trackCache is an LRU capped at 3 buffers. Every decoded stereo
   *    track is ~10 MB of AudioBuffer; the old unbounded Map kept up to
   *    22 tracks (~200 MB) alive → GC pauses, memory pressure, heat. */
  private trackCache = new Map<string, AudioBuffer>();
  private trackSrc: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private currentTrack: string | null = null;
  private loadingTrack: string | null = null;
  private static readonly TRACK_CACHE_MAX = 3;

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
      /* v4 PERF: pin 48 kHz — matches the encoded tracks (no decode
       * resample) and keeps every device's graph identical. Older
       * webviews without the options object fall back gracefully. */
      try {
        this.ctx = new AC({ sampleRate: 48000 });
      } catch {
        this.ctx = new AC();
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      // gentle limiter-ish compressor to avoid clipping in fanfares
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 26; comp.ratio.value = 5;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? this.musicVol : 0;
      /* v1.20 (user: «سعی کن موزیک‌ها تیز نباشن») — a gentle TONE SHELF
       * on the music bus only: a soft lowpass (5.2 kHz) plus a -4.5 dB
       * high-shelf above 2.4 kHz removes the piercing/bright edge of
       * the santur/kamancheh synths while keeping the warmth. SFX stay
       * crisp. Both are native BiquadFilters → zero CPU concern. */
      const mLP = this.ctx.createBiquadFilter();
      mLP.type = "lowpass"; mLP.frequency.value = 5200; mLP.Q.value = 0.5;
      const mHS = this.ctx.createBiquadFilter();
      mHS.type = "highshelf"; mHS.frequency.value = 2400; mHS.gain.value = -4.5;
      this.musicBus.connect(mLP).connect(mHS).connect(this.master);

      // v3 PERF: NO convolver — rendered tracks are pre-reverbed and a
      // live convolution chain costs constant CPU + device heat.

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

  /* (makeImpulse removed with the convolver — v3 PERF) */

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
    if (cfg.track) { this.playTrack(cfg.track); return; }
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
    if (cfg.track) { this.playTrack(cfg.track); return; }
    this.stopTrack();
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
    this.stopTrack(true);
  }

  /* ---------------- app lifecycle (user request: music must NOT keep
   * playing when the game is closed / sent to background) ---------------- */

  /** app went to background (or is closing) → freeze the whole engine */
  pauseAll(): void {
    try { this.ctx?.suspend(); } catch { /* noop */ }
  }

  /** app back in foreground → continue seamlessly */
  resumeAll(): void {
    try { if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume(); } catch { /* noop */ }
  }

  /* ——— rendered studio tracks ——— */

  /** v2.4 — fetch + decode a track EARLY (e.g. menu theme during the
   * splash) so the first startMusic() starts instantly, no jank. */
  preloadTrack(name: string): void {
    void this.fetchTrack(name);
  }

  private async fetchTrack(name: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.trackCache.get(name);
    if (cached) {
      /* LRU refresh: re-insert so the newest track is the last entry */
      this.trackCache.delete(name);
      this.trackCache.set(name, cached);
      return cached;
    }
    try {
      const res = await fetch(`/assets/music/${name}.ogg`);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      this.trackCache.set(name, buf);
      /* v4 PERF: evict the OLDEST track that is neither playing nor
       * loading — the old unbounded cache grew ~10 MB per chapter visited
       * and eventually throttled weak phones (GC churn + heat). */
      while (this.trackCache.size > AudioEngine.TRACK_CACHE_MAX) {
        let victim: string | null = null;
        for (const k of this.trackCache.keys()) {
          if (k !== this.currentTrack && k !== this.loadingTrack) { victim = k; break; }
        }
        if (victim == null) break; /* everything protected — allow overflow */
        this.trackCache.delete(victim);
      }
      return buf;
    } catch (e) {
      console.warn(`[audio] track ${name} unavailable → live synth`, e);
      return null;
    }
  }

  private playTrack(name: string): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    if (this.currentTrack === name && this.trackSrc) return; // already playing
    this.currentTrack = name;
    const buf = this.trackCache.get(name);
    if (buf) { this.spawnSource(buf); return; }
    if (this.loadingTrack === name) return;
    this.loadingTrack = name;
    void this.fetchTrack(name).then((b) => {
      this.loadingTrack = null;
      // stale? (user already moved elsewhere)
      if (!b || this.currentTrack !== name || !this.ctx) return;
      this.spawnSource(b);
    });
  }

  private spawnSource(buf: AudioBuffer): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    // fade out whatever is playing (crossfade feel)
    const old = this.trackSrc, oldGain = this.trackGain;
    if (old && oldGain) {
      try {
        oldGain.gain.cancelScheduledValues(ctx.currentTime);
        oldGain.gain.setValueAtTime(oldGain.gain.value, ctx.currentTime);
        oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.9);
        old.stop(ctx.currentTime + 1.0);
      } catch { /* already stopped */ }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.musicBus);
    src.start(ctx.currentTime + 0.03);
    g.gain.linearRampToValueAtTime(this.musicOn ? 1 : 0, ctx.currentTime + 1.1);
    src.addEventListener("ended", () => {
      try { g.disconnect(); } catch { /* noop */ }
    });
    this.trackSrc = src;
    this.trackGain = g;
  }

  private stopTrack(immediate = false): void {
    this.currentTrack = null;
    this.loadingTrack = null;
    const ctx = this.ctx;
    const src = this.trackSrc, g = this.trackGain;
    this.trackSrc = null;
    this.trackGain = null;
    if (!src || !g || !ctx) return;
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + (immediate ? 0.12 : 0.7));
      src.stop(ctx.currentTime + (immediate ? 0.15 : 0.8));
    } catch { /* already stopped */ }
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

  private sfxNoise(opts: { dur: number; vol: number; freq: number; f1?: number; q?: number; delay?: number; type?: BiquadFilterType }): void {
    const ctx = this.ctx; if (!ctx || !this.sfxOn || !this.noiseBuf) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass"; f.frequency.setValueAtTime(opts.freq, t);
    if (opts.f1 != null) f.frequency.linearRampToValueAtTime(opts.f1, t + opts.dur);
    f.Q.value = opts.q ?? 1;
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

  /** v2.0 «پنبه‌ای» UI click — research pass: other hit games use a soft,
   * rounded, low-tension tap (felt/marimba family, ~-12dB transient).
   * The old glossy 2kHz tick read as “dry”; this one lands like a warm
   * wooden tap wrapped in felt — zero harshness, gentle low body. */
  sfxClick(): void {
    this.sfxNoise({ dur: 0.028, vol: 0.026, freq: 1900, q: 1.1 });                  // soft felt touch
    this.sfxOsc({ type: "triangle", f0: 520, f1: 385, dur: 0.075, vol: 0.11, filter: 2400 }); // woody body
    this.sfxOsc({ type: "sine", f0: 175, f1: 138, dur: 0.1, vol: 0.08 });           // warm low body
    this.sfxOsc({ type: "sine", f0: 1568, dur: 0.024, vol: 0.016, delay: 0.006 });  // whisper of gloss
  }

  /** v2.1 drag voice — «پخته» (mature) redesign.
   * The old C5 sine ladder read thin/childish (“beepy”). Top word games
   * sound like a real mallet instrument: LOW register, WOOD body, very
   * short decay, inharmonic partials, humanized detune. This is a full
   * kalimba/marimba physical model:
   *   • deep E4 pentatonic ladder → warm, never shrill
   *   • sine body with a gentle downward droop (wood warmth)
   *   • marimba's characteristic inharmonic partial (×2.76, fast decay)
   *   • soft triangle octave whisper for air
   *   • tiny wooden tap (low bandpass noise) instead of a synthetic click
   *   • ±0.4% random detune per hit → organic, alive */
  sfxLetter(idx: number): void {
    /* FF9 (user: «مطمئن شو تمام موزیک و صدا ها باعث لگ نشن»): the drag
     * catch can fire this on EVERY frame; each call spawns 5 nodes.
     * A 45ms min-gap caps the synth at ~22 voices/s — the ear cannot
     * tell the difference, the main thread (and GC) absolutely can. */
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      if (now - this._lastLetterAt < 0.045) return;
      this._lastLetterAt = now;
    }
    const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];   // major-pentatonic ladder
    const step = PENT[Math.min(Math.max(idx, 0), PENT.length - 1)];
    const det = 1 + (Math.random() * 0.008 - 0.004);        // humanize ±0.4%
    const f = 329.63 * Math.pow(2, step / 12) * det;        // E4 base — deep & warm
    /* Z — «روح‌دار»: a soft sub-octave shadow under the body gives the
     * tap a chest resonance (kalimba body feel) without any more top. */
    this.sfxOsc({ type: "sine", f0: f, f1: f * 0.982, dur: 0.17, vol: 0.15, curve: "lin", filter: 1900 }); // wooden body
    this.sfxOsc({ type: "sine", f0: f * 0.5, dur: 0.13, vol: 0.05, filter: 900 });                      // sub-octave chest
    this.sfxOsc({ type: "sine", f0: f * 2.76, dur: 0.055, vol: 0.026, filter: 5200 });  // marimba partial
    this.sfxOsc({ type: "triangle", f0: f * 2, dur: 0.05, vol: 0.028, delay: 0.004, filter: 3400 }); // airy octave
    this.sfxNoise({ dur: 0.03, vol: 0.02, freq: 1150, q: 1.3 });                        // wooden tap
  }

  sfxWordFound(step: number = 0): void {
    const roots = [523.25, 587.33, 659.25];
    const base = roots[step % 3];
    // rising chime cascade — C5 → E5 → G5 → C6 sparkle tail
    [1, 1.26, 1.5, 2].forEach((m, i) =>
      this.note(base * m, 0.24, 0.5, i * 0.07));
    this.sfxOsc({ type: "sine", f0: base * 4, dur: 0.35, vol: 0.07, delay: 0.3 });
    this.sfxNoise({ dur: 0.42, vol: 0.035, freq: 5600, q: 3, delay: 0.05 });
  }

  /** v2.1 — satisfying wooden landing for a word reaching the board:
   * a low mallet knock + a gentle two-note resolve (C5→E5) that feels
   * like the row gently “clicks” into place — warm, never harsh. */
  sfxSettle(): void {
    this.sfxOsc({ type: "sine", f0: 208, f1: 158, dur: 0.1, vol: 0.14, curve: "lin", filter: 900 });  // mallet knock
    this.sfxNoise({ dur: 0.045, vol: 0.02, freq: 950, q: 1.2 });                                       // felt contact
    this.note(523.25, 0.15, 0.3, 0.05);                                                                // C5
    this.note(659.25, 0.13, 0.36, 0.12);                                                               // E5
  }

  /** v1.21 — «یچی دلنواز باشه»: the hidden-word sting is now a WARM
   * kalimba discovery motif — a rising G4→D5→G5 wooden arpeggio with a
   * soft octave whisper and a gentle low shimmer tail. The old bright
   * 1kHz bell + wideband 6.6kHz sparkle read harsh on phone speakers. */
  sfxBonus(): void {
    const seq = [392, 587.33, 783.99];
    seq.forEach((f, i) => {
      this.sfxOsc({ type: "sine", f0: f, f1: f * 0.99, dur: 0.34, vol: 0.15, delay: i * 0.09, filter: 2000 });
      this.sfxOsc({ type: "triangle", f0: f * 2, dur: 0.12, vol: 0.032, delay: i * 0.09 + 0.012, filter: 3400 });
    });
    this.sfxOsc({ type: "sine", f0: 196, dur: 0.4, vol: 0.05, delay: 0.02, filter: 900 }); // warm low body
    this.sfxNoise({ dur: 0.5, vol: 0.018, freq: 4200, q: 2.2, delay: 0.22 }); // soft satin tail
  }

  sfxWrong(): void {
    // soft, low "uh-oh" — never harsh
    this.sfxOsc({ type: "sine", f0: 165, f1: 105, dur: 0.25, vol: 0.16 });
    this.sfxOsc({ type: "sine", f0: 82, dur: 0.22, vol: 0.12, delay: 0.02 });
  }

  sfxCoin(): void {
    /* v2.4 — warmer two-coin drop (glassy but soft, no 1.6kHz sting) */
    this.sfxOsc({ type: "sine", f0: 988, dur: 0.09, vol: 0.12, filter: 4200 });
    this.sfxOsc({ type: "sine", f0: 1319, dur: 0.18, vol: 0.12, delay: 0.055, filter: 5200 });
    this.sfxOsc({ type: "triangle", f0: 659, dur: 0.05, vol: 0.05, filter: 2400 });
  }

  sfxHint(): void {
    /* v2.4 — a soft "idea" bloom: warm rise + sparkle, never shrill */
    this.sfxOsc({ type: "sine", f0: 523, f1: 1175, dur: 0.42, vol: 0.11, curve: "exp", filter: 3600 });
    this.sfxOsc({ type: "triangle", f0: 1568, dur: 0.16, vol: 0.05, delay: 0.16, filter: 4400 });
    this.sfxNoise({ dur: 0.4, vol: 0.028, freq: 4600, q: 2.4, delay: 0.05 });
  }

  /** shimmer for a letter revealed into a word slot — Z: a warm
   * 3-note twinkle ladder + felt poof, the «راهنما» sound with a soul */
  sfxReveal(): void {
    this.note(784, 0.14, 0.3, 0);
    this.note(1046.5, 0.14, 0.34, 0.07);
    this.note(1318.5, 0.13, 0.45, 0.14);
    this.sfxNoise({ dur: 0.34, vol: 0.022, freq: 5200, q: 3.4, delay: 0.05 });
    this.sfxOsc({ type: "sine", f0: 262, dur: 0.22, vol: 0.05, filter: 800 }); // warm low body
  }

  /** v2.1 — soft airy WHOOSH + two wooden taps, matched to the FLIP
   * glide of the tiles (tiles fly ~0.46s; the whoosh covers them).
   * v1.21 — «یچی دلنواز نرم»: lower + rounder whoosh, a warm low
   * bloom under it, and the taps became muted felt pats — the whole
   * thing now breathes like a page turned in a storybook. */
  sfxShuffle(): void {
    this.sfxNoise({ dur: 0.32, vol: 0.03, freq: 520, f1: 1500, q: 0.7, type: "bandpass" });
    this.sfxOsc({ type: "sine", f0: 233, f1: 185, dur: 0.24, vol: 0.055, delay: 0.03, filter: 1100 }); // low bloom
    this.sfxNoise({ dur: 0.042, vol: 0.014, freq: 950, q: 1.1, delay: 0.2 });  // felt pat
    this.sfxNoise({ dur: 0.042, vol: 0.012, freq: 1150, q: 1.1, delay: 0.31 }); // felt pat
  }

  /* v2.4 — LEVEL-COMPLETE FANFARE, Z recomposition (user: «صدای جشن
   * ستاره شدن … باکیفیت و روح دار»): a fast golden RUSH (pentatonic
   * glissando) into the santur arpeggio, a soft synthesized crowd
   * underneath, and each star gets a glassy ding WITH its own sparkle
   * burst — a real celebration, still zero piercing tops. */
  sfxLevelComplete(stars: number): void {
    /* 1) rising rush into the fanfare (5 quick pentatonic steps) */
    [392, 440, 523.25, 587.33, 659.25].forEach((f, i) => {
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.16, vol: 0.075, delay: i * 0.045, filter: 3200 });
    });
    /* 2) warm santur-style arpeggio (C-G-A-C) */
    const seq = [523.25, 783.99, 880, 1046.5];
    seq.forEach((f, i) => {
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.5, vol: 0.2, delay: 0.26 + i * 0.13, filter: 3400 });
      this.sfxOsc({ type: "sine", f0: f * 2, dur: 0.3, vol: 0.06, delay: 0.26 + i * 0.13 + 0.02, filter: 6200 });
    });
    /* 3) soft crowd bed under the stars (human-ish clap flurry) */
    for (let i = 0; i < 10; i++) {
      this.sfxNoise({
        dur: 0.045, vol: 0.022 + (i % 3) * 0.006,
        freq: 1250 + (i % 4) * 380, q: 1.1, delay: 0.62 + ((i * 137) % 620) / 1000,
      });
    }
    /* 4) one gentle glassy ding PER STAR + sparkle tail */
    const starDing = [1046.5, 1318.5, 1568];
    for (let i = 0; i < Math.min(3, stars); i++) {
      const f = starDing[i];
      this.sfxOsc({ type: "sine", f0: f, dur: 0.55, vol: 0.14, delay: 0.98 + i * 0.24, filter: 5200 });
      this.sfxOsc({ type: "sine", f0: f * 2.76, dur: 0.1, vol: 0.02, delay: 0.98 + i * 0.24, filter: 8000 });
      this.sfxNoise({ dur: 0.3, vol: 0.018, freq: 5800, q: 3, delay: 1.0 + i * 0.24 });
    }
    this.sfxNoise({ dur: 0.8, vol: 0.03, freq: 6800, q: 3, delay: 1.0 });
  }

  sfxChapterUnlock(): void {
    /* v2.4 — warm golden fanfare (softer top, added low body) */
    const seq = [392, 523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.7, vol: 0.18, delay: i * 0.12, filter: 3600 });
    });
    this.sfxOsc({ type: "sine", f0: 196, dur: 0.9, vol: 0.1, delay: 0.1, filter: 1200 });
    this.sfxNoise({ dur: 1.2, vol: 0.036, freq: 5000, q: 2, delay: 0.4 });
  }

  sfxPropAppear(): void {
    this.sfxOsc({ type: "sine", f0: 740, f1: 1245, dur: 0.26, vol: 0.09, filter: 3200 });
    this.sfxNoise({ dur: 0.3, vol: 0.03, freq: 5400, q: 5, delay: 0.03 });
  }

  /** v2.4 — star pop (win modal) — a soft glassy "tink" with a felt
   * attack, tuned DOWN from the old piercing 1318 lead */
  sfxStar(): void {
    this.sfxOsc({ type: "sine", f0: 988, dur: 0.4, vol: 0.16, filter: 4800 });
    this.sfxOsc({ type: "sine", f0: 1976, dur: 0.12, vol: 0.035, delay: 0.02, filter: 7600 });
    this.sfxNoise({ dur: 0.05, vol: 0.016, freq: 2200, q: 1.4 });
  }

  /** v2.4 — party finale: a short festive 6/8 riff + daf burst */
  sfxPartyEnd(): void {
    const riff = [587.33, 783.99, 880, 1046.5, 1174.66, 1568];
    riff.forEach((f, i) => {
      this.sfxOsc({ type: "triangle", f0: f, dur: 0.42, vol: 0.16, delay: i * 0.11, filter: 3800 });
    });
    for (let i = 0; i < 6; i++) this.dafJingle(0.55 + i * 0.07, 0.05);
    this.sfxOsc({ type: "sine", f0: 294, dur: 0.8, vol: 0.1, delay: 0.05, filter: 1400 });
    this.sfxNoise({ dur: 1.1, vol: 0.045, freq: 6200, q: 2.4, delay: 0.5 });
  }

  /** low boom for fireworks/finale */
  sfxBoom(): void {
    this.sfxOsc({ type: "sine", f0: 200, f1: 44, dur: 0.55, vol: 0.34 });
    this.sfxNoise({ dur: 0.75, vol: 0.1, freq: 850, q: 0.6, type: "lowpass" });
    this.sfxNoise({ dur: 0.95, vol: 0.05, freq: 5800, q: 2, delay: 0.05 });
  }

  /** v1.19 — chapter-complete CELEBRATION (user: «با تشویق جشن گرفته
   * بشه»): a warm synthesized crowd APPLAUSE — a flurry of soft claps
   * with human-ish timing — plus a rising swell and two bright hooray
   * chirps. Pure WebAudio, nothing to load. */
  sfxCheer(): void {
    if (!this.ctx || !this.sfxOn) return;
    /* ~18 claps spread over ~1.15s (deterministic human-ish jitter) */
    for (let i = 0; i < 18; i++) {
      const t = ((i * 173) % 1100) / 1000;
      this.sfxNoise({
        dur: 0.05,
        vol: 0.042 + (i % 3) * 0.011,
        freq: 1350 + (i % 5) * 430 + (i % 7) * 90,
        q: 1.05,
        delay: t,
        type: "bandpass",
      });
    }
    /* rising crowd swell underneath */
    this.sfxNoise({ dur: 1.5, vol: 0.045, freq: 950, q: 0.7, delay: 0.04, type: "lowpass" });
    /* two bright hooray chirps */
    this.sfxOsc({ type: "triangle", f0: 620, f1: 990, dur: 0.32, vol: 0.085, delay: 0.34, filter: 2600 });
    this.sfxOsc({ type: "triangle", f0: 770, f1: 1190, dur: 0.42, vol: 0.075, delay: 0.68, filter: 3000 });
  }

  /* ---------------- Z additions (باکیفیت و روح‌دار) ---------------- */

  /** Z — chapter-1 PRAISE chirp for the coach bubble: a tiny kalimba
   * «آفرین» — two quick wooden notes + a soft low body. Warm, proud,
   * never shrill. */
  sfxPraise(): void {
    this.sfxOsc({ type: "sine", f0: 659.25, f1: 650, dur: 0.14, vol: 0.13, filter: 2200 });
    this.sfxOsc({ type: "sine", f0: 987.77, f1: 972, dur: 0.2, vol: 0.11, delay: 0.09, filter: 2600 });
    this.sfxOsc({ type: "sine", f0: 329.63, dur: 0.24, vol: 0.05, filter: 1000 });
    this.sfxNoise({ dur: 0.04, vol: 0.014, freq: 1200, q: 1.2 });
  }

  /** Z — HIDDEN-WORD TAKEOFF: a soft golden whoosh that lifts with the
   * flying chip (rising filtered noise + a shy shimmer); the coin
   * chime fires when the chip lands in the profile. */
  sfxFlyUp(): void {
    this.sfxNoise({ dur: 0.55, vol: 0.03, freq: 700, f1: 2600, q: 1.4, type: "bandpass" });
    this.sfxOsc({ type: "sine", f0: 523.25, f1: 1046.5, dur: 0.5, vol: 0.06, curve: "exp", filter: 3200 });
    this.sfxOsc({ type: "triangle", f0: 1568, dur: 0.14, vol: 0.03, delay: 0.4, filter: 4400 });
  }
}

export const Audio = new AudioEngine();
