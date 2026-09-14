"use client";
/* ------------------------------------------------------------------
 * LibraryScreen — village bookshelf; each chapter = a hand-crafted book
 * ------------------------------------------------------------------ */
import { Sheet, TopBar } from "@/components/game/ui/kit";
import { Lock, Check, StarGold } from "@/components/game/icons";
import { CHAPTERS } from "@/game/data/chapters";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";

const BOOK_COLORS = [
  ["#2cc3a8", "#0c7a68"], ["#e88b3a", "#a3541a"], ["#f45b5b", "#a31f1f"],
  ["#9a6fd0", "#5c3585"], ["#3d9df0", "#1b5da0"], ["#46cd5c", "#1d7c33"],
  ["#ffd76e", "#b06e00"], ["#ff8ab0", "#b04a70"], ["#7cc9ff", "#1b5da0"],
  ["#c9a1ff", "#6b3fa0"],
  /* hard tier (ch11-20) */
  ["#2f8f7a", "#1d6353"], ["#4a6fa5", "#2d4670"], ["#7a58c0", "#533a85"],
  ["#d96a3a", "#a84418"], ["#3fa0d9", "#2478a8"], ["#18a8b8", "#0c7a88"],
  ["#c9922e", "#96691a"], ["#3a8fa5", "#22637a"], ["#4a9ed9", "#2a6ba0"],
  ["#9a6fd0", "#c9922e"],
];

export function LibraryScreen({
  onBack, onOpen, onShop,
}: {
  onBack: () => void;
  onOpen: (ch: number) => void;
  onShop: () => void;
}) {
  return (
    <Sheet bg="/assets/bg/home2b.webp" bgDim={0.3}>
      <TopBar onBack={onBack} onShop={onShop} title="کتابخانه" />

      <div className="scrolly" style={{ paddingBottom: 24 }}>
        <p style={{ textAlign: "center", color: "#ffe9c8", fontWeight: 700, textShadow: "0 2px 4px rgba(0,0,0,.4)", margin: "2px 0 12px" }}>
          کدام سفر را امروز آغاز می‌کنی؟
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "22px 12px" }}>
          {CHAPTERS.map((c, i) => {
            const unlocked = Save.chapterUnlocked(c.id);
            const done = Save.levelsDoneInChapter(c.id);
            const complete = done >= 10;
            const [c1, c2] = BOOK_COLORS[i];
            return (
              <button
                type="button"
                key={c.id}
                className={`book ${!unlocked ? "locked" : ""}`}
                style={{ background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)`, minHeight: 128 }}
                disabled={!unlocked}
                onClick={() => unlocked && onOpen(c.id)}
                aria-label={`فصل ${faNum(c.id)}: ${c.title}${unlocked ? "" : " — قفل"}`}
              >
                {!unlocked && <span className="lock-badge"><Lock size={14} /></span>}
                {complete && <span className="done-badge"><Check size={15} /></span>}
                <span style={{ fontSize: 12, opacity: 0.9 }}>فصل {faNum(c.id)}</span>
                <span style={{ fontSize: 16.5 }}>{c.title}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                  <StarGold size={12} />
                  {faNum(done)}/{faNum(10)}
                </span>
                <span className="pbar" style={{ width: "86%", height: 8 }}>
                  <i style={{ ["--p" as string]: done / 10 }} />
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ textAlign: "center", color: "#ffe9c8", fontWeight: 600, fontSize: 12.5, margin: "16px 0 4px", textShadow: "0 2px 4px rgba(0,0,0,.4)" }}>
          با همهٔ سفرها هم‌یار شو؛ کتاب‌ها یکی‌یکی از قفسه برمی‌دارند!
        </p>
      </div>
    </Sheet>
  );
}
