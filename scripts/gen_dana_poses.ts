import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync } from "fs";

const RAW = "/home/z/my-project/scripts/char_raw_v18";
const b64 = readFileSync(`${RAW}/dana_rest.png`).toString("base64");
const dataUrl = `data:image/png;base64,${b64}`;

const POSES: [string, string][] = [
  ["seat", "he is sitting on a small wooden stool, leaning slightly forward, happily holding a steaming golden cup of Persian tea with both hands, cozy and relaxed, big smile"],
  ["point", "he is teaching: one arm raised with index finger pointing up, the other hand holding a small wooden pointer stick, eyebrows raised, friendly explaining smile"],
  ["thumb", "he gives a big confident thumbs-up with one hand, the other hand resting on his belly, proud happy closed-mouth smile"],
  ["cheer", "he celebrates: both arms raised high in the air, head tilted up a little, huge joyful open-mouth smile, eyes shining behind the golden glasses"],
  ["hello", "he waves hello energetically with his right hand raised high, left hand on his hip, head slightly tilted, big welcoming smile"],
];

const KEEP = "Keep the EXACT same character design: same face, same huge round golden eyeglasses, same big bushy white mustache and beard, same white side hair, same mustard-yellow paisley knitted vest over cream shirt, same dark brown trousers, same cartoon style and colors, same plain pure white background, no shadow. Only change the pose: ";

const zai = await ZAI.create();
for (const [name, pose] of POSES) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await zai.images.generations.edit({
        prompt: KEEP + pose,
        images: [{ url: dataUrl }],
        size: "864x1152",
      });
      const buf = Buffer.from(r.data[0].base64, "base64");
      writeFileSync(`${RAW}/dana_${name}.png`, buf);
      console.log(`ok ${name} (${Math.round(buf.length / 1024)} KB)`);
      break;
    } catch (e) {
      console.error(`attempt ${attempt} for ${name} failed:`, e.message?.slice(0, 120));
      if (attempt === 3) process.exitCode = 1;
      else await new Promise((s) => setTimeout(s, 1500 * attempt));
    }
  }
}
console.log("done");
