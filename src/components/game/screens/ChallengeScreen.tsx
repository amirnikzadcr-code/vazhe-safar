"use client";
/* ------------------------------------------------------------------
 * ChallengeScreen — daily challenge with Persian (Jalali) calendar
 * ------------------------------------------------------------------ */
import { useMemo } from "react";
import { Sheet, TopBar, Btn, useToast, ToastHost } from "@/components/game/ui/kit";
import { Gift as GiftIc, Check, Flame } from "lucide-react";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { bumpSave } from "@/components/game/useSave";

/* Persian calendar helpers via Intl */
function persianInfo(d: Date) {
  const day = Number(new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { day: "numeric" }).format(d));
  const month = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" }).format(d);
  const wd = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" }).format(d);
  return { day, month, wd };
}
const WEEK = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const wdIndex = (short: string) => {
  const map: Record<string, number> = { "شنبه": 0, "یکشنبه": 1, "دوشنبه": 2, "سه‌شنبه": 3, "سه شنبه": 3, "چهارشنبه": 4, "پنجشنبه": 5, "جمعه": 6, "ش": 0, "ی": 1, "د": 2, "س": 3, "چ": 4, "پ": 5, "ج": 6 };
  return map[short.trim()] ?? 0;
};

export function ChallengeScreen({
  onBack, onStart, onShop,
}: {
  onBack: () => void;
  onStart: () => void;
  onShop: () => void;
}) {
  const { toast, show } = useToast();
  const info = useMemo(() => {
    const now = new Date();
    /* count days of current persian month + weekday of day 1 */
    const todayDay = persianInfo(now).day;
    let probe = new Date(now);
    while (persianInfo(probe).day > 1) probe = new Date(probe.getTime() - 86400000);
    const firstWd = wdIndex(persianInfo(probe).wd);
    let count = 1;
    let q = new Date(probe.getTime() + 86400000);
    while (persianInfo(q).day > persianInfo(new Date(q.getTime() - 86400000)).day) { count++; q = new Date(q.getTime() + 86400000); }
    return { todayDay, month: persianInfo(now).month, firstWd, count };
  }, []);

  const done = Save.challengeDoneToday();
  const streak = Save.data.challenge.streak;

  return (
    <Sheet bg="/assets/bg/sunset2.webp" bgDim={0.38} blur={1}>
      <TopBar onBack={onBack} onShop={onShop} title="چالش روزانه" />

      <div className="scrolly" style={{ display: "flex", flexDirection: "column" }}>
        <div className="panel" style={{ margin: "2px auto 14px", width: "min(100%, 340px)", borderRadius: 24 }}>
          <div className="panel-head">{info.month}</div>
          <div style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 6 }}>
              {WEEK.map((w, i) => (
                <span key={i} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "#a0772e" }}>{w}</span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {Array.from({ length: info.firstWd }).map((_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: info.count }, (_, i) => {
                const d = i + 1;
                const isPast = d < info.todayDay;
                const isToday = d === info.todayDay;
                const isDone = isToday && done;
                return (
                  <span
                    key={d}
                    className={`cal-day ${isToday && !done ? "today" : ""} ${isDone ? "done" : ""} ${isPast ? "past" : ""}`}
                  >
                    {isDone ? <Check size={16} /> : faNum(d)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 12 }}>
          <span className="chip" style={{ fontSize: 13 }}>
            <GiftIc size={15} />
            جایزه: {faNum(50)} سکه
          </span>
          {streak > 0 && (
            <span className="chip" style={{ fontSize: 13 }}>
              <Flame size={15} />
              استریک: {faNum(streak)} روز
            </span>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#ffe9c8", fontWeight: 700, margin: "0 12px 14px", textShadow: "0 2px 4px rgba(0,0,0,.45)", fontSize: 14 }}>
          با تکمیل چالش روزانه، جوایز ویژه دریافت کن!
        </p>

        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 10 }}>
          {done ? (
            <span className="chip" style={{ fontSize: 15, padding: "8px 18px" }}>
              <Check size={18} />
              چالش امروز انجام شد — فردا بیا!
            </span>
          ) : (
            <Btn
              color="teal"
              size="big"
              onClick={() => { Audio.sfxClick(); bumpSave(); onStart(); show("چالش شروع شد!"); }}
            >
              شروع چالش
            </Btn>
          )}
        </div>
      </div>

      <ToastHost toast={toast} />
    </Sheet>
  );
}
