---
title: 'ScamWatch: Building a Scam-Intelligence Platform That Refuses to Exaggerate'
description: >-
  A public-benefit platform to check links, numbers and messages before you
  click — with calibrated confidence, a moderation gate, and de-identified
  reports.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - nextjs
  - supabase
  - security
  - ai
project: scamwatch
heroImage: /images/scamwatch/hero.png
draft: false
---

The gap in consumer scam tools isn't detection. It's explanation. Plenty of things will tell you a link is bad; almost nothing tells you *why*, or admits when it doesn't know. ScamWatch — "Know Before You Click" — is my attempt at the other version: paste a suspicious link, phone number, email or message, and get a transparent, calibrated risk explanation, with a route to the official body that actually handles that kind of fraud.

It's live at [scamwatch-seven.vercel.app](https://scamwatch-seven.vercel.app). Launch market is Florida, then the US, then wider.

## The nine rules

Before any code, the project got a 20-volume product requirements document — around 113,000 words — with a locked shared context and nine product principles that every feature has to survive:

1. Explain before warning. 2. Respect victims. 3. Protect privacy. 4. Keep core education free. 5. Be transparent. 6. **Never exaggerate.** 7. Always route to official verification. 8. Build trust before growth. 9. Every feature prevents real-world harm.

Number six is the one that keeps showing up in the code. The homepage carries no invented metrics — no "2.4 million scams blocked," because that number doesn't exist. The classifier is allowed to abstain. And a verdict derived from a model with no community reports behind it gets **downgraded to "Use Caution" and capped at 0.7 confidence**, because a model's opinion is not a report. "Confirmed Reported Scam" requires actual reports from actual people. That rule lives in `deriveVerdict.ts` and it's the heart of the product.

## How the loop closes

Search is the read half: `canonicalize.ts` detects and normalises phones, URLs, domains, emails, wallets and handles; `lookup.ts` checks the database for community signal, calls the classifier, and derives a verdict, degrading gracefully at every step. Without an OpenAI key the classifier fails closed and abstains rather than guessing.

Reporting is the write half, and it's more interesting. A three-step wizard feeds `submit.ts`, which **de-identifies before it persists** — `deidentify.ts` redacts Social Security numbers and Luhn-valid card numbers while deliberately keeping the scam indicators, because a report stripped of the phone number is useless. Anonymous submissions run server-side through a service-role client that's `server-only`-guarded so the key can never bundle into client JavaScript, which means the database needs no anonymous insert policy at all.

Then a worker picks it up. `processReport` claims the report, strips EXIF from any JPEG the user attached (with a dependency-free APP1 parser), extracts and links entities out of the free-text narrative, records a calibrated score — and moves it to `pending_review`. **It never auto-publishes.** A human approves in a moderation console, and only then does row-level security make those entities visible to anonymous search. That's the trust loop: a report only becomes live signal after a person says so, and every approval writes a hash-chained audit row.

Since the version this post was drafted against, the live site has grown past that core into an Academy, a threat-alerts feed, a transparency section and a published methodology.

## Four things that only broke against a real database

The application built, typechecked and passed its unit tests long before it worked. Every one of these surfaced the first time migrations ran against actual Postgres in CI.

**Node 22 is required, and Node 20 fails at runtime rather than install.** `@supabase/supabase-js` eagerly constructs a realtime client that needs a global `WebSocket`. On Node 20 that throws — not at build, at request time, 500-ing the live app. Pinned via `.nvmrc` and an engines field.

**RLS enabled is not RLS working.** Row-level security was on, policies were written, and every query returned "permission denied for table." Enabling RLS doesn't grant anything; the tables still needed explicit `GRANT`s to `anon`, `authenticated` and `service_role`. That became migration `0003_grants.sql`.

**Search returned "No Signal" in production while every test passed.** The integration tests ran as service role, which bypasses RLS entirely — so they never noticed that anonymous users had no policy permitting them to read `report_entities` and `report_threats` for published reports. Migration `0006` added it. The lesson is that a test which runs with elevated privileges cannot verify an unprivileged path, and RLS bugs are precisely the class of bug that only appears at the privilege level you didn't test.

**A `redirect()` after the shell flushes is not a redirect.** Streaming SSR sends the layout before the page decides to bounce, so an unauthenticated request to `/moderation` returned a 200 with a client-side redirect in the payload — which looks, to `curl` and to anything that doesn't run JavaScript, like the page loaded. The real 307 comes from middleware. Defence in depth here isn't paranoia; the naive version genuinely leaks the shell.

The rate limiter is worth one more line: a Postgres sliding window (`check_rate_limit()`, `SECURITY DEFINER`, executable only by the service role) at 8 requests per 10 minutes per IP, and it **fails open** on infrastructure error. That's a deliberate inversion of the ClawWatch rule — a broken limiter should not stop a scam victim from filing a report. Verified live: a burst of nine empty submissions returned eight 422s and then a 429, with zero junk rows written.

## Where it stands

Live on Vercel with GitHub integration, Supabase wired end to end, and 81 tests across unit, integration-against-real-Postgres, Playwright end-to-end and accessibility suites. CI is green across lint, typecheck, test, build, e2e on Chromium and WebKit, CodeQL and a separate integration workflow that boots a local Supabase and applies every migration. The interface is a terminal-green cybersecurity treatment, dark by default, mono uppercase headlines, with body text held to WCAG AA and green reserved for accents.

Honest gaps: no OpenAI key is set in production, so the AI classifier abstains and search runs on community signal alone — which is by design a graceful degradation, but it means the AI half of the product isn't proving itself yet. Rate limiting is IP-only, so shared NAT shares a budget. And image virus scanning is still deferred.

The repository is public under AGPL-3.0 with Discussions open, because a platform whose sixth principle is "never exaggerate" should probably let people read the code.

More projects built this way are on the [projects page](/projects/).
