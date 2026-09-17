/* ------------------------------------------------------------------
 *  واژه‌سفر — fx/particles.ts
 *  Single-canvas particle engine. Ambient emitters set the mood of each
 *  chapter; burst emitters celebrate found words, coins and finales.
 * ------------------------------------------------------------------ */

export type PShape =
  | "petal" | "dot" | "star" | "leaf" | "flake"
  | "spark" | "confetti" | "streak" | "bubble" | "glow" | "ribbon";

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  shape: PShape;
  rot: number; vr: number;
  g: number;          // gravity px/s^2
  drag: number;       // velocity damping /s
  tw: number;         // twinkle phase (rad) — 0 = no twinkle
  alpha: number;
}

export type AmbientKind =
  | "petals" | "dust" | "sand" | "fireflies" | "snow"
  | "seasparkle" | "leaves" | "stars" | "gold" | "mist" | "none";

const AMBIENT_COLORS: Record<AmbientKind, string[]> = {
  petals:   ["#ffd7e2", "#ffb3c6", "#ffe9f0", "#f8a5b8"],
  dust:     ["#ffe9c4", "#ffd28a", "#fff4dd", "#e8b96f"],
  sand:     ["#f0d9a8", "#e2b878", "#d9a45f", "#f7e6c4"],
  fireflies:["#d4ff8f", "#eaffb0", "#b8e96b", "#fff8c2"],
  snow:     ["#ffffff", "#eaf4ff", "#d8e9fb", "#f6fbff"],
  seasparkle:["#d8fbff", "#a8f0ff", "#ffffff", "#bff7ec"],
  leaves:   ["#9fd48a", "#c8e6a0", "#7ab86b", "#e4f0c8"],
  stars:    ["#ffffff", "#ffe9a8", "#cfe6ff", "#ffd7f0"],
  gold:     ["#ffe9a8", "#ffd76e", "#fff6d8", "#f2c14e"],
  mist:     ["#dfe9e4", "#c8d8d0", "#eef4f0", "#b8ccc2"],
  none:     [],
};

