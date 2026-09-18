#!/usr/bin/env bash
# FF QA round 4 — unlock ch6 NATURALLY via save preset (ch1-5 done),
# then map ch6 → play ch6 → music fetch check → lowfx sanity.
set -uo pipefail
cd /home/z/my-project
AB="agent-browser"

(bun run dev > dev.log 2>&1 &)
for i in $(seq 1 30); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true)
  [ "$code" = "200" ] && break
done
echo "server: $code"

$AB set viewport 360 760
$AB open "http://localhost:3000/?nofpsguard=1&v=6" >/dev/null
sleep 1
$AB eval "
(() => {
  const KEY='vazhe_safar_save_v1';
  let s={};
  try { s=JSON.parse(localStorage.getItem(KEY)||'{}'); } catch {}
  s.profile = Object.assign({}, s.profile, { name:'تستر', avatar:'cat' });
  s.welcomeShownDay = Math.floor(Date.now()/86400000);
  s.levels = s.levels || {};
  for (let c=1; c<=5; c++) for (let l=1; l<=10; l++) s.levels[c+':'+l] = { stars:3, mistakes:0 };
  s.last = { ch: 6, lv: 1 };
  localStorage.setItem(KEY, JSON.stringify(s));
  return 'ok';
})()" >/dev/null
$AB reload >/dev/null
sleep 4.5

$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعبازی'))?.click()" >/dev/null
sleep 1.5

# ---- map chapter 6 ----
$AB eval "JSON.stringify([...document.querySelectorAll('.ch-chip')].slice(0,8).map(c=>c.innerText.trim()))"
$AB eval "[...document.querySelectorAll('.ch-chip')].find(c=>c.innerText.trim()==='۶')?.click()" >/dev/null
sleep 2.2
$AB screenshot scripts/ff4_map_ch6.png >/dev/null

# ---- play chapter 6 level 1 (new bg art + track fetch) ----
$AB eval "[...document.querySelectorAll('.map-node')].find(b=>b.innerText.trim()==='۱')?.click()" >/dev/null
sleep 2.6
$AB screenshot scripts/ff4_play_ch6.png >/dev/null
echo "--- music requests (ch06) ---"
$AB network requests --filter "ch06" || true

# ---- lowfx fallback sanity (map ch1) ----
$AB open "http://localhost:3000/?nofpsguard=1&lowfx=1&v=6" >/dev/null
sleep 4
$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعبازی'))?.click()" >/dev/null
sleep 1.5
$AB screenshot scripts/ff4_map_lowfx.png >/dev/null

echo "--- console errors ---"
$AB errors || true
echo "QA4 DONE"
