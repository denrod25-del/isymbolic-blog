---
title: "OSIRIS Water Layer: Putting Live US Water Quality on an OSINT Map"
description: "I extended OSIRIS, an open-source OSINT dashboard, with a live US water-quality layer — USGS ambient sensors and EPA drinking-water violations on the map."
pubDate: 2026-06-12
tags: [osint, water, dashboard, api]
project: osiris-water
draft: true
---

[OSIRIS](https://github.com/simplifaisoul/osiris) is an open-source OSINT dashboard — a MapLibre globe that aggregates live flight tracking, earthquakes, fires, CCTV networks, and a couple dozen other intelligence feeds into one GPU-rendered map. It had layers for almost everything happening on the planet except the thing coming out of your tap. So I forked it and added one: a US water-quality layer that plots real USGS sensor readings and EPA drinking-water violations on the same map. The dashboard, the globe, and the 16 existing layers are [simplifaisoul](https://github.com/simplifaisoul)'s work — I want to be clear about that. What I built is the new ENVIRONMENT layer category and the live data plumbing behind it.

## What it is

OSIRIS is built on Next.js 16 and MapLibre GL, and its whole design is "real-time entities rendered via WebGL, fetched on demand when you toggle a layer on." Each layer is a category in a side panel with a live entity count. My addition is a new ENVIRONMENT category with three layers:

- **Ambient Water** — live USGS NWIS sensors across the US, graded on dissolved oxygen, pH, nitrate, and turbidity.
- **Drinking Water** — public water systems with active EPA violations.
- **Air Quality** — I also wired up the repo's orphaned air-quality route, which now pulls PM2.5 from a keyless source.

The grading is deliberately simple and honest. A sensor's status is **worst-wins**: I grade each measured parameter Good / Moderate / Poor against published thresholds (nitrate over 10 mg/L as N is the EPA drinking limit, pH outside 6.0–9.0 is Poor, dissolved oxygen under 2 mg/L is critically low), and the station takes the color of its worst reading. No measured parameters means Unknown, not a green dot — I'd rather show a gap than fake a clean bill of health. The scoring lives in `src/lib/water-quality.ts` as a pure, I/O-free function, which made it trivially unit-testable; the layer ships with 20 vitest tests.

The data sources are not mine and deserve credit: **USGS** for the live ambient sensor network (the [NWIS instantaneous-values service](https://waterservices.usgs.gov)) and **EPA ECHO** for drinking-water violations (the SDW REST services). My layer just reads them, grades them, and paints them.

## How it was built

The ambient side was the easy half. USGS exposes an instantaneous-values JSON API, and the trick to covering the whole country in parallel is to fan out by **hydrologic unit** rather than by state — the 21 top-level HUC regions (`01` through `21`) tile the entire US. I fire all 21 requests with `Promise.allSettled`, parse each site's most recent reading per parameter, dedupe by site ID, and hand the merged set to the grader. That route caches ambient results for 10 minutes. Live-verified, it returns about 1,500 ambient stations.

The drinking-water side, sourced from EPA ECHO, was where the real engineering went. ECHO's SDW endpoint is a two-step dance: `get_systems?p_st=XX` returns a QueryID, then `get_qid` streams back the actual water systems for that state. There's no national endpoint and no server-side "only violations" filter, so to cover the country you have to query all 51 state/DC codes and filter client-side for systems that actually have a violation flag.

Two things made that workable. First, **county-centroid geolocation** (see the gotchas — ECHO doesn't give you coordinates). Second, a **baked snapshot**: the full national fan-out takes minutes on a cold ECHO, which blows past any serverless function time limit, so the API serves a pre-generated `drinking-snapshot.json` (real stations, instant) by default, with the live fan-out extracted to its own module and reachable via `?live=1` for self-hosting or snapshot regeneration. A standalone tsx script regenerates the snapshot without needing a running dev server, and a monthly GitHub Action refreshes it from a clean IP and lets Vercel redeploy.

## The gotchas

Three real ones, each of which shaped the final design.

**EPA ECHO returns drinking-water systems with no coordinates, so I geolocate by county centroid.** This is the big one. The SDW data identifies a public water system by name and FIPS county codes — but no latitude or longitude. You can't plot a dot without a coordinate. The fix is a checked-in `county-centroids.json` (3,222 FIPS → [lat, lng] pairs derived from the 2024 Census Gazetteer): take the system's first FIPS code, look up the county centroid, and place the marker there. To keep dozens of systems in the same county from stacking into one unreadable blob, I add a small deterministic jitter (±0.05°) derived from a hash of the PWS ID — so the same system always lands in the same spot, but neighbors spread out. The honest caveat lives right in the code: these dots are county-accurate, not address-accurate, because that's the best the source data supports.

**A full 51-state parallel fan-out saturates ECHO, so I chunk it.** Firing all 51 state queries at once hammers the API — each `get_qid` can take 18–40 seconds on a cold cache, and ECHO rate-limits hard (~300 requests/hour). Naive `Promise.all` across every state either times out or gets throttled. The fix is to process states in **chunks of 6** with `Promise.allSettled`, so at most six requests are in flight at a time, each on a 60-second budget. `allSettled` rather than `all` matters here: one state timing out shouldn't sink the other five in its batch.

**Early-alphabet states were eating the global cap before the West got a turn.** Once I put a global cap on total stations (to keep the snapshot a reasonable size), I noticed Alabama, Alaska, and Arizona — processed first — could fill the entire budget before later states were even queried, leaving the western US blank. The fix is a **per-state cap** (200 violating systems each) underneath the global cap, so every state contributes its share and the map stays geographically balanced instead of front-loaded.

## What shipped

v1 is complete and merged. The ENVIRONMENT layer category — Ambient Water, Drinking Water, and Air Quality — is live, with the worst-wins grader, the county-centroid geolocation, the chunked ECHO fan-out, the baked-snapshot serverless strategy, and 20 vitest tests. It runs as a feature branch merged into my fork at [denrod25-del/osiris](https://github.com/denrod25-del/osiris), where I opened and merged PR #1.

The division of credit, one more time: OSIRIS — the dashboard, the globe, the WebGL rendering, and the existing intelligence layers — is simplifaisoul's open-source project. The live water data is USGS (ambient sensors) and EPA ECHO (drinking-water violations). My work is the water-quality layer that joins those feeds onto the map: the grading, the geolocation workaround, the fan-out, and the tests. An OSINT map that watches flights and fires now watches the water too.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
