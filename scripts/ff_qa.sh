#!/usr/bin/env bash
# FF QA round — single-call (sandbox kills bg processes between calls):
# server + full browser walkthrough: splash clouds → home → map ch1
# (current-node marker) → map ch6 (new art) → play → win modal stars.
set -uo pipefail
cd /home/z/my-project
SHOT=scripts
AB="agent-browser"

# ---------- server ----------
(bun run dev > dev.log 2>&1 &) 
for i in $(seq 1 30); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true)
  [ "$code" = "200" ] && break
done
echo "server: $code"

$AB set viewport 360 760
$AB open "http://localhost:3000/?nofpsguard=1" >/dev/null
sleep 1.2
$AB screenshot $SHOT/ff_qa_splash.png >/dev/null

# wait for boot (name-ask modal on fresh storage)
sleep 3.5
$AB screenshot $SHOT/ff_qa_boot.png >/dev/null

# fill the name if asked
if $AB snapshot -i | grep -q "اسمش چیه"; then
  $AB find role textbox fill "تستر" >/dev/null 2>&1 || $AB eval "document.querySelector('input')?.focus()" >/dev/null
  $AB find text "شروع سفر واژه‌ها" click >/dev/null 2>&1 || true
  sleep 1
fi
$AB screenshot $SHOT/ff_qa_home.png >/dev/null

# ---------- map chapter 1 ----------
$AB find text "شروع بازی" click >/dev/null 2>&1 || $AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.includes('شروع بازی'))?.click()" >/dev/null
sleep 1.6
$AB screenshot $SHOT/ff_qa_map_ch1.png >/dev/null

# ---------- map chapter 6 (new art) ----------
$AB eval "[...document.querySelectorAll('.ch-chip')].find(c=>c.innerText.trim()==='۶')?.click()" >/dev/null
sleep 1.8
$AB screenshot $SHOT/ff_qa_map_ch6.png >/dev/null

# ---------- play ch1 lv1 ----------
$AB eval "[...document.querySelectorAll('.ch-chip')].find(c=>c.innerText.trim()==='۱')?.click()" >/dev/null
sleep 1.2
$AB eval "[...document.querySelectorAll('.map-node')].find(b=>b.innerText.trim()==='۱')?.click()" >/dev/null
sleep 2.0
$AB screenshot $SHOT/ff_qa_play.png >/dev/null

# ---------- win level 1 (real drags) ----------
node - <<'EOF'
import { execSync } from "child_process";
import { readFileSync } from "fs";
const ab = (c) => execSync(`agent-browser ${c}`, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LVS = JSON.parse(readFileSync("/home/z/my-project/scripts/ch_words.json", "utf8"));
(async () => {
  let ts = [];
  for (let i = 0; i < 12 && !ts.length; i++) {
    const raw = ab(`eval "JSON.stringify(Array.from(document.querySelectorAll('.tile')).map(t=>{const b=t.getBoundingClientRect();return {ch:t.getAttribute('aria-label'),x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}}))"`);
    ts = JSON.parse(JSON.parse(raw));
    if (!ts.length) await sleep(400);
  }
  const { words } = LVS["1"];
  for (const w of words) {
    const used = new Set(); const path = [];
    for (const ch of w) {
      const t = ts.find((t) => t.ch === ch && !used.has(`${t.x}:${t.y}`));
      if (!t) { console.log("MISS tile", ch, w); continue; }
      used.add(`${t.x}:${t.y}`); path.push(t);
    }
    if (path.length < 2) continue;
    ab(`mouse move ${path[0].x} ${path[0].y}`); ab("mouse down");
    for (let i = 1; i < path.length; i++) {
      const a = path[i-1], b = path[i];
      ab(`mouse move ${Math.round((a.x+b.x)/2)} ${Math.round((a.y+b.y)/2)}`);
      ab(`mouse move ${b.x} ${b.y}`);
    }
    ab("mouse up");
    await sleep(1100);
  }
  console.log("drags done");
})();
EOF
sleep 1.6
$AB screenshot $SHOT/ff_qa_win.png >/dev/null

# ---------- console errors ----------
echo "--- errors ---"
$AB errors || true
echo "QA DONE"
