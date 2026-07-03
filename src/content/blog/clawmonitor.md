---
title: 'ClawMonitor: A Neon Synthwave System Bar That Watches My Dev Stack'
description: >-
  How I built ClawMonitor — an always-on-top synthwave system bar for Windows
  that shows CPU/RAM/GPU plus the up/down health of my whole dev stack.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - electron
  - windows
  - monitoring
  - ai
project: clawmonitor
heroImage: /images/clawmonitor/hero.png
draft: false
devtoId: 4056015
---

I wanted to glance up and know, without thinking, whether my machine was on fire — and whether the four background services I actually depend on were still alive. Task Manager makes you go looking. A widget cluttered the desktop. So I built ClawMonitor: a slim, frameless, always-on-top bar pinned to the top edge of the screen, synthwave-styled, that shows CPU / RAM / GPU / network / disk at a glance and — the part no other monitor does — the live up/down status of my dev stack. It's the neon sibling of [ClawPorts](/projects/), built the same way.

## What it is

ClawMonitor is a single horizontal strip docked to the top of my primary monitor. Left side: CPU %, RAM %, GPU % and temp, network throughput, disk usage. Right side: a row of colored dots for my stack — a local gateway on `:18789`, WSL, Docker, and Ollama on `:11434` — green when up, dim when down. The look is classic synthwave: cyan / magenta / purple / green neon on a near-black grid, Cascadia Code throughout.

Hover anywhere on the bar and a three-tile panel slides down: per-core CPU bars and the top processes by load, full GPU detail (VRAM, power draw, fan), RAM with the WSL `vmmem` share broken out, and a "Your Stack" tile that spells out each service's port and state. When something redlines — CPU or GPU over 90%, a temperature over 80°C, a disk under its free-space floor, or the gateway going down — the relevant slice pulses red. The whole thing is **click-through**, so it never blocks the apps underneath, and it **reserves screen space** like the taskbar so maximized windows start below it instead of getting covered.

It's built, public, and installed on my machine. The repo is on [GitHub](https://github.com/denrod25-del/ClawMonitor) (MIT), there's a [landing page](https://denrod25-del.github.io/ClawMonitor/) with a live interactive recreation of the bar, and v0.1.1 ships as an unsigned NSIS installer.

## How it was built

Same loop as the rest of these projects: I decided what it should be, Claude wrote nearly all the code as a pair programmer. We brainstormed a spec, turned it into an 18-task plan across milestones, and Claude implemented it test-first with separate reviewer passes. I played the finished build live before signing off. The spec and plan live in `docs/superpowers/`.

The stack is **Electron + [`systeminformation`](https://github.com/sebhildebrandt/systeminformation)**, with Vitest for the test suite (35 unit tests). The architecture has a hard split across the Electron process boundary. The main process is a **modular collector orchestrator**: small readers — `cpu`, `memory`, `gpu`, `disk`, `network`, `sensors`, `stack` — each return a normalized slice. The renderer is a frameless transparent page that draws the bar and panel *purely* from the latest snapshot pushed over IPC. The UI holds no logic of its own; it's a view of one data object.

The collectors run on two tiers. A **fast tier** (default 2s) polls the cheap load metrics. A **slow tier** (default 8s) polls stack health, because asking whether four services are up involves HTTP probes and `tasklist` and doesn't need to fire twice a second. Every collector is wrapped in a timeout so one slow or failed reader can never block the rest — it degrades that slice to `null` and the merged snapshot carries on. That `mergeSnapshot` step is deliberately forgiving: a failed reader becomes a `null` field plus an entry in an `errors` map, never a thrown exception that blanks the whole bar.

## The interesting decisions

**A click-through window gets no hover events, so the hover panel is driven from the main process.** The bar is set to `setIgnoreMouseEvents(true)` so clicks pass straight through to whatever's underneath — which is exactly what you want from an always-on overlay, but it also means the DOM never sees a `mouseenter`. So the panel isn't CSS hover at all. The main process polls `screen.getCursorScreenPoint()` every 120ms, decides whether the cursor is over the bar, and tells the renderer to open or close the panel over IPC. Hover behavior, reimplemented by hand, because the obvious mechanism is unavailable the moment you make the window click-through.

**Reserving screen space is a Win32 call, and it leaks if you're not careful.** To make maximized apps sit below the bar instead of being covered, ClawMonitor registers as a Windows AppBar — `SHAppBarMessage` from `shell32`, reached through the [`koffi`](https://koffi.dev/) FFI library because there's no Electron API for it. That reserves the top 34px (in physical pixels, so it has to multiply by the display's scale factor). The trap: if the app force-quits or crashes, Windows does *not* reclaim that reservation, and a naive relaunch *stacks* a second one on top — 34px becomes 68px becomes a growing dead gap at the top of every screen. The fix is to persist the window handle to disk and, on startup, remove the previous reservation before registering a fresh one, so it self-heals across restarts. (A force-killed dev build can still leak against a separately-installed copy, since they keep separate state — recoverable with a one-line `SystemParametersInfo` work-area reset.)

**Windows hides CPU temperature from normal apps.** `systeminformation` simply can't read CPU package temp on my box — the ACPI sensor returns null. The honest answer is that you need a kernel-level sensor driver, so ClawMonitor's `sensors` collector reads from **LibreHardwareMonitor**: if you run LHM with its remote web server on, the collector fetches `localhost:8085/data.json` and parses out the CPU core temp. If LHM isn't running, the field just hides and everything else works. GPU temperature is the easy case — `systeminformation` returns it out of the box (it shells out to nvidia-smi internally), no extra driver needed. I'd rather show "no CPU temp" honestly than fake a number.

**The dev-stack tile is the whole reason it exists.** A normal monitor tells you the box is busy. It can't tell you *why* — that your local gateway died, or that WSL's `vmmem` is the thing eating your RAM. The `stack` collector probes each service its own way: an HTTP `GET` to the gateway and to Ollama, `docker ps` for Docker, and a `tasklist` filter that sums the `vmmem` / `vmmemWSL` processes to show WSL's actual memory footprint. Four heterogeneous health checks, normalized into the same up/down shape the bar renders as dots. That's the differentiator — it watches the stack, not just the silicon.

## What shipped

v0.1.1 is built, tested, and installed. The bar renders live at the top of my primary monitor with stable CPU / RAM / GPU+temp / network / disk plus the WSL / gateway / Docker / Ollama dots; the hover panel slides down on cursor-tracking; alerts pulse on redline; the AppBar reserves space and self-heals across restarts. The suite is 35 unit tests across the collectors, the merge/timeout orchestration, the alert logic, and config. It's public on [GitHub](https://github.com/denrod25-del/ClawMonitor) under MIT with a landing page, contributor docs, and an unsigned NSIS installer in Releases.

The honest caveats: the installer isn't code-signed yet, so SmartScreen warns on first run (signing is a to-do). It's Windows-only — the Electron + `systeminformation` foundation is cross-platform, but the AppBar and the WSL tile need platform-specific work, so a Linux port is realistic but unstarted. And v1 is read-only: it shows you the stack, it doesn't yet let you start or stop a service from the bar. That, plus history graphs, is the v1.1 wishlist.

This is part of an ongoing series on projects built this way. The running list is on the [projects page](/projects/).
