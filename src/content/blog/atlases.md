---
title: 'Atlases: 16 Interactive Learning Guides That Run Code in Your Browser'
description: >-
  How I built Atlases with Claude — 16 long-form technical guides with real
  in-browser sandboxes (SQLite, CPython, a live shell), quizzes, and dated
  facts.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - education
  - react
  - vercel
  - ai
project: atlases
heroImage: /images/atlases/hero.png
draft: false
devtoId: 4091127
---

Atlases is a learning site: 16 long-form technical guides, each one a 12-chapter deep dive that you read in a browser tab while running the actual thing in another pane of the same tab. The databases atlas ships a real SQLite engine. The Python atlas runs CPython. The C++ atlas compiles C++. Nothing is a screenshot or an animated GIF pretending to be a terminal — it's the real interpreter, downloaded to your browser and running locally. It's live at [atlases.vercel.app](https://atlases.vercel.app/), and I built it with Claude as a pair programmer.

## What it is

The pitch is "pick a topic, build the intuition." There are 16 atlases: Databases, Networking, Linux, Cryptography, Compilers, Observability, AI/LLM Engineering, FiveM/Lua/QBCore, Encoding & Wire Formats, Python, JavaScript, C++, C, Docker, n8n, and Coolify. That spread is deliberately personal — it's the stack I actually touch, from running a FiveM RP server to wiring up n8n workflows to deploying with Coolify, so the topics are the things I wanted a good reference for and couldn't find in one place.

Each atlas has the same 12-chapter spine: origin story, toolchain, the bedrock concepts, a working snippet library, a triage/troubleshooting section, and a roadmap of where to go next. That's 192 chapters across the site. What makes it more than a long blog is the interactive parts:

- **Real in-browser sandboxes.** SQLite via sql.js, CPython via Pyodide, C and C++ via JSCPP, a JavaScript REPL, a working mini-shell, a Lua interpreter for the FiveM atlas, and a live PromQL playground for observability. All client-side — there is no backend, no code execution server, nothing to attack. Your code never leaves the browser.
- **Curated snippet libraries** organized by what you're trying to do, not alphabetically.
- **Interactive troubleshooting trees** that walk you from symptom to diagnosis to fix.
- **A quiz at the end of every chapter,** with explanations rather than just a right/wrong.
- **Stack profiles** — pick your context and the examples adapt as you read.

No signup, no ads, no tracking. Progress saves to localStorage, so the site doesn't need to know who you are to remember where you were.

## How it was built

The stack is intentionally boring: Vite + React 18 + Tailwind, with `react-router-dom` for routing and `lucide-react` for icons. That's almost the whole runtime dependency list. Each atlas is a single self-contained `.jsx` file in `src/atlases/` — `db-atlas.jsx`, `python-atlas.jsx`, and so on — lazy-imported and code-split in `App.jsx` so you only download the atlas you open. The landing page in `src/pages/Landing.jsx` just lists them. Adding a new atlas is a three-step move: drop the file in `src/atlases/`, add a lazy route in `App.jsx`, add a card on the landing page.

The content pipeline matches the pattern I use for everything: I decided what each atlas should cover and how it should feel, Claude drafted the chapters, and then every claim got a human fact-check pass before it shipped. The sandbox engines are off-the-shelf WASM/JS interpreters wired into React components, so the heavy lifting of "actually run SQLite in a browser" is sql.js doing its job — my work was the glue and the teaching around it.

Deployment is the easy part. The repo is on GitHub at [denrod25-del/atlases](https://github.com/denrod25-del/atlases), and Vercel auto-deploys every push to `main`. A small `vercel.json` handles the SPA rewrites so deep links to a specific atlas resolve correctly. `npm run build` produces a `dist/` folder of static files that would deploy anywhere — Vercel just happens to be the zero-config option.

## The gotchas

**Facts about a fast-moving industry go stale, and a learning site that's wrong is worse than no learning site.** Several atlases make time-sensitive claims — the current frontier model lineup, the latest C++ and C standards, the current PostgreSQL and LLVM versions, whether OpenTelemetry's GenAI conventions are stable yet. Those were correct when written and rot quietly. My fix is twofold. First, every fast-moving claim carries an explicit "current as of June 2026"-style stamp right in the text, so a reader can see exactly how fresh the fact is instead of trusting it blindly. Second, refreshing those stamps is now a recurring maintenance task rather than a one-time thing. A single pass already caught real drift: the frontier model lineup needed updating to the current Opus / GPT-5.5 / Gemini lineup, OpenTelemetry's GenAI semantic conventions were still experimental (not stable, as an earlier draft implied), and the FiveM ecosystem's "Overextended" had been renamed to CommunityOx. The lesson: date your claims so the rot is visible, and treat the dates as a checklist.

**The site started out written for an audience of one.** The first versions were personalized to me — examples referenced my Claw World RP server by name, the Linux sandbox had a hardcoded username from my own setup, and asides assumed you were, well, me. Great for a private reference, useless as a public site. Before launch I did a de-personalization pass: pulled the RP-server references, renamed the Linux sandbox's example user (and updated the challenge checkers that validated against that username — easy to miss, would have broken the exercises), and rewrote the personal asides into something a stranger could follow. If you build a tool for yourself and later want to share it, budget real time for stripping out the assumptions you didn't know you'd baked in.

**Deep links break on static hosts unless you tell the host about your router.** Because each atlas is a client-side route, hitting `atlases.vercel.app/db` directly — or refreshing on it — asks Vercel for a file that doesn't exist on disk, which is a 404. The fix is the SPA rewrite in `vercel.json` that points every unknown path back at `index.html` and lets React Router sort it out. It's a one-liner, but it's invisible until someone shares a deep link and it 404s for everyone who clicks.

## What shipped

Atlases is live and public at [atlases.vercel.app](https://atlases.vercel.app/), with the source on GitHub at [denrod25-del/atlases](https://github.com/denrod25-del/atlases) under an MIT license. Sixteen atlases, 192 chapters, real in-browser sandboxes for SQLite, CPython, C/C++, JavaScript, a shell, Lua, and PromQL, a quiz per chapter, troubleshooting trees, and dated facts you can audit. No signup, no ads, no tracking — just open a topic and start reading.

This is another entry in the series on projects built this way. The running list is on the [projects page](/projects/).
