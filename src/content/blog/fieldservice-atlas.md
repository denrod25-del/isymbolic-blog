---
title: "Atlas Field Service: Reskinning an Open-Source Scheduler and Adding a Dispatch Board"
description: "I took clawnify/open-fieldservice, a Preact/Hono/Cloudflare D1 scheduler, reskinned it ServiceTitan-style as Atlas, and added a drag-and-drop dispatch board."
pubDate: 2026-06-13
tags: [preact, hono, cloudflare, saas]
project: fieldservice-atlas
heroImage: /images/fieldservice-atlas/hero.png
draft: true
---

[open-fieldservice](https://github.com/clawnify/open-fieldservice) is an open-source field-service scheduler — a Preact front end, a Hono API, and a Cloudflare D1 database, billed as a self-hostable alternative to ServiceTitan or Jobber for pest control, HVAC, plumbing, and the rest. It ships with the full back office: jobs, a customer CRM, technicians, invoices, materials, a weekly calendar. What it didn't have was the one screen a dispatcher actually lives in all day — a board where you drag jobs onto technicians and watch the day fill up. So I cloned it, reskinned the whole thing ServiceTitan-style into "Atlas," and built that board. The scheduler, the API, and the data model are [clawnify](https://github.com/clawnify)'s open-source work — I want to be clear about that. What I added is the visual redesign and a new Dispatch board on top of the existing API.

## What it is

open-fieldservice is Preact + TypeScript + Vite on the front end, a Hono REST API on the back, and Cloudflare D1 for storage (the project migrated to a D1-native pattern via a `@clawnify/db` dual-binding adapter, so it runs on Wrangler locally and deploys to Cloudflare). The data model is what you'd expect from a field-service app: customers, jobs, technicians, service types, invoices, materials, plus job notes and checklists. The API exposes the lot over about thirty REST endpoints, and there's a `?agent` mode that swaps hover-to-reveal controls for always-visible buttons so an automation agent can drive it.

Atlas is two things layered on that base. The first is a reskin: a navy top app bar with a global search box, a navy sectioned sidebar (OPERATIONS up top, BUSINESS below), a Titan-blue (`#2f6fed`) accent, a KPI-card dashboard, and filled status pills instead of the original's bordered badges. The second, and the part I actually care about, is a new **Dispatch board** — technician rows crossed with a 7am-to-7pm timeline, where unassigned jobs sit in a left rail and you drag them onto a tech's track to assign and schedule them in one motion. Nothing about the database or the API changed; the board is pure front end reading the same endpoints the rest of the app already used.

## How it was built

The reskin was deliberately surface-level. I didn't fork the architecture — I changed the shell (top bar plus a column layout), the palette and the component CSS, and the dashboard's stat cards into KPI cards. The point was to make it look like a commercial product without touching anything load-bearing, so the upstream code stays mergeable and the diff stays legible. It landed as an `atlas-redesign` branch merged to local `main`, then a second pass of nice-to-haves merged after.

The Dispatch board (`src/client/components/dispatch-view.tsx`, route `/dispatch`) is the real addition, and the constraint I set was that it could not require any backend work. It reuses the existing `GET /api/schedule?start=D&end=D` to load a day's jobs and `PUT /api/jobs/:id` to assign and reschedule — that's it. The board renders active technicians as rows and the 7am-7pm span as a timeline; each assigned job is an absolutely-positioned block whose `left` is computed from its `scheduled_time` and whose `width` comes from its duration. Unassigned jobs live in a rail on the left.

Assignment works two ways on purpose. The primary path is HTML5 drag-and-drop: drag a job from the rail (or an existing block) onto a tech's track, and the drop handler reads the cursor's horizontal offset, converts it to a time snapped to the nearest 15 minutes, and fires `assignJob(jobId, techId, time)` — one gesture sets both the technician and the schedule. The fallback is click-to-assign: click a job to select it, then click a tech row, which assigns without moving the time. I kept the click path specifically because it survives `?agent` mode, where an automation agent can't reliably perform a drag.

Running it locally on Windows is its own small ritual, because this is a Cloudflare-stack app and I don't have pnpm installed globally. Two servers: Wrangler serves the API on 8787, Vite serves the UI (which lands on 5174 because 5173 was already taken), and D1 has to be seeded from `schema.sql` first. The npm `dev` script chains all of that with `concurrently`, but I ended up invoking the binaries directly — more on why below.

## The gotchas

Three real ones, each of which cost time.

**`pnpm exec` re-verifies the install and chokes, so I run the binaries directly.** Installing deps with `npx pnpm@latest install` works, but trying to launch the servers through `pnpm exec wrangler` / `pnpm exec vite` made pnpm re-run its install verification, and it choked on native builds it had skipped. The fix is to skip the wrapper entirely and call the binaries by path: `node node_modules/wrangler/bin/wrangler.js dev --port 8787` for the API and `node node_modules/vite/bin/vite.js` for the UI. Seed D1 the same way first: `node node_modules/wrangler/bin/wrangler.js d1 execute open-fieldservice-db --local --file=src/server/schema.sql`.

**The Vite proxy resolved `localhost` to IPv6 and every API call 404'd.** With the API on Wrangler and the UI on Vite, the dev proxy forwards `/api/*` to the back end. The proxy target was `localhost:8787`, but on this Windows box `localhost` resolves to IPv6 `::1` first, while Wrangler binds IPv4 `127.0.0.1`. So every `/api/*` request hit nothing and came back 404 — the app rendered but was completely data-blind. The fix was a one-liner in `vite.config.ts`: pin the proxy target to `http://127.0.0.1:8787` instead of `localhost`. It's the kind of bug that looks like a broken API and is actually DNS.

**"Today" is computed in UTC, so a behind-UTC clock lands on tomorrow.** This is a pre-existing quirk that runs through every date-aware screen, the Dispatch board included: "today" is derived from `new Date().toISOString()`, which is UTC. On a clock that's behind UTC (most of the US for part of the day), that rolls the board and the dashboard onto tomorrow's date. I left it as-is rather than papering over it in one component, because the honest fix is a single shared local-date helper used everywhere, not a one-off patch in the board — but it's worth knowing about if you toggle to the dispatch view and wonder why it's empty.

## What shipped

Atlas is merged to local `main`: the full ServiceTitan-style reskin (navy shell, sectioned sidebar, Titan-blue accent, KPI dashboard, filled pills) and the new Dispatch board with both drag-and-drop and click-to-assign, plus a global search dropdown in the top bar that filters across already-loaded jobs, customers, and invoices. None of it touched the schema or the API — the board is built entirely on the endpoints the upstream app already shipped, which is exactly what kept the change clean.

The division of credit, one more time: open-fieldservice — the Preact/Hono/D1 scheduler, the data model, and the thirty-odd REST endpoints — is clawnify's open-source project. My work is the Atlas reskin and the Dispatch board layered on top. A back-office scheduler now has the one screen a dispatcher actually wants to look at.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
