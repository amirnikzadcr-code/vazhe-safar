/* dump music configs for the offline renderer (session O) */
import { CHAPTERS, MENU_MUSIC, PARTY_MUSIC } from "../src/game/data/chapters";
import { writeFileSync } from "fs";

const out: ({ id: number | string; music: unknown })[] = [
  { id: 0, music: MENU_MUSIC },
  ...CHAPTERS.map((c) => ({ id: c.id, music: c.music })),
  { id: "party", music: PARTY_MUSIC },
];
writeFileSync("/home/z/my-project/scripts/music_configs.json", JSON.stringify(out, null, 1) + "\n");
console.log("dumped", out.length, "configs");