export class ParticleFX {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;
  private w = 0; private hgt = 0;
  private dpr = 1;
  private ambient: AmbientKind = "none";
  private ambientAcc = 0;
  private ambientRate = 0;   // particles/sec
  private intensity = 1;     // multiplier (reduce on weak devices)
  private paused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.resize();
    this.detectPerformance();
  }

  private detectPerformance(): void {
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    this.intensity = mem <= 2 || cores <= 2 ? 0.55 : 1;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width; this.hgt = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* ---------------- control ---------------- */

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      if (this.paused) return;
      this.tick(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.parts.length = 0;
  }

  setPaused(p: boolean): void { this.paused = p; }

  setAmbient(kind: AmbientKind, rate?: number): void {
    this.ambient = kind;
    this.parts.length = 0;
    const base: Record<string, number> = {
      petals: 5, dust: 7, sand: 9, fireflies: 6, snow: 10,
      seasparkle: 8, leaves: 4, stars: 7, gold: 6, mist: 3, none: 0,
    };
    this.ambientRate = (rate ?? base[kind] ?? 5) * this.intensity;
  }

  /* ---------------- spawners ---------------- */

  private spawnAmbient(): void {
    const w = this.w, h = this.hgt;
    const col = AMBIENT_COLORS[this.ambient];
    if (!col.length) return;
    const pick = col[Math.floor(Math.random() * col.length)];
    const R = Math.random;
    switch (this.ambient) {
      case "petals":
        this.add({ x: R() * w, y: -10, vx: (R() - 0.3) * 22, vy: 26 + R() * 22, size: 5 + R() * 5,
          color: pick, shape: "petal", life: 14, g: 3, drag: 0.12, tw: R() * 6, vr: (R() - .5) * 3 });
        break;
      case "dust":
        this.add({ x: R() * w, y: h * (0.25 + R() * 0.75), vx: (R() - .5) * 14, vy: -6 - R() * 10,
          size: 1.5 + R() * 2.5, color: pick, shape: "dot", life: 6 + R() * 4, g: -1, drag: 0.2, tw: R() * 6, alpha: 0.5 });
        break;
      case "sand":
        this.add({ x: -10, y: h * (0.45 + R() * 0.5), vx: 60 + R() * 80, vy: (R() - .4) * 8,
          size: 1 + R() * 2, color: pick, shape: "streak", life: 5 + R() * 3, g: 0, drag: 0.02, tw: 0 });
        break;
      case "fireflies":
        this.add({ x: R() * w, y: h * (0.2 + R() * 0.7), vx: (R() - .5) * 18, vy: (R() - .5) * 14,
          size: 2 + R() * 2.5, color: pick, shape: "glow", life: 8 + R() * 6, g: 0, drag: 0.4, tw: R() * 6.28 });
        break;
      case "snow":
        this.add({ x: R() * w, y: -8, vx: (R() - .5) * 16, vy: 22 + R() * 26,
          size: 2 + R() * 3, color: pick, shape: "flake", life: 16, g: 2, drag: 0.05, tw: R() * 6 });
        break;
      case "seasparkle":
        this.add({ x: R() * w, y: h * (0.55 + R() * 0.45), vx: (R() - .5) * 8, vy: (R() - .5) * 6,
          size: 1.5 + R() * 2, color: pick, shape: "spark", life: 3 + R() * 3, g: 0, drag: 0.3, tw: R() * 6.28 });
        break;
      case "leaves":
        this.add({ x: R() * w, y: -10, vx: (R() - .5) * 30, vy: 30 + R() * 20,
          size: 5 + R() * 5, color: pick, shape: "leaf", life: 15, g: 4, drag: 0.1, tw: R() * 6, vr: (R() - .5) * 4 });
        break;
      case "stars":
        // static-ish twinkling stars born in upper sky
        this.add({ x: R() * w, y: h * R() * 0.55, vx: 0, vy: 0, size: 1 + R() * 2.2,
          color: pick, shape: "star", life: 6 + R() * 8, g: 0, drag: 0, tw: R() * 6.28 });
        break;
      case "gold":
        this.add({ x: R() * w, y: h * (0.1 + R() * 0.85), vx: (R() - .5) * 10, vy: -8 - R() * 10,
          size: 1.5 + R() * 2.5, color: pick, shape: "spark", life: 5 + R() * 4, g: -2, drag: 0.2, tw: R() * 6.28 });
        break;
      case "mist":
        this.add({ x: R() * w, y: h * (0.3 + R() * 0.6), vx: 14 + R() * 10, vy: (R() - .5) * 4,
          size: 24 + R() * 30, color: pick, shape: "bubble", life: 9 + R() * 4, g: 0, drag: 0.05, tw: 0, alpha: 0.08 });
        break;
    }
  }

  private add(p: Partial<Particle> & { x: number; y: number; color: string; shape: PShape }): void {
    if (this.parts.length > 420 * this.intensity) return;
    this.parts.push({
      vx: 0, vy: 0, life: 5, maxLife: p.life ?? 5, size: 3, rot: 0, vr: 0,
      g: 0, drag: 0, tw: 0, alpha: 1, ...p,
    } as Particle);
  }

  /* ---------------- bursts ---------------- */

  /** radial burst at x,y — used when a word is found / prop appears */
  burst(x: number, y: number, color = "#ffd76e", count = 26, shape: PShape = "spark"): void {
    const n = Math.round(count * this.intensity);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 190;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        size: 2 + Math.random() * 3.5, color, shape,
        life: 0.7 + Math.random() * 0.8, g: 320, drag: 1.6,
        tw: Math.random() * 6.28, vr: (Math.random() - .5) * 8,
      });
    }
  }

  coinTrail(x: number, y: number): void {
    for (let i = 0; i < 10 * this.intensity; i++)
      this.add({
        x: x + (Math.random() - .5) * 30, y, vx: (Math.random() - .5) * 60, vy: -120 - Math.random() * 80,
        size: 2.5 + Math.random() * 2, color: Math.random() < .5 ? "#ffd76e" : "#fff3c4", shape: "glow",
        life: 0.9 + Math.random() * 0.5, g: 260, drag: 0.8, tw: Math.random() * 6.28,
      });
  }

  confetti(count = 90): void {
    const colors = ["#ffd76e", "#ff8fa3", "#7adcb0", "#8ecdf7", "#e6a8f7", "#fff3c4", "#f2c14e"];
    const n = Math.round(count * this.intensity);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * this.w;
      // v1.3: rich mix — ribbons, classic strips and little stars
      const shape: PShape = i % 3 === 0 ? "ribbon" : i % 5 === 0 ? "star" : "confetti";
      this.add({
        x, y: -12 - Math.random() * this.hgt * 0.25,
        vx: (Math.random() - .5) * 90, vy: 60 + Math.random() * 140,
        size: shape === "ribbon" ? 9 + Math.random() * 7 : 4 + Math.random() * 5,
        color: colors[i % colors.length], shape,
        life: 4.5 + Math.random() * 2, g: shape === "ribbon" ? 55 : 90, drag: 0.12,
        tw: Math.random() * 6.28, vr: (Math.random() - .5) * 10,
      });
    }
  }

  /** expanding ring of golden stars — word-found celebration (v1.3) */
  starRing(x: number, y: number, color = "#ffe9a8"): void {
    const n = Math.round(12 * this.intensity);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({
        x, y,
        vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
        size: 2.4 + Math.random() * 1.6, color: i % 3 === 0 ? "#fff6d8" : color,
        shape: "star", life: 0.8 + Math.random() * 0.35, g: 60, drag: 2.4,
        tw: Math.random() * 6.28, vr: (Math.random() - .5) * 6,
      });
    }
    // soft golden flash at the center
    this.add({
      x, y, vx: 0, vy: 0, size: 16, color: "rgba(255,233,168,0.85)",
      shape: "glow", life: 0.5, g: 0, drag: 0, tw: 0,
    });
  }

  /** multi-shot fireworks — chapter finale */
  fireworks(shots = 5): void {
    const palette = ["#ffd76e", "#ff8fa3", "#7adcb0", "#8ecdf7", "#e6a8f7", "#ffffff"];
    for (let s = 0; s < shots * this.intensity; s++) {
      const x = this.w * (0.15 + Math.random() * 0.7);
      const y = this.hgt * (0.12 + Math.random() * 0.35);
      const color = palette[Math.floor(Math.random() * palette.length)];
      const delay = s * 420;
      setTimeout(() => {
        if (!this.raf) return;
        const n = Math.round(46 * this.intensity);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
          const sp = 110 + Math.random() * 160;
          this.add({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: 2 + Math.random() * 2.5, color: Math.random() < 0.7 ? color : "#ffffff",
            shape: "spark", life: 1.1 + Math.random() * 0.7, g: 130, drag: 0.9, tw: Math.random() * 6.28,
          });
        }
        Audio_cue.firework();
      }, delay);
    }
  }

  /* ---------------- tick & draw ---------------- */

  private tick(dt: number): void {
    // ambient spawning
    if (this.ambient !== "none" && this.ambientRate > 0) {
      this.ambientAcc += dt * this.ambientRate;
      while (this.ambientAcc >= 1) { this.spawnAmbient(); this.ambientAcc -= 1; }
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.hgt);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > this.hgt + 60) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      this.draw(ctx, p);
    }
  }

  private draw(ctx: CanvasRenderingContext2D, p: Particle): void {
    const lifeT = p.life / p.maxLife;
    let a = p.alpha * Math.min(1, lifeT * 2.2);
    if (p.tw) a *= 0.55 + 0.45 * Math.sin(p.tw + performance.now() / 300);
    a = Math.max(0, Math.min(1, a));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const s = p.size;
    // v1.3: luminous shapes render additively — glow actually glows
    const luminous = p.shape === "glow" || p.shape === "spark" || p.shape === "star";
    if (luminous) ctx.globalCompositeOperation = "lighter";
    switch (p.shape) {
      case "petal": {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); break;
      }
      case "leaf": {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.8, s, 0); ctx.quadraticCurveTo(0, s * 0.8, -s, 0);
        ctx.fill(); ctx.restore(); break;
      }
      case "star": {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + p.rot;
          ctx.lineTo(Math.cos(ang) * s * 2.2, Math.sin(ang) * s * 2.2);
          ctx.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.7, Math.sin(ang + Math.PI / 4) * s * 0.7);
        }
        ctx.closePath(); ctx.fill(); ctx.restore(); break;
      }
      case "flake": {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha *= 0.9;
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(ang) * s, -Math.sin(ang) * s);
          ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
          ctx.lineWidth = 1; ctx.strokeStyle = p.color; ctx.stroke();
        }
        ctx.restore(); break;
      }
      case "streak": {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 2.4, s * 0.55, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
        ctx.fill(); ctx.restore(); break;
      }
      case "glow": {
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3);
        gr.addColorStop(0, p.color); gr.addColorStop(1, "transparent");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "confetti": {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); break;
      }
      case "ribbon": {
        // waving satin strip — folds over itself while falling
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const wave = Math.sin(performance.now() / 160 + p.tw) * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(-s / 2, wave);
        ctx.quadraticCurveTo(0, -wave, s / 2, wave);
        ctx.lineTo(s / 2, wave + s * 0.34);
        ctx.quadraticCurveTo(0, -wave + s * 0.34, -s / 2, wave + s * 0.34);
        ctx.closePath();
        ctx.fill();
        ctx.restore(); break;
      }
      case "bubble": {
        ctx.globalAlpha *= 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill(); break;
      }
      default: { // dot, spark
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (luminous) ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

/** tiny decoupled sound cue hook (set by engine to avoid import cycles) */
export const Audio_cue = {
  firework: () => { /* replaced at runtime */ },
};
