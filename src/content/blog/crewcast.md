---
title: 'CrewCast: The Weather App That Grades Its Own Forecasts'
description: >-
  A job-site weather app for contractors — 15 trade profiles, model-agreement
  checks, a self-verifying scorecard, and the service worker that never
  deployed.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - weather
  - pwa
  - javascript
  - ai
project: crewcast
heroImage: /images/crewcast/hero.png
draft: false
---

Every weather app tells you it's 86°F and clear. None of them tell you whether you can pour concrete today. CrewCast does: a job-site weather app for contractors and outdoor trades, live at [stormradar.vercel.app](https://stormradar.vercel.app), built around one question — *is this workable?* — and a lot of machinery devoted to being honest about how confident it is.

## What it does

The Today screen leads with a **job-site score** out of 100 and a plain-language briefing: "Currently 86°F and workable. Dry through the afternoon — a good window for most outdoor trades." Under it, a best-work-window line and a per-trade breakdown.

There are **15 trade profiles** — concrete, roofing, plumbing, painting, excavation, HVAC, landscaping, pressure washing, windows, electrical, tree work, solar, pest, asphalt and moving — each a small function evaluating current conditions into go / caution / no-go with a reason. Adding a trade is one definition plus one button. A contractor can also opt into a push notification the evening before a no-go day for their trade.

Beyond that: radar with a scrubber and NEXRAD tiles, precipitation nowcast, hurricane tracking from the NHC, NWS alerts with a contractor-focused recommended action per alert type, a printable weather-delay report with per-cause breakdown and official alert history, and a true PDF export rendered server-side.

Everything runs on free, mostly public-domain sources: NWS, NOAA, NHC, NEXRAD via RainViewer, Open-Meteo, USGS and NASA EONET.

## The trust pack

The distinguishing feature isn't a forecast. It's the layer that tells you how much to believe one.

**Model agreement.** The forecast is fetched from GFS, ECMWF and ICON simultaneously and compared. The briefing carries a line like "Models disagree (GFS · ECMWF · ICON): 2 of 3 show rain, 1 of 3 show storms, temp spread 3°." Disagreement caps the displayed confidence — a split forecast can't be High confidence, no matter how nice the average looks.

Tuning this was instructive. The first version flagged all seven days as split, because a 49% versus 52% rain probability counted as disagreement. It isn't. The criterion became a genuine gap — one model above 60% while another sits below 40%, or a temperature spread over 8° in the near term. Florida in August still comes back genuinely split five days out of seven, which is the correct answer.

**Station observations.** The app pulls the actual current temperature from the nearest NWS station and shows it — "Observed 88° at KDJT · 24m ago" — flagging in amber when the model and the thermometer disagree by 5°F or more.

**A self-verification scorecard.** Every day the app snapshots its own next-day high and rain call, then grades itself the following day against station observations where the sensors cooperate and model actuals where they don't, keeping a rolling 30. It says which basis it used. It also shows "collecting — N of 3" until it has enough results to say anything, rather than displaying a meaningless percentage on day one.

**A lightning all-clear timer** with an honest scope note: it runs a 30-minute countdown driven by NWS signals and storm codes, and states plainly that it is not strike data, because no free real-time strike feed exists.

Alongside those: the forecasters' own reasoning pulled from the NWS Area Forecast Discussion, and SPC convective outlooks resolved by a hand-rolled point-in-polygon test against the day-1 through day-3 GeoJSON.

And running through all of it, wording chosen to be defensible. Not "safe to work" but "likely workable." Every score card carries "Guidance, not a safety guarantee — verify on site," and a safety page that says plainly the NWS is authoritative and OSHA wins.

## The gotchas

**The service worker had never been deployed, so push was broken on every platform.** This is the worst bug in the project's history and it was invisible for weeks. Each frontend deploy copied only `index.html` into the deploy directory. `serviceWorker.register('/sw.js')` therefore 404'd, silently, and Web Push simply did not work — not just on iOS, everywhere. The fix was adding `sw.js`, a manifest and three icons, and the durable lesson is that a deploy step which copies *a* file rather than *the directory* will eventually ship a broken app that looks fine. (The iOS-specific reality is separate and also real: Safari tabs don't expose push at all, so the app now detects iOS-not-standalone and shows Add to Home Screen instructions instead of a dead toggle.)

**A mapped colour sweep will eat your data colours.** Restyling the app from navy-and-cyan glassmorphism to industrial charcoal-and-safety-orange meant 141 scripted replacements across the source. It worked — and it also recoloured the Saffir-Simpson hurricane scale, where tropical-storm cyan collided with category-2 orange. Data ramps are not brand palette. Water-blue for humidity and rain bars was kept deliberately for the same reason. If you sweep colours by literal value, semantic colours are collateral damage.

**Official alert history needs two endpoints and real marine filtering.** Pulling historical NWS alerts for the delay report means hitting *both* IEM archives: storm-based polygon warnings, where severe thunderstorm, tornado and flash flood warnings actually live, and the zone/county endpoint for watches and advisories. Then merge and dedupe. And filtering marine noise takes more than excluding one phenomenon code — a coastal job site drowns in Small Craft Advisories unless you filter the whole marine set plus the marine zone UGC patterns. Verified against a known event: a Severe Thunderstorm Warning at a specific West Palm Beach location appears exactly once, at the right time, with zero marine leakage.

**Background tabs break animation timing.** A bottom sheet used `requestAnimationFrame` to add its open class. rAF is throttled in background tabs, so the sheet became `display: flex` while staying translated off-screen — visible as a dead grey area. Replaced with a forced reflow and a synchronous class add.

**International users were being silently misled.** A test from London revealed the app degrading quietly: NWS feeds fail outside the US, so the alerts panel would have shown "✅ No Active Alerts" — which abroad is not merely wrong but dangerous. Now the app detects coverage two ways and, outside the US, shows a notice explaining that forecasts and radar work fine while warnings and push are US-only, and replaces the all-clear with "🌍 Official warnings unavailable here."

## Where it stands

Live, rebranded from StormRadar to CrewCast after a trademark collision, with a marketing landing page, seven legal and trust pages, seven SEO landing pages, a sitemap and security headers. The source was refactored out of one enormous HTML file into 26 modules with a build step and a proven byte-exact round trip — the single-file version is now a build output that should never be hand-edited.

Honest caveats: it's imperial units only, real internationalisation is deliberately not built, and monetising it requires clearing three licensing gates — an Open-Meteo paid plan, a RainViewer commercial agreement or a swap to public-domain NEXRAD tiles, and a basemap plan. Knowing where those gates are is itself part of the work.

One thing this post can't hide, since the screenshot above was taken with the theme pinned: the automatic daylight theme has a race where the page background stays dark while the cards flip light. That's the next fix.

More projects built this way are on the [projects page](/projects/).
