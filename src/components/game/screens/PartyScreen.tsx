"use client";
/* ------------------------------------------------------------------
 * PartyScreen — «بازی دورهمی» (v2.3, user request)
 * A creative pass-and-play party mode for 2..6 friends on ONE phone:
 *   1. SETUP      → pick player count + names + avatars + rounds
 *   2. HANDOFF    → big «نوبتِ …» card (auto-advances, tap to skip)
 *   3. TURN       → 40s timer ring; tap wheel letters to build words;
 *                   every real word scores  (length + SPEED bonus +
 *                   streak bonus) ×2 on the golden turn
 *   4. FINAL      → confetti podium, medals, rematch buttons
 * Design: warm wooden party look, all static CSS (zero idle anims),
 * SVG-only avatars → nothing extra to load. Fully RTL.
 * ------------------------------------------------------------------ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/game/ui/kit";
import { AVATARS, AvatarFace } from "@/components/game/avatars";
import { LEVELS, isRealWord } from "@/game/data/levelsIndex";
import { DICT_WORDS } from "@/game/data/dictionary";
import { letters, faNum, canBuild, buzz } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { Save } from "@/game/core/save";

const TURN_MS = 40_000;
const MAX_LEN_BONUS_MULT = 1;    // kept for clarity
type Phase = "setup" | "handoff" | "turn" | "final";

interface PConf { name: string; avatar: string }
interface PState { name: string; avatar: string; score: number; streak: number }

/* ---------------- helpers ---------------- */

/** pick a random unused level wheel (letters + valid word set) */
function pickWheel(used: Set<string>): { key: string; ls: string[]; words: Set<string> } {
  for (let t = 0; t < 60; t++) {
    const c = Math.floor(Math.random() * 10);
    const list = LEVELS[c];
    const i = Math.floor(Math.random() * list.length);
    const key = `${c}:${i}`;
    if (used.has(key)) continue;
    used.add(key);
    const lv = list[i];
    return { key, ls: letters(lv.wheel), words: new Set([...lv.words, ...lv.bonus]) };
  }
  const lv = LEVELS[0][0];
  return { key: "0:0", ls: letters(lv.wheel), words: new Set(lv.words) };
}

const scoreWord = (len: number, speedSec: number, streak: number, golden: boolean) => {
  const base = len * 10 + Math.max(0, speedSec) * 2 + Math.max(0, streak) * 10;
  return base * (golden ? 2 : 1) * MAX_LEN_BONUS_MULT;
};

/* ---------------- countdown ring (own state → parent never re-renders) ---------------- */
function TurnTimer({ ms, onEnd }: { ms: number; onEnd: () => void }) {
  const C = 2 * Math.PI * 26;
  const [run, setRun] = useState(false);
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  const leftRef = useRef(left);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const rem = Math.max(0, ms - (Date.now() - t0));
      const s = Math.ceil(rem / 1000);
      if (s !== leftRef.current) {
        leftRef.current = s;
        setLeft(s);
        if (s <= 3 && s > 0) Audio.sfxLetter(2); /* gentle final ticks */
      }
      if (rem <= 0) { clearInterval(id); endRef.current(); }
    }, 200);
    const raf = requestAnimationFrame(() => setRun(true)); /* arm the ring transition */
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  }, [ms]);
  const low = left <= 5;
  return (
    <div className={`pt-timer ${low ? "low" : ""}`} aria-label={`${faNum(left)} ثانیه`}>
      <svg width="66" height="66" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(74,44,14,.35)" strokeWidth="6" />
        <circle
          className="pt-ring"
          cx="32" cy="32" r="26" fill="none"
          stroke={low ? "#ff5b5b" : "#ffd76e"} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={run ? C : 0}
          transform="rotate(-90 32 32)"
          style={{ transition: `stroke-dashoffset ${ms}ms linear` }}
        />
      </svg>
      <b>{faNum(left)}</b>
    </div>
  );
}

