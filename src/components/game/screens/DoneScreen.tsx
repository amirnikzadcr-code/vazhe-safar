"use client";
/* ------------------------------------------------------------------
 * DoneScreen — chapter complete: sunset balcony poem + chapter chest
 * ------------------------------------------------------------------ */
import { Sheet, Btn } from "@/components/game/ui/kit";
import { Save } from "@/game/core/save";
import { faNum } from "@/game/core/utils";
import { Audio } from "@/game/core/audio";
import { CHAPTERS } from "@/game/data/chapters";
import { bumpSave } from "@/components/game/useSave";

export function DoneScreen({
  ch, coins, onNext, onLibrary,
}: {
  ch: number;
  coins: number;
  onNext: () => void;
  onLibrary: () => void;
}) {
  const theme = CHAPTERS[ch - 1];
  const canChest = !Save.hasChest(ch);
  const hasNext = ch < 10;

  return (
    <Sheet bg="/assets/bg/sunset2.webp" bgDim={0.18}>
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "flex-end", padding: 16, gap: 12 }}>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <div>
            <h2 className="title3d" data-t="کامل شد!" style={{ fontSize: 40, margin: 0 }}>
              کامل شد!
            </h2>
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="chip" style={{ fontSize: 14 }}>فصل {faNum(ch)} — {theme.title}</span>
          </div>
        </div>

        <p
          style={{
            textAlign: "center", color: "#fff3dd", fontWeight: 700, fontSize: 16.5, lineHeight: 2,
            margin: "4px 10px", textShadow: "0 2px 6px rgba(40,10,0,.6)",
          }}
        >
          «{theme.finaleText}»
        </p>

        {canChest ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            
            <img src="/assets/obj/chest.webp" alt="صندوقچه پایان فصل" className="breathe" style={{ height: 120, objectFit: "contain" }} />
            <Btn
              color="gold"
              size="big"
              onClick={() => {
                if (Save.claimChest(ch)) { Audio.sfxBoom(); Audio.sfxCoin(); bumpSave(); }
              }}
            >
              صندوقچه: {faNum(150)} سکه بگیر!
            </Btn>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span className="chip" style={{ fontSize: 14 }}>صندوقچهٔ این فصل را گرفتی ✓</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
          <Btn color="teal" onClick={onLibrary}>کتابخانه</Btn>
          {hasNext && (
            <Btn size="big" onClick={onNext}>فصل بعد</Btn>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 30 }}>
        <span className="chip" style={{ fontSize: 14 }}>
          <span className="coin-ic" style={{ width: 18, height: 18 }} />
          {faNum(coins)}
        </span>
      </div>
    </Sheet>
  );
}
