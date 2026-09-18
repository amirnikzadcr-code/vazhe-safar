#!/usr/bin/env bash
# FF QA round 7 — AllLevels env (fresh .next so NEXT_PUBLIC inlines),
# real name-input fill, map ch6 art, play ch6 (bg + ch06.ogg fetch),
# lowfx sanity.
set -uo pipefail
cd /home/z/my-project
AB="agent-browser"

kill $(ss -ltnp 2>/dev/null | grep :3000 | grep -oP 'pid=\K[0-9]+') 2>/dev/null || true
rm -rf .next
(NEXT_PUBLIC_ALL_UNLOCKED=1 bun run dev > dev.log 2>&1 &)
for i in $(seq 1 40); do
  sleep 1
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true)
  [ "$code" = "200" ] && break
done
echo "server: $code"

$AB set viewport 360 760
$AB open "http://localhost:3000/?nofpsguard=1&v=10" >/dev/null
sleep 5

# real flow: fill the name input (React controlled) + start
$AB eval "
(() => {
  const i = document.querySelector('.name-input');
  if (!i) return 'no-input';
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  set.call(i,'تستر');
  i.dispatchEvent(new Event('input',{bubbles:true}));
  return 'filled';
})()"
$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعسفر'))?.click() || [...document.querySelectorAll('button')].find(b=>b.innerText.includes('واژه'))?.click()" >/dev/null
sleep 1.5
$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعبازی'))?.click()" >/dev/null
sleep 1.6
echo "--- chips (AllLevels: all numbered) ---"
$AB eval "JSON.stringify([...document.querySelectorAll('.ch-chip')].slice(0,9).map(c=>c.innerText.trim()))"

echo "--- map ch6 ---"
$AB eval "[...document.querySelectorAll('.ch-chip')].find(c=>c.innerText.trim()==='۶')?.click()" >/dev/null
sleep 2.2
$AB screenshot scripts/ff7_map_ch6.png >/dev/null
$AB eval "document.querySelector('.cb-title')?.innerText"

echo "--- play ch6 lv1 ---"
$AB eval "[...document.querySelectorAll('.map-node')].find(b=>b.innerText.trim()==='۱')?.click()" >/dev/null
sleep 2.8
$AB screenshot scripts/ff7_play_ch6.png >/dev/null
echo "--- ch06 resources ---"
$AB eval "JSON.stringify(performance.getEntriesByType('resource').map(r=>r.name).filter(n=>n.includes('ch06')))"

# ---- lowfx sanity (map ch1) ----
$AB open "http://localhost:3000/?nofpsguard=1&lowfx=1&v=10" >/dev/null
sleep 4
$AB eval "[...document.querySelectorAll('button')].find(b=>b.innerText.replace(/\\s/g,'').includes('شروعبازی'))?.click()" >/dev/null
sleep 1.6
$AB screenshot scripts/ff7_map_lowfx.png >/dev/null
echo "--- console errors ---"
$AB errors || true
echo "QA7 DONE"
