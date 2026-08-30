---
title: 'SiteSignal: Weather Alerts as an API, and the Bug That Billed Nothing'
description: >-
  Signed webhook alerts and workability scores for field-service software — plus
  the idle dashboard tab that burned 2,487 requests overnight doing nothing.
pubDate: 2026-08-30
tags:
  - api
  - weather
  - vercel
  - saas
project: sitesignal
heroImage: /images/sitesignal/hero.png
draft: true
---

I already had a weather app for contractors. What I didn't have was the version other people's software could buy. SiteSignal is that: a weather-intelligence API that field-service platforms integrate, so their users get "gusts hit 32 mph at 123 Main St" or "tomorrow is a no-go for roofing" without anyone building a weather stack.

It's live at [sitesignal-beryl.vercel.app](https://sitesignal-beryl.vercel.app), verified end to end in production, and it shares no runtime, repository or database with the consumer app it grew out of.

## The shape of it

Register a customer, get a key. Register job sites by latitude and longitude — the timezone resolves automatically. Attach rules to sites. Point a webhook endpoint at your server. Then a sweep runs every ten minutes and fires signed events when conditions cross your thresholds.

```bash
curl -X POST $BASE/v1/rules -H "Authorization: Bearer ss_live_..." \
  -H "content-type: application/json" \
  -d '{"site_id":"site_...","type":"wind_gust_over","params":{"mph":30}}'
```

Six rule types, each with episode-keyed deduplication so a three-hour storm produces one alert rather than eighteen. Alongside the push side there are query endpoints: `/v1/workability` returns a score, a verdict, a confidence level and the per-factor deductions behind it; `/v1/conditions` returns decision-ready current weather.

Webhooks are HMAC-signed over `timestamp.body` with an `X-SiteSignal-Signature` header, so the receiver can verify both authenticity and freshness. Upstream calls are deduplicated onto roughly 0.1° location tiles, because a hundred job sites in one metro should not be a hundred forecast fetches.

The trade nuance is the part I'm proudest of. During the production end-to-end run, a site at 88°F returned an overall workability score of 100 — genuinely fine weather — while roofing specifically came back NOT RECOMMENDED, because roof surface temperature is not air temperature. A single score would have been wrong for the one trade that most needed the answer.

## The metering bug

This is the story worth telling.

A day after shipping the self-serve dashboard, an **idle browser tab burned 2,487 requests overnight** — about 2.5% of a monthly quota — while displaying a page nobody was looking at. The dashboard polled every 30 seconds for usage stats, and every poll counted against the customer's billable quota. The product was billing people for asking how much they'd been billed.

Two fixes, and the split between them is the design lesson.

The first is client-side and obvious: only poll when `document.hidden` is false. A background tab has no reason to refresh anything.

The second is the real one. Management and CRUD endpoints — sites, rules, webhooks, deliveries, usage, test — now meter into a **separate monthly bucket** (`YYYY-MM-mgmt`) via `requireAuth(..., { billable: false })`. They're still rate-limited, so they can't be abused, but they can never consume quota or be blocked by it. Only `/v1/workability` and `/v1/conditions` are billable.

The principle: **the quota prices the weather intelligence, not the bookkeeping.** A customer who lists their own webhooks fifty times has cost me nothing worth charging for. No schema migration was needed, incidentally, because the meter function already took arbitrary bucket strings — a small piece of earlier generality that paid off. Verified in production afterwards: three management calls left the billable counter frozen and moved the management counter by three; one conditions call moved billable by one.

## The self-graded scorecard

`GET /v1/accuracy` is a public, CORS-open endpoint that reports how well SiteSignal's own forecasts have done.

Every night at 22Z, inside the existing cron, it snapshots tomorrow's forecast high and rain call for each site tile — taken from the sweep's own forecasts, so it costs zero extra upstream calls. The next night it grades them observations-first: pull the METAR series from the nearest station, take the actual high, and read rain from measured precipitation or the text description. Precipitation sensors are frequently null, so each result records its own basis — `obs`, `mixed`, or a model fallback — and the endpoint says which.

It returns 200 with `siteDays: 0` before any data exists rather than 404, which is a small contract decision that mattered: the consumer app polls it and lights up automatically when real numbers appear, with no coordination between the two codebases. And the whole scorecard tick is wrapped so a failure in grading can never break alert delivery. Grading your own accuracy is a nice feature; it is not more important than the alerts.

## The deployment gotcha that 500s everything

Vercel's Node builder transpiles TypeScript per-file and preserves ESM `import` statements as written. If your relative imports lack explicit `.js` extensions, every function returns `FUNCTION_INVOCATION_FAILED` — not one, all of them. The fix is `"type": "module"` in package.json, `NodeNext` module resolution in tsconfig, and `.js` on every relative import path even though the files are `.ts`. It looks wrong. It is correct.

Two smaller ones: Vercel project names must be lowercase, and the stable production URL is the `-beryl` alias — the `-bsymbolic` one 302s.

## Where it stands

v1 shipped and was verified against production end to end: customer and key bootstrap, site creation with automatic timezone resolution, a webhook tunnelled to a local receiver, a valid signature on `/v1/test`, a real rule firing from live Open-Meteo data, a signed event delivered with attempt 1 returning 200, a second sweep correctly firing zero on dedupe, and workability and conditions both returning real data with the roofing nuance intact.

The self-serve dashboard shipped the same day — signup, key reveal, site and rule management, usage metering, and a "Check conditions now" demo panel — followed by the accuracy endpoint and a developer docs portal at `/docs`. The suite is 108 tests, including an opt-in live harness that runs against real Supabase and real NWS data and cleans up after itself.

What's next is not code. It's a field-service pilot customer, delay reports, and Stripe — the last of which is gated on an Open-Meteo paid plan, because the free tier's terms don't cover reselling. Knowing that gate exists before writing the billing code is worth more than the billing code.

More projects built this way are on the [projects page](/projects/).
