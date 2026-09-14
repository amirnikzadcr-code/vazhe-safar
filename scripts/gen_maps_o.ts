import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUT = '/home/z/my-project/assets_gen';
const STYLE = 'glossy 3D cartoon render for a casual mobile puzzle game, Royal Match level map art style, vibrant saturated colors, soft painterly shading, warm cheerful lighting, extremely detailed, high quality';
const PATHDESC = 'A light beige stone-paved path starts wide at the bottom center and winds upward in a smooth S-curve (curving right, then left, then right again), becoming narrower, ending at the top center. The path is completely empty, clean and clearly visible the whole way.';
const NOTXT = 'no characters, no text, no letters, no numbers, no UI buttons, no icons on the path';

const THEMES: Record<string, string> = {
  map11: 'The path climbs through a mystical cloud forest of giant ancient trees with wooden rope bridges, glowing soft mist between the trunks, emerald moss and glowing fireflies along the path, teal and green tones, sunbeams from above.',
  map12: 'The path follows the shore of a serene silver mountain lake at magical night, a huge full moon and its glowing reflection, glowing lotus flowers on the water, a small wooden pier at the top, fireflies and smooth stones along the path, deep indigo and teal night palette.',
  map13: 'The path winds through a magical crystal cave with giant glowing amethyst and turquoise crystals, a calm underground pool with sparkling reflections, crystal clusters and glowing pebbles along the path, violet and cyan glow.',
  map14: 'The path climbs through red rock canyon hills with striped fairy chimneys at golden hour, warm crimson and orange cliffs, a green valley with red poppies and small shrubs along the path, bright turquoise sky.',
  map15: 'The path climbs across floating sky islands with lush hanging gardens, waterfalls pouring into soft clouds below, a rainbow arch, colorful hot air balloons far away, pastel blue sky, flower bushes and lanterns along the path.',
  map16: 'The path climbs along a tropical turquoise lagoon with coral reefs visible under crystal clear water, pearl oysters and starfish on white sand, palm trees and hibiscus along the path, a wooden lifeguard tower at the top, bright sunny sky.',
  map17: 'The path climbs toward a majestic ancient golden Persian city with grand columns, golden palaces and ornate carvings at sunset, colorful banners and braziers along the path, warm epic golden light.',
  map18: 'The path climbs snowy mountain slopes under a glowing teal and purple northern-lights night sky, brilliant stars, warm lit wooden cabins and pine trees along the path, silver snow sparkling.',
  map19: 'The path crosses a frozen lake toward a grand ice palace with crystal towers, aurora light reflecting on the ice, snow drifts and ice crystals along the path, ice blue and silver palette with soft snowfall.',
  map20: 'The path climbs to an epic golden palace on a mountain summit at celebration night, colorful fireworks and glowing lanterns in the sky, garlands of pennant flags, a shining golden trophy above the palace gate, festive magical light.',
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
    await sleep(1500);
  }
  console.log(`DONE maps: ${ok}/${names.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
