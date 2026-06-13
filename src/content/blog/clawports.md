---
title: 'ClawPorts: A Neon Port Killer Born From Nuking My Own Servers'
description: >-
  How a blanket taskkill that wiped every running server turned into ClawPorts —
  an Electron app that lists listening TCP ports and kills them one at a time.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - electron
  - windows
  - devtools
  - ai
project: clawports
heroImage: /images/clawports/hero.png
draft: true
---

I built ClawPorts because I once ran `taskkill /F /IM python.exe` to free up a port, and it killed every Python process on the machine — every dev server, every background script, all at once. The whole point of the command was surgical and the effect was a massacre. ClawPorts is the tool I wished I'd had that day: it lists every TCP port that's actually listening, shows you which process owns it, and lets you kill them one at a time behind a confirmation modal.

## What it is

ClawPorts is a Windows Electron desktop app with a single screen. It scans for listening TCP ports and shows them in a table: port number, an editable label, the owning process name, the PID, the connection state, and a Kill button per row. There's a 66-ports-open counter in the top bar, a 3-second auto-refresh you can toggle, and a manual Refresh button. The styling is neon-synthwave — magenta-and-cyan glow on a near-black background — the same look I'm planning for [ClawMonitor](/projects/).

The labels column is the part I use most. You can click "add label" on any row and type a name, and it sticks. I pre-seeded the ones I always forget: 18789 is the OpenClaw gateway, 11434 is Ollama, plus the usual 3000/5173/8000 dev-server suspects. Those defaults get written out on first run, so the table reads like a map of my own machine instead of a wall of bare port numbers.

Killing is deliberately friction-y in exactly one place. Hit Kill on a row and you get a modal — "Kill asus_framework — PID 10340 on port 1043?" — with Cancel and Kill buttons. One process, named, confirmed, then gone. After a successful kill the table rescans immediately so you see the port disappear. That's the entire design philosophy: never let me fat-finger a fleet-wide kill again.

The stack is plain Electron with a strict main/renderer split, no framework on the renderer side, and Node's built-in `node:test` for the test suite. No React, no bundler. For a single-screen utility that talks to PowerShell, that turned out to be the right amount of machinery.

## How it was built

I built this with Claude as a pair programmer using subagent-driven TDD. We brainstormed the spec, wrote a plan, and Claude implemented the modules test-first with separate reviewer passes. The spec and plan live in `docs/superpowers/`. I played the finished build live before signing off.

The architecture is four small, testable modules behind the Electron process boundary. `portScanner.js` runs a PowerShell script that builds a process map from `Get-Process`, walks `Get-NetTCPConnection -State Listen`, and emits one normalized JSON row per connection — `{port, pid, processName, exePath, state, startTime}` — which the Node side parses, dedupes by port, and sorts. `killer.js` shells out to `taskkill /F /PID` and classifies the result into ok / access-denied / not-found / error by inspecting the output text. `labels.js` persists the custom labels to a JSON file in Electron's userData directory, falling back to the seeded defaults if the file is missing or corrupt. `admin.js` asks Windows whether the current process holds an elevated token.

Everything crosses the process boundary through context-isolated IPC — channels like `scan-ports`, `kill-pid`, `load-labels`, `save-label`, `is-admin`, and `relaunch-admin` — with the renderer talking only to a narrow preload bridge. The renderer never touches Node or PowerShell directly. The payoff of that split is the test suite: 21 unit tests across four files, all running against the pure logic functions with injected runners, no Electron and no real PowerShell needed to test the parsing, classification, and label logic.

## The gotchas

**Some ports point at SYSTEM, and you can't kill those without elevation.** A normal-user ClawPorts can see PID 4 (`System`) sitting on ports 139, 445, and friends, but `taskkill` against them returns "access is denied." That's why `killer.js` doesn't just report success or failure — it classifies the failure, so the UI can tell "access denied, you need admin" apart from "that PID is already gone." The fix on the UX side is the admin path: `admin.js` checks the elevation token via a WindowsPrincipal role check, and the top bar shows a green ADMIN badge when elevated or a "Run as admin" button when not. That button relaunches the app through a UAC prompt (`Start-Process -Verb RunAs`), and the elevated instance can finally kill the protected PIDs.

**A blanket kill is the bug, so the killer had to be deliberately narrow.** The whole project exists because `taskkill /F /IM <name>` matches by image name and hits every matching process. ClawPorts only ever kills by PID — `taskkill /F /PID <n>`, one process, the exact one you confirmed in the modal. The scanner dedupes rows by port so a process listening on several ports doesn't fill the table with noise, but the Kill action is always scoped to the single PID on that single row. Removing the convenience of "kill them all" was the entire feature.

**The port-to-process join has to survive missing data.** Pulling listening ports is easy; reliably naming the process that owns each one is where it gets fiddly. A process can vanish between when you list connections and when you ask for its details, and `StartTime` and `Path` can throw for protected processes even when the process is alive. The scanner wraps those property reads in try/catch inside the PowerShell itself (falling back to empty strings and null), and the Node parser coerces every field so a half-populated row never crashes the table. The result is that even SYSTEM rows render cleanly — you see the port, you see PID 4, and you understand why the Kill is going to need admin.

## What shipped

v1 is complete and live on my machine. The full loop works end-to-end: a real scan found 66 listening ports, the kill path confirmed killing a throwaway Python listener, and the GUI launches clean. The test suite is 21 unit tests across the scanner, killer, labels, and admin modules. There's a `scripts/install-shortcut.ps1` that drops a ClawPorts shortcut on the desktop pointing at the bundled Electron binary, so it launches like any other app.

This is a personal build — it lives in its own git repo on my machine and runs with `npm start`; there's no public download. The obvious v2 ideas are written down and out of scope for now: showing outbound and established connections, grouping rows by process, copy-PID and open-in-browser shortcuts, and a packaged installer. For v1 I wanted exactly one thing, and I got it: a port list I can read and a kill button I can't accidentally point at everything.

This is part of an ongoing series on projects built this way. The running list is on the [projects page](/projects/).
