---
title: 'CodeType: A Typing Trainer Built for Code, Not Prose'
description: >-
  Building a Monkeytype-style typing trainer for real code — brackets, symbols,
  and indentation — in React and TypeScript. Plan 1 (the core test) is done.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - typescript
  - react
  - typing
  - prototype
project: codetype
draft: true
---

Every typing trainer I tried teaches you to type English. You race through "the quick brown fox" and watch your words-per-minute climb, and none of it helps when you sit down to write actual code, because code isn't words. It's `const`, `=>`, `})`, four spaces of indentation, and a semicolon you forget half the time. So I started building CodeType: a typing trainer that drills the thing I actually need to get faster at, which is typing code. I'm early in learning to program, and I wanted the practice to match the work. Claude is my pair programmer on this — I decide what it should be, it writes most of the code — and the first of four planned releases is done.

## What it is

Code-typing is a different problem from prose-typing, and the difference is mostly the keys you never use writing English. Brackets and braces come in pairs you have to close. Symbols like `=>`, `&&`, and `!==` are muscle memory you don't build typing sentences. Indentation is structural, not decorative. And the rhythm is different: you don't flow left-to-right and wrap — you stop at the end of a line, hit Enter, and land at the right indent on the next one.

CodeType is, roughly, "Monkeytype but for code." You get a snippet of real code in a panel that looks like a little editor — a filename tab up top (`main.py`, `main.js`, `index.html`, `Main.java`), your live WPM and accuracy beside it — and you type it character for character. Each character lights up green when you get it right and red when you don't. There are four languages so far (Python, JavaScript, HTML/markup, and a C-like bucket that covers Java) and two modes: a timed test (type as much as you can in 30 seconds) and a fixed-line-count test. No login, nothing saved to a server yet — it all runs locally in the browser. The differentiator I'm building toward is adaptive coaching that watches which characters trip you up and drills those specifically, but that's a later plan. Right now it's the core test, done properly.

## How it's being built

The stack is React 19, TypeScript, Vite, and Tailwind v4, with Zustand for state and React Router for the handful of screens. Tests are Vitest plus React Testing Library. The planned backend is Supabase, but none of that exists yet — Plan 1 is deliberately local-only.

I'm building it in four sequential plans, each one shippable on its own:

1. **Core typing test** — the local, no-account version. **Done**, merged 2026-05-18.
2. **Coaching engine** — a weakness profile plus adaptive drills. The differentiator. Not started.
3. **Accounts and cloud sync** via Supabase. Not started.
4. **Progress dashboard** — charts, a keyboard heatmap, streaks. Not started.

The reason for the order is that each plan leaves something I can actually use. After Plan 1 I have a working trainer; I don't need accounts to start practicing.

Plan 1 itself is built around a small, pure typing engine that has nothing to do with React. `buildSession` turns a code string into typing state, `applyKey` advances that state one keystroke at a time without mutating the old one, and `computeResult` turns the finished state into WPM and accuracy. Keeping that logic framework-free meant it could be unit-tested directly — the engine, the snippet library, and the countdown hook all have their own test files — and the React layer just renders whatever the engine returns. The pieces went in one at a time: snippet data, then types, then the engine, then the Zustand store wrapping it, then the components (`CodeView`, `StatsBar`, `Controls`), then the screens. Each was a separate commit, several with a reviewer pass before merge.

## The gotchas

Three things about code specifically turned out to be harder than they looked, and all three are about the keys prose-typing ignores.

**You can't type indentation, so the app types it for you.** The obvious idea — make the user type the leading spaces on each line — falls apart immediately, because the Tab key doesn't insert a tab in a browser; it moves focus to the next element. Even if you capture it, asking someone to hammer the spacebar four times at the start of every indented line is miserable and teaches nothing. So `buildSession` computes an `auto` array: it walks the target string and flags every space that sits at the start of a line. Those positions auto-complete — the cursor skips straight over them — so you only ever type the code that carries meaning. Backspace skips back over them too, so you can't get stranded inside whitespace you never typed. As a bonus, Tab was free, so I repurposed it: pressing Tab (or Escape) restarts the test with a fresh snippet.

**Auto-completed indentation can't count toward your score, or the numbers lie.** Once the app is filling in indentation for you, those characters can't be in your WPM and accuracy, or you'd get credit for keystrokes you never made — and a heavily-indented Python snippet would inflate your speed over a flat one. So `computeResult` skips every `auto` character when it counts typed and correct characters. WPM is the standard "correct characters ÷ 5 ÷ minutes," but only over characters you actually typed, and accuracy is correct-over-typed on the same basis. I also split it into net and raw: net accuracy is over the final state of each position, raw accuracy is over every keystroke including ones you backspaced and fixed. For code, where you fix a mismatched bracket a lot, the gap between those two numbers is genuinely informative.

**A timed test that starts on load punishes you for reading.** The first version started the 30-second countdown the moment the screen loaded. But with code you read before you type — you scan the snippet, find the indentation, figure out where the brackets close — and the clock was eating that time, sometimes expiring before the first keystroke and reporting garbage. The fix was to start the countdown on the *first real keystroke* instead of on load (Backspace doesn't count), so the timer measures typing, not reading. While I was in there I also blocked paste on the typing area — it's a typing trainer; pasting the snippet in is cheating yourself.

## Where it's at

Plan 1 is complete and merged: the core local typing test, four languages, two modes, live and final stats, auto-indentation, and the paste block, all behind a unit-tested engine. It's a private repo for now and runs locally with `npm run dev`. There are no screenshots in this post yet because the build is plain enough that I'd rather show it once it has the coaching layer that makes it worth looking at.

What's left is the part that makes CodeType more than a clone: Plan 2's coaching engine, which turns the per-keystroke data the engine already records into a weakness profile and drills your worst characters. Then accounts, then a dashboard. A couple of things got deferred out of Plan 1 on purpose — syntax highlighting (I want to wire in Shiki later) and folding some of the test screen's local state into the Zustand store. I'm writing each plan only when I reach it, so it reflects what actually got built rather than what I guessed up front. This is an early build of a project I'm using to get better at the thing I'm building it with, which feels about right.
