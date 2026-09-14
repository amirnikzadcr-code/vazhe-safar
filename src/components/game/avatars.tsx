"use client";
/* ------------------------------------------------------------------
 * avatars.tsx — 8 hand-drawn SVG cartoon avatars (zero image files →
 * instant render, crisp on every DPI, no loading delay).
 * Used by: profile editor, name-ask modal, PlayerHud, party players.
 * ------------------------------------------------------------------ */

export interface AvatarDef { id: string; label: string; ring: string }

export const AVATARS: AvatarDef[] = [
  { id: "cat",   label: "گربه",   ring: "#ff9f43" },
  { id: "fox",   label: "روباه",  ring: "#e8632c" },
  { id: "panda", label: "پاندا",  ring: "#4a4a58" },
  { id: "frog",  label: "قورباغه", ring: "#3fae5c" },
  { id: "owl",   label: "جغد",    ring: "#8a6a45" },
  { id: "lion",  label: "شیر",    ring: "#f0a92c" },
  { id: "bunny", label: "خرگوش",  ring: "#b8b8c8" },
  { id: "bear",  label: "خرس",    ring: "#a06a30" },
];

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** the face itself — circular, cute, flat-storybook style */
export function AvatarFace({ id, size = 44 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ display: "block" }}>
      <clipPath id={`avc-${id}`}><circle cx="32" cy="32" r="31" /></clipPath>
      <g clipPath={`url(#avc-${id})`}>
        <rect width="64" height="64" fill="#fdf3dd" />
        {id === "cat" && <g>
          <path d="M12 22 L18 6 L28 16 Z" fill="#f5913c" /><path d="M52 22 L46 6 L36 16 Z" fill="#f5913c" />
          <path d="M15 19 L18 10 L24 16 Z" fill="#ffd2a8" /><path d="M49 19 L46 10 L40 16 Z" fill="#ffd2a8" />
          <circle cx="32" cy="36" r="24" fill="#f5913c" />
          <path d="M10 30 q6 -4 10 2 M44 30 q6 -4 10 2" stroke="#d9772a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <circle cx="23" cy="33" r="3.4" fill="#3a2415" /><circle cx="41" cy="33" r="3.4" fill="#3a2415" />
          <circle cx="24.2" cy="31.8" r="1.1" fill="#fff" /><circle cx="42.2" cy="31.8" r="1.1" fill="#fff" />
          <path d="M30 41 h4 l-2 3 Z" fill="#e25c5c" />
          <path d="M32 44 q-5 5 -9 1 M32 44 q5 5 9 1" stroke="#3a2415" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="38.6" rx="2.6" ry="1.9" fill="#ff9d9d" />
        </g>}
        {id === "fox" && <g>
          <path d="M10 24 L14 5 L27 15 Z" fill="#e8632c" /><path d="M54 24 L50 5 L37 15 Z" fill="#e8632c" />
          <path d="M13 20 L15.5 9.5 L23 15.5 Z" fill="#3a2415" /><path d="M51 20 L48.5 9.5 L41 15.5 Z" fill="#3a2415" />
          <circle cx="32" cy="36" r="24" fill="#e8632c" />
          <path d="M32 60 Q14 56 12 42 Q20 46 32 46 Q44 46 52 42 Q50 56 32 60 Z" fill="#fff4e6" />
          <circle cx="23" cy="32" r="3.2" fill="#2b1a10" /><circle cx="41" cy="32" r="3.2" fill="#2b1a10" />
          <circle cx="24.1" cy="30.9" r="1" fill="#fff" /><circle cx="42.1" cy="30.9" r="1" fill="#fff" />
          <ellipse cx="32" cy="40" rx="2.8" ry="2.1" fill="#3a2415" />
          <path d="M32 42 q-4.5 4.5 -8 .8 M32 42 q4.5 4.5 8 .8" stroke="#3a2415" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        </g>}
        {id === "panda" && <g>
          <circle cx="13" cy="15" r="9.5" fill="#3d3f4a" /><circle cx="51" cy="15" r="9.5" fill="#3d3f4a" />
          <circle cx="32" cy="35" r="24" fill="#ffffff" />
          <ellipse cx="22" cy="32" rx="6.4" ry="7.6" fill="#3d3f4a" transform="rotate(-16 22 32)" />
          <ellipse cx="42" cy="32" rx="6.4" ry="7.6" fill="#3d3f4a" transform="rotate(16 42 32)" />
          <circle cx="22.6" cy="32.6" r="2.6" fill="#fff" /><circle cx="41.4" cy="32.6" r="2.6" fill="#fff" />
          <circle cx="22.6" cy="32.6" r="1.25" fill="#16161c" /><circle cx="41.4" cy="32.6" r="1.25" fill="#16161c" />
          <ellipse cx="32" cy="42" rx="2.6" ry="1.9" fill="#3d3f4a" />
          <path d="M32 44 q-4.6 4.4 -8.4 .6 M32 44 q4.6 4.4 8.4 .6" stroke="#3d3f4a" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        </g>}
        {id === "frog" && <g>
          <circle cx="17" cy="14" r="8.5" fill="#57c878" /><circle cx="47" cy="14" r="8.5" fill="#57c878" />
          <circle cx="17" cy="14" r="4" fill="#fff" /><circle cx="47" cy="14" r="4" fill="#fff" />
          <circle cx="17" cy="14.6" r="2" fill="#233" /><circle cx="47" cy="14.6" r="2" fill="#233" />
          <circle cx="32" cy="38" r="23" fill="#57c878" />
          <path d="M9 34 q23 10 46 0 l0 27 -46 0 Z" fill="#c8f2d2" />
          <circle cx="23" cy="33" r="3" fill="#233" /><circle cx="41" cy="33" r="3" fill="#233" />
          <circle cx="24" cy="32" r="1" fill="#fff" /><circle cx="42" cy="32" r="1" fill="#fff" />
          <path d="M20 43 q12 9 24 0" stroke="#2c7a44" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="42" r="3.2" fill="#ff9d9d" opacity=".75" /><circle cx="50" cy="42" r="3.2" fill="#ff9d9d" opacity=".75" />
        </g>}
        {id === "owl" && <g>
          <path d="M12 16 L20 6 L26 16 Z" fill="#8a6a45" /><path d="M52 16 L44 6 L38 16 Z" fill="#8a6a45" />
          <circle cx="32" cy="34" r="24" fill="#a8845c" />
          <path d="M32 58 Q16 52 14 40 Q24 46 32 46 Q40 46 50 40 Q48 52 32 58 Z" fill="#c9a878" />
          <circle cx="22.5" cy="31" r="9" fill="#fdf3dd" /><circle cx="41.5" cy="31" r="9" fill="#fdf3dd" />
          <circle cx="22.5" cy="31" r="4.2" fill="#3a2415" /><circle cx="41.5" cy="31" r="4.2" fill="#3a2415" />
          <circle cx="24" cy="29.6" r="1.4" fill="#fff" /><circle cx="43" cy="29.6" r="1.4" fill="#fff" />
          <path d="M28.5 39 h7 l-3.5 6 Z" fill="#f0a92c" />
          <path d="M18 20 q4 3 8 0 M38 20 q4 3 8 0" stroke="#8a6a45" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>}
        {id === "lion" && <g>
          <circle cx="32" cy="34" r="26" fill="#e8973c" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={32 + Math.cos(a) * 25} cy={34 + Math.sin(a) * 25} r="6.2" fill="#d97f24" />;
          })}
          <circle cx="32" cy="35" r="18.5" fill="#ffcf7e" />
          <circle cx="25" cy="32" r="2.9" fill="#4a2c10" /><circle cx="39" cy="32" r="2.9" fill="#4a2c10" />
          <circle cx="26" cy="31" r="1" fill="#fff" /><circle cx="40" cy="31" r="1" fill="#fff" />
          <path d="M30.6 38.6 h2.8 l-1.4 2.6 Z" fill="#8a5514" />
          <path d="M32 41 q-4 4 -7.4 .6 M32 41 q4 4 7.4 .6" stroke="#8a5514" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          <ellipse cx="19" cy="38" r="2.8" fill="#ffb1b1" opacity=".7" /><ellipse cx="45" cy="38" r="2.8" fill="#ffb1b1" opacity=".7" />
        </g>}
        {id === "bunny" && <g>
          <ellipse cx="21" cy="12" rx="6.5" ry="14" fill="#dfe3ee" transform="rotate(-10 21 12)" />
          <ellipse cx="43" cy="12" rx="6.5" ry="14" fill="#dfe3ee" transform="rotate(10 43 12)" />
          <ellipse cx="21.4" cy="13" rx="3.2" ry="10" fill="#ffb9c8" transform="rotate(-10 21.4 13)" />
          <ellipse cx="42.6" cy="13" rx="3.2" ry="10" fill="#ffb9c8" transform="rotate(10 42.6 13)" />
          <circle cx="32" cy="38" r="22" fill="#eef1f8" />
          <circle cx="24" cy="35" r="3" fill="#3a3040" /><circle cx="40" cy="35" r="3" fill="#3a3040" />
          <circle cx="25" cy="34" r="1" fill="#fff" /><circle cx="41" cy="34" r="1" fill="#fff" />
          <path d="M30.6 41.4 h2.8 l-1.4 2.4 Z" fill="#ff7d9c" />
          <path d="M32 44 q-4.4 4.4 -8 .6 M32 44 q4.4 4.4 8 .6" stroke="#3a3040" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          <ellipse cx="16.5" cy="41" r="3" fill="#ffb9c8" opacity=".8" /><ellipse cx="47.5" cy="41" r="3" fill="#ffb9c8" opacity=".8" />
        </g>}
        {id === "bear" && <g>
          <circle cx="14" cy="14" r="9" fill="#8a5a2e" /><circle cx="50" cy="14" r="9" fill="#8a5a2e" />
          <circle cx="14" cy="14" r="4.2" fill="#c9955c" /><circle cx="50" cy="14" r="4.2" fill="#c9955c" />
          <circle cx="32" cy="36" r="23" fill="#a06a38" />
          <circle cx="32" cy="42" r="10" fill="#e2b57c" />
          <circle cx="24" cy="32" r="3.1" fill="#33210f" /><circle cx="40" cy="32" r="3.1" fill="#33210f" />
          <circle cx="25" cy="31" r="1" fill="#fff" /><circle cx="41" cy="31" r="1" fill="#fff" />
          <ellipse cx="32" cy="40" rx="3" ry="2.3" fill="#4a2f14" />
          <path d="M32 42.4 q-4.2 4 -7.6 .4 M32 42.4 q4.2 4 7.6 .4" stroke="#4a2f14" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        </g>}
      </g>
      <circle cx="32" cy="32" r="30.4" fill="none" stroke="rgba(255,255,255,.95)" strokeWidth="3" />
    </svg>
  );
}