/* ================= SETUP ================= */
function Setup({ onStart, onExit }: { onStart: (ps: PConf[], rounds: number) => void; onExit: () => void }) {
  const [count, setCount] = useState(3);
  const [rounds, setRounds] = useState(3);
  const [conf, setConf] = useState<PConf[]>(
    AVATARS.slice(0, 6).map((a, i) => ({ name: "", avatar: a.id })) /* fixed pool, index = default avatar */
  );

  const cycleAvatar = (i: number) => {
    Audio.sfxClick();
    setConf((cs) => {
      const used = new Set(cs.filter((_, j) => j !== i).map((c) => c.avatar));
      const order = [...AVATARS, ...AVATARS];
      const cur = order.findIndex((a) => a.id === cs[i].avatar);
      for (let k = cur + 1; k < order.length; k++) {
        if (!used.has(order[k].id)) {
          const next = [...cs];
          next[i] = { ...next[i], avatar: order[k].id };
          return next;
        }
      }
      return cs;
    });
  };

  return (
    <Sheet bg="/assets/bg/map2.webp" bgDim={0.3} blur={2}>
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="بازگشت" onClick={onExit}>✕</button>
        <div className="sheet-title" style={{ fontSize: 16, padding: "7px 22px" }}>بازی دورهمی</div>
        <span style={{ width: 40 }} />
      </div>

      <div className="scrolly">
        <div className="panel rise-in" style={{ borderRadius: 22, padding: 14 }}>
          <p className="ps-desc">
            دورهمی واژه‌ها! هر بازیکن در نوبتش باید تا پایانِ زمان واژه‌های واقعی بسازد؛
            هرچه سریع‌تر، امتیاز بیشتر! واژه‌های بلندتر و نوبت‌های پشت‌سرهم پاداش دارند
            و «چرخِ طلایی» امتیاز را دو برابر می‌کند.
          </p>

          <div className="ps-row-label">چند نفرید؟</div>
          <div className="ps-chips">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n} type="button"
                className={`ps-chip ${count === n ? "sel" : ""}`}
                onClick={() => { Audio.sfxClick(); setCount(n); }}
              >{faNum(n)} نفر</button>
            ))}
          </div>

          <div className="ps-row-label">بازیکن‌ها</div>
          <div className="ps-players">
            {conf.slice(0, count).map((c, i) => (
              <div key={i} className="ps-player">
                <button type="button" className="ps-pavatar" onClick={() => cycleAvatar(i)} aria-label="تغییر آواتار">
                  <AvatarFace id={c.avatar} size={44} />
                </button>
                <input
                  className="name-input"
                  style={{ flex: 1, margin: 0 }}
                  value={c.name}
                  maxLength={12}
                  placeholder={`بازیکن ${faNum(i + 1)}`}
                  onChange={(e) => setConf((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  aria-label={`اسم بازیکن ${faNum(i + 1)}`}
                />
              </div>
            ))}
          </div>

          <div className="ps-row-label">چند دور؟</div>
          <div className="ps-chips">
            {[3, 5, 7].map((r) => (
              <button
                key={r} type="button"
                className={`ps-chip ${rounds === r ? "sel" : ""}`}
                onClick={() => { Audio.sfxClick(); setRounds(r); }}
              >{faNum(r)} دور</button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="play-big party-start"
          onClick={() => {
            Audio.sfxChapterUnlock();
            onStart(
              conf.slice(0, count).map((c, i) => ({ ...c, name: c.name.trim() || `بازیکن ${faNum(i + 1)}` })),
              rounds,
            );
          }}
        >
          شروع دورهمی!
        </button>
        <div style={{ height: 24 }} />
      </div>
    </Sheet>
  );
}

/* ================= HANDOFF ================= */
function Handoff({ p, round, rounds, total, onGo }: {
  p: PState; round: number; rounds: number; total: { name: string; avatar: string; score: number }[]; onGo: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onGo, 2100);
    return () => clearTimeout(t);
  }, [onGo, p.name, round]);
  const rank = [...total].sort((a, b) => b.score - a.score);
  return (
    <div className="vz-page ps-handoff" onClick={onGo} role="button" aria-label="ادامه">
      <div className="ps-hand-card rise-in">
        <div className="ps-hand-round">دور {faNum(round)} از {faNum(rounds)}</div>
        <AvatarFace id={p.avatar} size={92} />
        <div className="ps-hand-name">نوبتِ {p.name}!</div>
        <div className="ps-hand-hint">آماده باش… واژه‌ها منتظرند!</div>
        <div className="ps-hand-ranks">
          {rank.slice(0, 3).map((r, i) => (
            <span key={r.name} className="ps-rank-chip">
              <i>{faNum(i + 1)}</i> {r.name} · {faNum(r.score)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= TURN ================= */
function TurnGame({
  p, round, rounds, golden, usedWords, usedWheelKeys, onWord, onTurnEnd, onExit,
}: {
  p: PState;
  round: number; rounds: number;
  golden: boolean;
  usedWords: React.MutableRefObject<Set<string>>;
  usedWheelKeys: React.MutableRefObject<Set<string>>;
  onWord: (pts: number, word: string) => void;
  onTurnEnd: (scored: boolean) => void;
  onExit: () => void;
}) {
  const wheel = useMemo(() => pickWheel(usedWheelKeys.current), []);
  const levelWords = wheel.words;
  /* how many real ≥3-letter words hide in this wheel? (friendly hint so
     players always know there IS something to find) */
  const wordCount = useMemo(() => {
    const pool = wheel.ls.join("");
    const set = new Set<string>();
    for (const w of DICT_WORDS) {
      if (Array.from(w).length >= 3 && canBuild(w, pool)) set.add(w);
    }
    for (const w of levelWords) if (Array.from(w).length >= 3) set.add(w);
    return set.size;
  }, [wheel]);
  const [sel, setSel] = useState<number[]>([]);
  const [turnWords, setTurnWords] = useState<{ w: string; pts: number }[]>([]);
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(0);
  const [pops, setPops] = useState<{ id: number; pts: number }[]>([]);
  const popId = useRef(0);
  const endedRef = useRef(false);
  const t0Ref = useRef(Date.now());

  const word = sel.map((i) => wheel.ls[i]).join("");
  const submit = () => {
    if (endedRef.current || sel.length < 3) {
      if (sel.length < 3) { setMsg("حداقل ۳ حرف!"); setShake((s) => s + 1); Audio.sfxWrong(); }
      return;
    }
    if (usedWords.current.has(word)) {
      setMsg("این واژه قبلاً گفته شد!"); setShake((s) => s + 1); Audio.sfxWrong(); return;
    }
    if (!isRealWord(word) && !levelWords.has(word)) {
      setMsg("واژه معتبر نیست!"); setShake((s) => s + 1); Audio.sfxWrong(); return;
    }
    const speed = Math.ceil(Math.max(0, TURN_MS - (Date.now() - t0Ref.current)) / 1000);
    const pts = scoreWord(sel.length, speed, p.streak, golden);
    usedWords.current.add(word);
    Audio.sfxWordFound(turnWords.length + 1);
    buzz([16, 26, 16], Save.data.settings.haptics);
    setTurnWords((ws) => [{ w: word, pts }, ...ws]);
    setSel([]);
    setMsg("");
    popId.current += 1;
    const id = popId.current;
    setPops((ps) => [...ps, { id, pts }]);
    setTimeout(() => setPops((ps) => ps.filter((x) => x.id !== id)), 1100);
    onWord(pts, word);
  };

  const endNow = (scored: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;
    onTurnEnd(scored);
  };

  const timerEnd = useCallback(() => endNow(turnWords.length > 0), [turnWords.length]);

  const tap = (i: number) => {
    if (endedRef.current) return;
    Audio.sfxLetter(i % 3);
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };

  return (
    <div className="vz-page">
      {/* top bar */}
      <div className="ps-top">
        <button type="button" className="ps-x" aria-label="خروج" onClick={onExit}>✕</button>
        <div className={`ps-active ${golden ? "golden" : ""}`}>
          <AvatarFace id={p.avatar} size={34} />
          <b>{p.name}</b>
          <span className="ps-active-score">{faNum(p.score)}</span>
        </div>
        <div className="ps-roundchip">دور {faNum(round)}/{faNum(rounds)}</div>
      </div>
      {golden && <div className="ps-golden-note">چرخِ طلایی — امتیازها ۲ برابر!</div>}

      <div className="ps-board">
        {/* timer + wheel */}
        <div className="ps-wheel-zone">
          <div className="pt-timer-holder">
            <TurnTimer ms={TURN_MS} onEnd={timerEnd} />
          </div>
          <div className={`ps-ring ${golden ? "golden" : ""}`}>
            {wheel.ls.map((ch, i) => {
              const ang = -90 + (360 / wheel.ls.length) * i;
              const rad = (ang * Math.PI) / 180;
              return (
                <button
                  key={i}
                  type="button"
                  className={`pw-tile ${sel.includes(i) ? "sel" : ""}`}
                  style={{
                    left: `${50 + 38 * Math.cos(rad)}%`,
                    top: `${50 + 38 * Math.sin(rad)}%`,
                  }}
                  onClick={() => tap(i)}
                  aria-label={`حرف ${ch}`}
                >
                  {ch}
                </button>
              );
            })}
            <div className="ps-hub">
              {word ? word : <span className="ps-hub-hint">واژه بساز…</span>}
            </div>
          </div>
        </div>

        {/* message + pops */}
        <div className="ps-msgrow">
          {msg && <span key={shake} className="ps-msg shake-x">{msg}</span>}
          {pops.map((x) => (
            <span key={x.id} className={`ps-pop ${golden ? "golden" : ""}`}>+{faNum(x.pts)}</span>
          ))}
        </div>

        {/* actions */}
        <div className="ps-actions">
          <button type="button" className="ps-act back" onClick={() => { Audio.sfxClick(); setSel((s) => s.slice(0, -1)); }} aria-label="پاک کردن">
            پاک
          </button>
          <button type="button" className="ps-act submit" disabled={sel.length < 3} onClick={submit} aria-label="ثبت واژه">
            ثبت واژه
          </button>
          <button type="button" className="ps-act finish" onClick={() => { Audio.sfxClick(); endNow(turnWords.length > 0); }}>
            پایان نوبت
          </button>
        </div>

        {/* words found this turn */}
        <div className="ps-turnwords">
          {turnWords.length === 0 ? (
            <span className="ps-tw-empty">{faNum(wordCount)} واژه در این چرخ پنهان است…</span>
          ) : (
            turnWords.slice(0, 6).map((x) => (
              <span key={x.w} className="ps-tw">{x.w} <i>+{faNum(x.pts)}</i></span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= FINAL PODIUM ================= */
function Final({ ps, onRematch, onNewPlayers, onHome }: {
  ps: PState[]; onRematch: () => void; onNewPlayers: () => void; onHome: () => void;
}) {
  const rank = useMemo(() => [...ps].sort((a, b) => b.score - a.score), [ps]);
  const champ = rank[0];
  /* podium seats carry their REAL place (2nd, 1st, 3rd) — the old code
     derived the label from the column index and showed «۱» on the 2nd
     place column whenever two players tied or sat left of the champ */
  const seats = [
    { p: rank[1], place: 2 },
    { p: rank[0], place: 1 },
    { p: rank[2], place: 3 },
  ].filter((s) => !!s.p);
  const h = (place: number) => (place === 1 ? 92 : place === 2 ? 64 : 48); /* podium heights */
  const medal = (place: number) => (place === 1 ? "#ffd76e" : place === 2 ? "#cfd6e4" : "#e0995c");
  return (
    <div className="vz-page ps-final">
      {/* one-shot confetti — transform/opacity only */}
      <div className="ps-confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: ["#ffd76e", "#ff8fab", "#7ce97f", "#7cc9ff", "#c9a1ff"][i % 5],
              animationDuration: `${2.4 + (i % 5) * 0.35}s`,
              animationDelay: `${(i % 7) * 0.12}s`,
            }}
          />
        ))}
      </div>

      <div className="ps-final-title title3d" data-t="پایان دورهمی!">پایان دورهمی!</div>
      <div className="ps-crown-wrap rise-in">
        <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden>
          <path d="M3 26 L6 8 L15 17 L23 3 L31 17 L40 8 L43 26 Z" fill="#ffd94e" stroke="#c87f06" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="23" cy="20" r="2.6" fill="#e25c5c" /><circle cx="12" cy="21" r="2" fill="#3d9df0" /><circle cx="34" cy="21" r="2" fill="#3fae5c" />
        </svg>
        <AvatarFace id={champ.avatar} size={78} />
        <div className="ps-champ-name">{champ.name}</div>
        <div className="ps-champ-score">{faNum(champ.score)} امتیاز</div>
      </div>

      <div className="ps-podium">
        {seats.map(({ p, place }) => (
          <div key={p.name + place} className="ps-pod-col">
            <AvatarFace id={p.avatar} size={place === 1 ? 54 : 44} />
            <b className="ps-pod-name">{p.name}</b>
            <div className="ps-pod-block" style={{ height: h(place), background: `linear-gradient(180deg, ${medal(place)}, ${medal(place)}cc)` }}>
              <span className="ps-pod-rank">{faNum(place)}</span>
              <span className="ps-pod-score">{faNum(p.score)}</span>
            </div>
          </div>
        ))}
      </div>

      {rank.length > 3 && (
        <div className="ps-rest">
          {rank.slice(3).map((p, i) => (
            <span key={p.name} className="ps-rest-row">
              <i>{faNum(i + 4)}</i> {p.name} · {faNum(p.score)}
            </span>
          ))}
        </div>
      )}

      <div className="ps-final-actions">
        <button type="button" className="play-big" style={{ fontSize: 19, padding: "10px 30px" }} onClick={() => { Audio.sfxChapterUnlock(); onRematch(); }}>
          دوباره!
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="ps-act back" onClick={onNewPlayers}>بازیکنان جدید</button>
          <button type="button" className="ps-act finish" onClick={onHome}>صفحه اصلی</button>
        </div>
      </div>
    </div>
  );
}

/* ================= SCREEN ROOT ================= */
export function PartyScreen({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<PState[]>([]);
  const [rounds, setRounds] = useState(3);
  const [round, setRound] = useState(1);
  const [turnIdx, setTurnIdx] = useState(0);
  const usedWords = useRef<Set<string>>(new Set());
  const usedWheelKeys = useRef<Set<string>>(new Set());

  const n = players.length;
  const golden = n > 0 && turnIdx % n === n - 1; /* last turn of every round */

  const startAll = (conf: PConf[], r: number) => {
    setPlayers(conf.map((c) => ({ ...c, score: 0, streak: 0 })));
    setRounds(r);
    setRound(1);
    setTurnIdx(0);
    usedWords.current = new Set();
    usedWheelKeys.current = new Set();
    setPhase("handoff");
  };

  const onWord = (pts: number) => {
    setPlayers((ps) => ps.map((p, i) => (i === turnIdx ? { ...p, score: p.score + pts } : p)));
  };

  const onTurnEnd = (scored: boolean) => {
    setPlayers((ps) => ps.map((p, i) => (i === turnIdx ? { ...p, streak: scored ? p.streak + 1 : 0 } : p)));
    const isLastOfRound = (turnIdx + 1) % n === 0;
    if (isLastOfRound && round >= rounds) {
      Audio.sfxLevelComplete(3);
      setPhase("final");
    } else {
      setTurnIdx((t) => t + 1);
      if (isLastOfRound) setRound((r) => r + 1);
      setPhase("handoff");
    }
  };

  if (phase === "setup") return <Setup onStart={startAll} onExit={onExit} />;
  if (phase === "final") {
    return (
      <Final
        ps={players}
        onRematch={() => {
          setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, streak: 0 })));
          setRound(1); setTurnIdx(0);
          usedWords.current = new Set(); usedWheelKeys.current = new Set();
          setPhase("handoff");
        }}
        onNewPlayers={() => setPhase("setup")}
        onHome={onExit}
      />
    );
  }
  const cur = players[turnIdx % Math.max(1, n)];
  if (!cur) return null;
  if (phase === "handoff") {
    return (
      <Handoff
        p={cur} round={round} rounds={rounds}
        total={players.map(({ name, avatar, score }) => ({ name, avatar, score }))}
        onGo={() => setPhase("turn")}
      />
    );
  }
  return (
    <Sheet bg="/assets/bg/sunset2.webp" bgDim={0.22} blur={2}>
      <TurnGame
        key={`${round}:${turnIdx}`}
        p={cur}
        round={round} rounds={rounds}
        golden={golden}
        usedWords={usedWords}
        usedWheelKeys={usedWheelKeys}
        onWord={onWord}
        onTurnEnd={onTurnEnd}
        onExit={onExit}
      />
    </Sheet>
  );
}
