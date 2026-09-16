/* BB — full hub flow test: create → join → round:load → claim → rejoin
 * simulates the WiFi-blip auto-rejoin path end to end. */
import { io } from "socket.io-client";

const URL = process.argv[2] || "http://localhost:3003";

const conn = () => {
  const s = io(URL, { transports: ["polling", "websocket"], timeout: 6000 });
  return new Promise((res) => s.on("connect", () => res(s)));
};
const emit = (s, ev, arg) => new Promise((res) => s.emit(ev, arg, (r) => res(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const A = await conn();
A.emit("hello", { name: "هاست", avatar: "cat" });
const cr = await emit(A, "room:create", null);
console.log("create:", JSON.stringify(cr));

const B = await conn();
B.emit("hello", { name: "مهمان", avatar: "fox" });
const j = await emit(B, "room:join", { code: cr.code });
console.log("join:", JSON.stringify(j));

// start a round: host loads a wheel
let bBegan = null;
B.on("round:began", (p) => { bBegan = p; });
A.emit("round:load", { wheel: { ls: ["ق", "ع", "ر", "ی", "و"], words: [] } });
await wait(400);
console.log("round:began to B:", JSON.stringify(bBegan));

// B claims a word → +30
let aScored = null;
A.on("word:scored", (p) => { aScored = p; });
B.emit("word:claim", { word: "قعر" });
await wait(400);
console.log("word:scored:", JSON.stringify(aScored));

// B "drops" (network blip) then rejoins — must resume with 30 pts
B.disconnect();
await wait(400);
const B2 = await conn();
B2.emit("hello", { name: "مهمان", avatar: "fox" });
const rj = await emit(B2, "room:join", { code: cr.code });
console.log("rejoin:", JSON.stringify(rj));
await wait(300);
B2.on("room:state", () => {});
// fetch state once
const st = await new Promise((res) => {
  B2.emit("room:join", { code: cr.code }, () => {}); // idempotent-ish
  A.once ? null : null;
  setTimeout(() => res(null), 50);
});
// simpler: hub broadcasts state after join — capture via listener
const st2 = await new Promise((res) => {
  const h = (s) => { res(s); B2.off("room:state", h); };
  B2.on("room:state", h);
  setTimeout(() => res(null), 1500);
});
console.log("state after rejoin:", JSON.stringify(st2?.players ?? st));

A.close(); B2.close();
process.exit(0);
