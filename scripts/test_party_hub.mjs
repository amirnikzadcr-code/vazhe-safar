/* AB — party-hub protocol test: two simulated players through the
 * Caddy gateway (the exact path the browser uses).
 * Flow: create → join → cfg → round:load → claims (owner + thief) →
 * round:end → next round → game:end → rematch → leave.
 * Exits 0 only if EVERY assertion passes. */
import { io } from "socket.io-client";

const URL = "http://localhost:81/?XTransformPort=3003";
const Opts = { transports: ["polling", "websocket"], timeout: 6000 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

const host = io(URL, Opts);
const guest = io(URL, Opts);

async function main() {
  await new Promise((r) => host.on("connect", r));
  await new Promise((r) => guest.on("connect", r));
  ok(true, "both sockets connected through the gateway");

  host.emit("hello", { name: "میزبان", avatar: "cat" });
  guest.emit("hello", { name: "مهمان", avatar: "fox" });
  await wait(150);

  /* create + join */
  const created = await new Promise((res) => host.emit("room:create", res));
  ok(created?.ok && /^[2-9A-Z]{4}$/.test(created.code ?? ""), `room:create → code ${created?.code}`);
  const code = created.code;

  const states = [];
  host.on("room:state", (s) => states.push(s));
  const began = new Promise((res) => host.on("round:began", res));
  const scored = new Promise((res) => host.on("word:scored", res));
  const takenP = new Promise((res) => guest.on("word:taken", res));
  const reviewP = new Promise((res) => guest.on("round:review", res));
  const overP = new Promise((res) => guest.on("game:over", res));

  const joined = await new Promise((res) => guest.emit("room:join", { code }, res));
  ok(joined?.ok === true, "guest joined the room");
  await wait(120);

  const badJoin = await new Promise((res) => guest.emit("room:join", { code: "XXXX" }, res));
  ok(badJoin?.ok === false && !!badJoin.error, "unknown code rejected with Persian error");

  /* lobby cfg by host only */
  host.emit("cfg:set", { rounds: 2, seconds: 45 });
  await wait(120);
  const last = states.at(-1);
  ok(last?.rounds === 2 && last?.seconds === 45, "cfg applies (2 rounds / 45s)");

  /* guest tries to start (must be ignored) + host loads a round */
  guest.emit("round:load", { wheel: { ls: ["ب", "ا", "ر", "ا", "ن"], words: ["باران"] } });
  await wait(120);
  ok(states.at(-1)?.phase === "lobby", "guest cannot load a round");

  host.emit("round:load", { wheel: { ls: ["ب", "ا", "ر", "ا", "ن"], words: ["باران", "ران"] } });
  const beganEv = await began;
  ok(beganEv?.ls?.length === 5 && beganEv?.seconds === 45, "round:began broadcast with letters + seconds");

  /* claims: host claims «باران», guest tries the same → taken */
  host.emit("word:claim", { word: "باران" });
  const sc = await scored;
  ok(sc?.pid === host.id && sc?.pts === 50, `host claim scored 50 (${sc?.pts})`);
  guest.emit("word:claim", { word: "باران" });
  const taken = await takenP;
  ok(taken?.word === "باران", "duplicate claim → word:taken to the thief");
  guest.emit("word:claim", { word: "ران" });
  const sc2 = await new Promise((res) => host.on("word:scored", res));
  ok(sc2?.pid === guest.id && sc2?.pts === 30, "guest claims a fresh word (30)");

  /* non-host cannot end the round */
  guest.emit("round:end");
  await wait(120);
  ok(states.at(-1)?.phase === "round", "guest cannot end the round");
  host.emit("round:end");
  const rv = await reviewP;
  ok(rv?.claimed?.length === 2, `review lists 2 claimed words (${rv?.claimed?.length})`);

  /* round 2 then finish */
  host.emit("round:load", { wheel: { ls: ["س", "ا", "ل", "ا", "م"], words: ["سلام"] } });
  await wait(200);
  host.emit("round:end");
  await wait(200);
  host.emit("game:end");
  const over = await overP;
  ok(over?.players?.length === 2 && over.players[0].score >= over.players[1].score, "game:over with sorted scores");

  /* rematch resets */
  host.emit("game:rematch");
  await wait(150);
  ok(states.at(-1)?.phase === "lobby" && states.at(-1).players.every((p) => p.score === 0), "rematch → lobby, scores zeroed");

  /* host migration */
  const hostChanged = new Promise((res) => guest.on("host:changed", res));
  host.close();
  await wait(250);
  const hc = await Promise.race([hostChanged, wait(300).then(() => null)]);
  ok(hc?.hostId === guest.id, "host migrated to the guest when host left");

  guest.close();
  console.log(failures === 0 ? "\nALL HUB TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
