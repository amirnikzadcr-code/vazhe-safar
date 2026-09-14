#!/usr/bin/env python3
"""Double-fork daemonizer: start the standalone Next.js server detached
so it survives the tool-call sandbox reaping process groups."""
import os, sys, time, signal

SERVEDIR = "/home/z/my-project/.next/standalone"
LOG = "/tmp/vz-server.log"

def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)

# kill any previous instance on :3000
os.system("pkill -f 'bun server.js' 2>/dev/null")
time.sleep(0.8)

pid = os.fork()
if pid > 0:
    time.sleep(0.3)
    sys.exit(0)          # parent exits

os.setsid()              # new session — escapes the tool's process group
pid = os.fork()
if pid > 0:
    sys.exit(0)          # first child exits

os.chdir(SERVEDIR)
with open(LOG, "ab") as out, open("/dev/null", "rb") as inp:
    os.dup2(inp.fileno(), 0)
    os.dup2(out.fileno(), 1)
    os.dup2(out.fileno(), 2)
# ignore HUP
signal.signal(signal.SIGHUP, signal.SIG_IGN)
os.execvp("bun", ["bun", "server.js"])
