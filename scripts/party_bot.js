(() => {
  /* self-contained party-bot: reads the live wheel, looks up a valid word
     from the embedded wheel map, taps it human-style, submits, reports. */
  const MAP = __WHEELMAP__;
  const tiles = [...document.querySelectorAll('.pw-tile')];
  if (!tiles.length) return JSON.stringify({ state: 'no-wheel' });
  const ls = tiles.map(b => b.getAttribute('aria-label').replace('حرف ', ''));
  const key = [...ls].sort().join('');
  const cands = (MAP[key] || []).filter(w => {
    const pl = [...ls];
    for (const ch of w) { const i = pl.indexOf(ch); if (i === -1) return false; pl.splice(i, 1); }
    return true;
  });
  if (!cands.length) return JSON.stringify({ state: 'no-candidate', ls });
  /* longest word = most points */
  const word = cands.sort((a, b) => [...b].length - [...a].length)[0];
  const back = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'پاک کردن');
  const sub = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'ثبت واژه');
  const q = (l) => tiles.find(b => b.getAttribute('aria-label') === 'حرف ' + l);
  const steps = [];
  for (let i = 0; i < 8; i++) steps.push(['back']);
  for (const ch of word) steps.push(['tap', ch]);
  steps.push(['submit']);
  steps.forEach((s, k) => setTimeout(() => {
    if (s[0] === 'back') back?.click();
    else if (s[0] === 'tap') q(s[1])?.click();
    else sub?.click();
  }, 150 * (k + 1)));
  return JSON.stringify({ state: 'playing', word, ls });
})()
