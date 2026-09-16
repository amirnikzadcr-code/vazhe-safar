import { io } from "socket.io-client";
const code = process.argv[2];
const word = process.argv[3];
const s = io("http://localhost:81/?XTransformPort=3003", { transports: ["polling","websocket"] });
s.on("connect", () => {
  s.emit("hello", { name: "دوست", avatar: "fox" });
  s.emit("room:join", { code }, (r) => console.log("join:", JSON.stringify(r)));
});
s.on("round:began", () => {
  console.log("round began → claiming", word);
  setTimeout(() => s.emit("word:claim", { word }), 400);
});
s.on("word:scored", (x) => { console.log("scored:", JSON.stringify(x)); process.exit(0); });
s.on("word:taken", (x) => { console.log("taken:", JSON.stringify(x)); process.exit(0); });
setTimeout(() => { console.log("no-verdict"); process.exit(1); }, 15000);
