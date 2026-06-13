---
title: 'A Crypto Trading Bot Where the Interesting Part Is the Safety Check'
description: >-
  An automated crypto trading bot built around a safety gate that verifies every
  entry condition, with a paper-trading default and a full decision audit trail.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - nodejs
  - trading
  - automation
draft: true
project: trading-bot
---

I built an automated crypto trading bot, and the part I actually care about isn't the strategy. It's the safety check — the gate that sits between "the indicators say go" and "place a real order with real money." A trading strategy is a hypothesis. A safety check is the thing that refuses to let a bad hypothesis spend your balance. So this post is an engineering story about that gate, not a trading one.

Up front, because it matters: this is a personal automation project, not financial or investment advice. There are no profit claims here, and there's no strategy recommendation. The bot ships in paper-trading mode by default, which logs every decision but never places a real order. Everything below is about how the code is wired, not about whether you should trade.

## What it is

It's a single Node.js script (`bot.js`) that runs on a schedule. On each run it:

1. Loads a strategy definition from `rules.json`.
2. Pulls candle data from Kraken's public OHLC API — free, no auth required.
3. Calculates three indicators from raw candles: EMA(8) for trend direction, VWAP for session bias, and a very fast RSI(3) for entry timing.
4. Derives a market **bias** — bullish if price is above both VWAP and EMA(8), bearish if below both, neutral otherwise.
5. Runs a **safety check** that verifies every entry condition for that bias.
6. Only if *all* conditions pass — and the daily trade limits allow it — places a market order on Kraken.
7. Writes the full decision to `safety-check-log.json` and a tax-ready row to `trades.csv`.

The default mode is paper trading. With `PAPER_TRADING=true` the bot does everything — fetches data, runs the safety check, logs the decision — but the order step is a no-op that records a `PAPER-` order id instead of hitting the exchange. You flip a single environment variable to go live, and the code is structured so that flipping it changes exactly one branch.

One honest note about provenance: I started from a public template (the repo's README and onboarding prompt are written around BitGet and TradingView, and mention MACD). The actual executing code in `bot.js` is Kraken-only and uses EMA/VWAP/RSI — no MACD anywhere. I describe what the code does, not what the marketing copy says, because the code is the thing that places orders.

## How it was built

**The strategy lives in data, not code.** `rules.json` holds the indicators, the bias criteria, the long and short entry rules, exit rules, and risk rules as plain text and structured fields. The example is a VWAP + RSI(3) + EMA(8) scalping setup: price above VWAP and EMA(8) plus RSI(3) under 30 for a long; the mirror for a short. Keeping the strategy as data means the safety check is a generic evaluator over conditions rather than a hardcoded `if`.

**The safety check is the centerpiece.** `runSafetyCheck()` picks the bias, then runs each condition through a small `check(label, required, actual, pass)` helper that records the requirement, the value it actually observed, and a boolean. For a long it verifies price above VWAP, price above EMA(8), RSI(3) below 30, and that price is within 1.5% of VWAP (so it won't chase an overextended move). The decision rule is deliberately blunt:

```js
const allPass = results.every((r) => r.pass);
```

Every condition must pass. One failure and the trade is blocked, with the exact failing label and the real value it saw recorded. There's no "three out of four is close enough." That single line is the whole philosophy — a safety gate that defaults closed.

**Two hard guardrails sit outside the strategy.** Before any indicators are even fetched, `checkTradeLimits()` enforces `MAX_TRADES_PER_DAY` (it counts today's executed trades from the log and bails if you're at the cap) and `MAX_TRADE_SIZE_USD`. Position size is `min(portfolioValue * 0.01, MAX_TRADE_SIZE_USD)` — capped at 1% of portfolio per trade *and* the absolute dollar ceiling, whichever is smaller. These apply no matter what the strategy says, which is the point: the strategy can be wrong, but it can't blow past the limits.

**Everything is logged, twice.** Each run appends a structured entry to `safety-check-log.json` — timestamp, price, every indicator value, every condition with pass/fail, whether an order was placed, the order id, paper-vs-live mode, and the active limits. That's the audit trail: you can reconstruct exactly why the bot did or didn't trade at any point. Separately, every run also writes a row to `trades.csv` with date, side, quantity, price, an estimated fee, and a `BLOCKED` / `PAPER` / `LIVE` mode column — so even a *blocked* decision leaves a record, with the failed conditions in the notes field.

## The gotchas

**The safety check has to default closed, including the neutral case.** The subtle bug-in-waiting is the "no clear bias" path. If price is straddling VWAP and EMA(8), there's no bullish or bearish setup — and the easy mistake is to let an empty condition list pass `every()` vacuously (an empty array makes `.every()` return `true`). The fix is explicit: the neutral branch pushes a synthetic failing result (`label: "Market bias", pass: false`) so `allPass` is `false` by construction. No bias means no trade, enforced, not assumed.

**Paper mode and live mode must share one code path until the very last step.** The temptation is to short-circuit early when paper trading — skip the data fetch, skip the safety check, just log "would have traded." That makes paper mode a liar: it stops exercising the exact logic you're trusting with real money. Here, both modes run identical fetch → indicator → safety-check → log flow; they diverge only at the final `if (CONFIG.paperTrading)` branch where one records a synthetic order id and the other calls `placeKrakenOrder()`. So what you watch in paper trading is genuinely what runs live.

**Exchange auth and units are fiddly, and getting them wrong fails loudly — good.** Kraken's private API wants an HMAC-SHA512 signature over the path plus a SHA-256 of `(nonce + postdata)`, keyed with the base64-decoded secret, and orders are form-encoded, not JSON. The other trap is units: Kraken wants order volume in the base currency (XBT), not USD, so the code converts with `sizeUSD / price`. Both are the kind of thing that silently misbehaves if you guess. The mitigation that actually helps is that `placeKrakenOrder()` throws on any non-empty `data.error` from the API, and the caller catches it, records the error string into the log entry, and writes a `LIVE` row noting the failure — so a rejected order is a logged event, not a silent miss.

## What it does

To be clear about what this is: a personal engineering project that automates a mechanical strategy behind a safety gate, with two hard guardrails and a complete audit trail. It defaults to paper trading. It will refuse to trade far more often than it trades, because the gate defaults closed and every condition has to line up.

What it is **not**: financial advice, a recommendation to run any particular strategy, or a claim that it makes money. The interesting engineering is the discipline — verify every condition, log every decision, cap the downside in code, and make paper mode exercise the real path. If you do anything like this with a live exchange key, withdrawals off and IP allowlist on are the bare minimum, paper-trade first, and never risk more than you can lose. The bot can enforce its limits. It can't enforce good judgment — that part's still on you.
