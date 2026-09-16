/* BB — simulate a drag stroke through ring letters on the WiFi round.
 * Usage (in browser console via agent-browser eval):
 *   dragWord(['د','و','س','ت'])
 */
window.dragWord = async function (want) {
  const ring = document.querySelector(".ps-ring");
  if (!ring) return "no ring";
  const r = ring.getBoundingClientRect();
  const tiles = [...document.querySelectorAll(".pw-tile")];
  const pt = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };
  const ev = (type, x, y) => {
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true, buttons: type === "pointerup" ? 0 : 1 };
    (type === "pointerdown" ? ring : ring).dispatchEvent(new PointerEvent(type, o));
  };
  const seq = want.map(ch => {
    const t = tiles.find(x => x.textContent.trim() === ch);
    return t ? pt(t) : null;
  }).filter(Boolean);
  if (seq.length < 2) return "letters not found";
  ev("pointerdown", seq[0].x, seq[0].y);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  await sleep(90);
  for (let i = 1; i < seq.length; i++) {
    // walk in ~6 sub-steps so segment catchers never miss a bead
    const a = seq[i - 1], b = seq[i];
    for (let k = 1; k <= 6; k++) {
      ev("pointermove", a.x + (b.x - a.x) * k / 6, a.y + (b.y - a.y) * k / 6);
      await sleep(22);
    }
  }
  await sleep(80);
  ev("pointerup", seq[seq.length - 1].x, seq[seq.length - 1].y);
  return "stroked " + want.join("");
};
"installed"
