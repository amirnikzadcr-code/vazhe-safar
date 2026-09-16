import { io } from "socket.io-client";
const code = process.argv[2];
const s = io("http://localhost:81/?XTransformPort=3003", { transports: ["polling","websocket"] });
s.on("connect", () => {
  console.log("guest socket:", s.id);
  s.emit("hello", { name: "دوست", avatar: "fox" });
  s.emit("room:join", { code }, (r) => console.log("join:", JSON.stringify(r)));
});
s.on("room:state", (st) => {
  console.log("state:", st.phase, "players:", st.players.map(p => p.name + "@" + p.id.slice(-4)).join(","), "host:", st.hostId?.slice(-4));
});
s.on("round:began", (r) => console.log("round:began", JSON.stringify(r.ls)));
setInterval(() => {}, 1 << 30);
