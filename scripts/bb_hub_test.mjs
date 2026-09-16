/* BB debug — test party-hub create+join directly vs through gateway */
import { io } from "socket.io-client";

function mk(url, label) {
  return new Promise((resolve) => {
    const a = io(url, { transports: ["polling", "websocket"], timeout: 6000 });
    let b = null;
    const done = (res) => { try { a.close(); if (b) b.close(); } catch {} resolve("[" + label + "] " + res); };
    a.on("connect", () => {
      a.emit("hello", { name: "A", avatar: "cat" });
      a.emit("room:create", (res) => {
        if (!res || !res.ok) return done("create FAILED " + JSON.stringify(res));
        b = io(url, { transports: ["polling", "websocket"], timeout: 6000 });
        b.on("connect", () => {
          b.emit("hello", { name: "B", avatar: "fox" });
          b.emit("room:join", { code: res.code }, (j) => {
            if (j && j.ok) done("OK code=" + res.code + " join ok");
            else done("create ok code=" + res.code + " but join FAILED: " + JSON.stringify(j));
          });
        });
        b.on("connect_error", () => done("B connect_error (room " + res.code + ")"));
      });
    });
    a.on("connect_error", () => done("A connect_error"));
    setTimeout(() => done("TIMEOUT"), 9000);
  });
}

const targets = process.argv.slice(2);
const list = targets.length ? targets : ["http://localhost:3003", "http://localhost:81/?XTransformPort=3003"];
for (const t of list) {
  console.log(await mk(t, t));
}
process.exit(0);
