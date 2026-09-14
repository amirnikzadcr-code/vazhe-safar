import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUT = '/home/z/my-project/assets_gen';
const STYLE = 'glossy 3D cartoon render for a casual mobile puzzle game, Royal Match level map art style, vibrant saturated colors, soft painterly shading, warm cheerful lighting, extremely detailed, high quality';
const PATHDESC = 'A light beige stone-paved path starts wide at the bottom center and winds upward in a smooth S-curve (curving right, then left, then right again), becoming narrower, ending at the top center. The path is completely empty, clean and clearly visible the whole way.';
const NOTXT = 'no characters, no text, no letters, no numbers, no UI buttons, no icons on the path';

const THEMES: Record<string, string> = {
  map01: 'The path climbs a lush green hillside garden beside a turquoise sea on the right with a small coastal town, Mediterranean village houses with terracotta roofs among green trees on the left, pink blossom trees at the top, colorful flower bushes and lampposts along the path, bright blue sky with puffy clouds.',
  map02: 'The path climbs through a warm Persian bazaar town of brick domes and arched stalls, colorful fabrics and hanging red lanterns, strings of flags, crates of fruits and pottery along the path, golden afternoon light, warm orange sky.',
  map03: 'The path crosses golden desert sand dunes with a caravan of camels resting far away, palm trees and desert plants along the way, a sandstone arch gate, warm sunset sky with orange and pink clouds.',
  map04: 'The path climbs through a lush misty green forest with tall trees, ferns and glowing fireflies, soft sunbeams slipping between branches, small mushrooms and moss stones along the path, emerald and teal tones.',
  map05: 'The path climbs a rocky mountain toward a gray stone castle with blue cone towers and red flags at the top, snowy peaks in the background, mountain flowers and pine trees along the path, crisp blue sky.',
  map06: 'The path climbs through a desert city of mud-brick houses with tall windcatcher towers at warm dusk, glowing windows and hanging lanterns, clay pots and rugs along the path, peach and violet evening sky.',
  map07: 'The path climbs along a turquoise tropical coast with a wooden sailing boat on the shining sea, white shells and starfish on the sand, palm trees and hibiscus flowers along the path, a lighthouse at the top, bright sunny sky.',
  map08: 'The path climbs terraced green hillsides of a mountain village with stone stepped houses with warm lit windows, waterfalls between terraces, walnut trees and blossom branches along the path, fresh morning light.',
  map09: 'The path crosses a calm desert at night under a deep blue starry sky with a big crescent moon and shooting stars, glowing lanterns and fireflies along the path, dark blue dunes with silver light, cozy tents in the distance.',
  map10: 'The path climbs to a grand celebration garden party at the top: colorful fireworks and confetti in the sky, garlands of pennant flags, glowing lanterns, a golden trophy on a podium at the summit, flower arches and lush rose gardens along the path, magical festive evening light.',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function genOne(zai: any, name: string): Promise<boolean> {
  const fp = `${OUT}/${name}.png`;
  if (fs.existsSync(fp) && fs.statSync(fp).size > 30000) { console.log(`skip ${name}`); return true; }
  const prompt = `Vertical mobile game level map. ${PATHDESC} ${THEMES[name]} ${STYLE}. ${NOTXT}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await zai.images.generations.create({ prompt, size: '768x1344' });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error('empty response');
      fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
      console.log(`OK ${name} (${fs.statSync(fp).size >> 10}KB)`);
      return true;
    } catch (e: any) {
      console.log(`fail ${name} #${attempt}: ${String(e?.message || e).slice(0, 90)}`);
      await sleep(attempt * 8000);
    }
  }
  return false;
}

async function main() {
  const zai = await ZAI.create();
  const targets = process.argv.slice(2);
  const names = targets.length ? targets : Object.keys(THEMES);
  let ok = 0;
  for (const n of names) {
    if (await genOne(zai, n)) ok++;
    await sleep(3000);
  }
  console.log(`DONE ${ok}/${names.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
