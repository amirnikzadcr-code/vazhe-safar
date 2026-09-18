#!/usr/bin/env bash
# FF QA round 6 — preset with pagehide guard (old page's debounced flush
# was overwriting the preset on reload), then map ch6 + play ch6.
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
$AB open "http://localhost:3000/?nofpsguard=1&v=8" >/dev/null
sleep 1.5
$AB eval "
(() => {
  const KEY='vazhe_safar_save_v1';
  const preset = (() => {
    let s={};
    try { s=JSON.parse(localStorage.getItem(KEY)||'{}'); } catch {}
    s.v = 1;
    s.profile = Object.assign({}, s.profile, { name:'تستر', avatar:'cat' });
    s.welcomeShownDay = Math.floor(Date.now()/86400000);
    s.levels = s.levels || {};
    for (let c=1; c<=5; c++) for (let l=1; l<=10; l++)
      s.levels[c+':'+l] = { stars:3, bonus:[], mistakes:0 };
    s.last = { ch: 6, lv: 1 };
    s.levelsPlayed = 50;
    return s;
  })();
  localStorage.setItem(KEY, JSON.stringify(preset));
  /* the live page still holds the OLD save in memory; on unload its
   * flush would clobber the preset. Our capture-phase guard fires
   * after the app's flush (same target → registration order) and
   * writes the preset LAST → preset always wins. */
  window.addEventListener('pagehide', () => {
    localStorage.setItem(KEY, JSON.stringify(preset));
  }, true);
  return 'guarded';
})()"

$AB reload >/dev/null
sleep 4.5
echo "--- after reload ---"
$AB eval "(()=>{const s=JSON.parse(localStorage.getItem('vazhe_safar_save_v1')||'{}');return JSON.stringify({name:s.profile&&s.profile.name, lvKeys:Object.keys(s.levels||{}).length})})()"
$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعبازی'))?.click()" >/dev/null
sleep 1.6
echo "--- chips ---"
$AB eval "JSON.stringify([...document.querySelectorAll('.ch-chip')].slice(0,9).map(c=>c.innerText.trim()))"

echo "--- map ch6 ---"
$AB eval "[...document.querySelectorAll('.ch-chip')].find(c=>c.innerText.trim()==='۶')?.click()" >/dev/null
sleep 2.2
$AB screenshot scripts/ff6_map_ch6.png >/dev/null

echo "--- play ch6 lv1 ---"
$AB eval "[...document.querySelectorAll('.map-node')].find(b=>b.innerText.trim()==='۱')?.click()" >/dev/null
sleep 2.6
$AB screenshot scripts/ff6_play_ch6.png >/dev/null
echo "--- music requests ---"
$AB network requests --filter "ch06" || true
echo "--- console errors ---"
$AB errors || true
echo "QA6 DONE"
