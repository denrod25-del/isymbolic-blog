---
title: 'TapTrace: Feature-Complete, Unlaunched, and Honest About Both'
description: >-
  An address-to-water-utility API with a measured confidence tier on every
  answer — 211 tests, five milestones, four SaaS surfaces, and no customers yet.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - python
  - fastapi
  - postgis
  - saas
project: taptrace
heroImage: /images/taptrace/hero.png
draft: false
---

Ask the internet which utility supplies your tap water and you will get a confident wrong answer. Utility service areas don't follow city limits, ZIP codes are mailing conventions rather than boundaries, and most geocoders interpolate your house from a street segment instead of finding your roof. TapTrace is my attempt to answer the question properly: give it a US street address, get back the Public Water System that serves it, its drinking-water violations and contaminant levels — and, crucially, **a confidence score and tier saying how much to trust that answer.**

The engine is done. All four SaaS surfaces around it are done. The landing page is live at [taptrace-sjal.vercel.app](https://taptrace-sjal.vercel.app). The API has never been deployed to a server and has never had a customer. This post is about both halves of that.

## What it does

`POST /resolve` takes an address. It geocodes it, runs a point-in-polygon query against EPA Community Water System service-area boundaries in PostGIS, and returns the PWSID that serves the point — plus open violation counts, contaminants measured against their MCLs, and a `tier` of `EXACT`, `LIKELY`, `AREA`, `WELL` or `UNRESOLVED` with a 0–100 confidence number behind it.

The confidence model multiplies four factors: the resolution method, the geocode precision, cross-source agreement, and how close the point sits to a boundary edge. A real answer from the live system: 400 S Dixie Hwy in West Palm Beach resolves to **FL4501559 at LIKELY / 70** using the free Census geocoder, and to EXACT / 100 when a rooftop geocoder is in play. That gap is deliberate and it's the most important design decision in the project.

The Census geocoder is interpolation-only. It does not do rooftop. So TapTrace **structurally cannot return EXACT** on the free tier, and it doesn't pretend to. Buying a rooftop geocoder key is what unlocks that tier. An accuracy claim you can't back with a measurement isn't an accuracy claim.

Florida is loaded: 1,385 service-area boundaries, 84,618 violations (4,943 health-based, the rest monitoring), 9,873 samples. Ingestion is now state-parameterized, so `run_all --state FL --state TX` works and Texas has been probed live from both upstream sources.

## How it was built

Python 3.12, FastAPI, SQLAlchemy 2 with GeoAlchemy2, Alembic, PostgreSQL + PostGIS in Docker, and pytest with ruff and strict mypy. It was built as a sequence of milestones — M0 foundations through M5 deploy — each one getting its own written plan and its own pull request, then four SaaS sub-projects on top: API access and metering, an operator dashboard, an embeddable widget, and Stripe billing. Plus a phase-2 corrosivity calculator. Sixteen PRs, 211 tests.

Three decisions I'd defend:

**Privacy by construction.** The request log has no address column at all. The query cache scrubs every address form — including the geocoder's `matched_address`, which was the one that nearly slipped through review. The ground-truth corpus stores a salted SHA-256 hash of the address plus the geocoded point, never the street. You can't leak what you didn't keep.

**Accuracy as a test, not a claim.** There's a `validation/` package with a corpus of Florida ground-truth labels sourced from documented city-to-utility relationships — deliberately *not* from the engine's own output, so the check isn't circular. A harness computes per-tier accuracy and coverage, and a CI gate asserts coverage ≥ 0.80 and resolved accuracy ≥ 0.90. The current corpus runs 13/13 correct, all at LIKELY tier. It is also honestly biased toward municipal city centers by design: it validates the pipeline, not service-area edges. And it's Florida-only — accuracy does not travel with coverage, so adding Texas ingestion does not entitle anyone to claim Texas accuracy.

**Scope the calculator to what the data supports.** The corrosivity work computes LSI, RSI, Larson-Skold and CCPP from *caller-supplied* water chemistry, not per-PWS. That's because SDWIS simply doesn't carry pH, alkalinity, calcium hardness or TDS per system — computing a corrosion index from absent data would produce a confident number about nothing. So it's a calculator with an explicit "screening estimate, not a measurement" disclaimer, and the engine was ported verbatim from my earlier copper-risk work, PHREEQC oracle tests and all.

## The gotchas

**State-qualified ingest source names are the difference between coverage and data loss.** The `load_versioned` helper activates one version per source, then deletes rows belonging to superseded versions *of that source*. When ingestion became multi-state, the source name had to become `epa_boundaries:FL` rather than a bare `epa_boundaries` — because a shared source name would mean ingesting Texas silently deletes every Florida row. That naming lives in one module and is pinned by its own test, which is exactly where a landmine like that belongs.

**A migration that uses `create_all` will eat later migrations.** Migration `0001` originally called `Base.metadata.create_all`. On a fresh database that creates every table currently on `Base` — including tables that *later* migrations are supposed to own — so migration `0002` then hits `DuplicateTable` and the whole chain fails on new environments only. It bit twice before I froze `0001` to explicit `op.create_table` DDL for its eight original tables. If your first migration reflects live models, it is a time bomb aimed at every future clone of the project.

**Two upstream sources that agree may not be independent.** The plan was to cross-check EPA's Florida boundaries against the state Water Management District layers. Then the recon turned up that EPA's Florida polygons are *already sourced from* SFWMD. Agreement between them would have been circular and would have inflated confidence scores for free. That check is deferred with a note explaining why.

**Reference data disappears.** The Envirofacts `REF_CODE_VALUES` table, which maps contaminant codes to names, returns "table is not available." So there's a committed seed CSV of 93 codes from the SDWIS data dictionary covering every code that appears in Florida's violations, and the ingestor auto-refreshes from the API if it ever comes back.

And a small operational one that cost an evening: every `docker compose` command against the production stack needs `--env-file .env.prod`, because `env_file:` injects variables into containers but *not* into compose's own interpolation. Without it the database initializes with empty credentials and fails its healthcheck.

## Where it stands

Engine milestones M0 through M5 are complete and merged. API keys with hashed storage, atomic quota metering, an operator dashboard with CSRF-protected forms and a dependency-free inline-SVG chart, a Shadow-DOM embeddable widget gated on publishable keys and an origin allowlist, and Stripe billing driven by webhooks as the source of truth — all built, all merged, 211 tests, ruff and mypy clean. There's a multi-stage Dockerfile, a production compose stack, a scheduler, and a one-shot `deploy.sh` that generates its own secrets. The whole thing has been smoke-tested end to end on a fresh volume: migrations apply, `/health` returns 200, a minted key resolves a real Florida address.

And then it stops, because I have never run `deploy.sh` on an actual VPS. There is no host, Stripe is still in test mode, and the only thing on the public internet is the landing page. A monetization spec now names the six gaps between here and a first dollar and notes that only two of them are hard blockers.

Building the thing turned out to be the easy part. That's the honest summary, and it's worth writing down.

More projects built this way are on the [projects page](/projects/).
