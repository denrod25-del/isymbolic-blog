---
title: 'AuditScout: A Website Audit SaaS That Refuses to Bluff'
description: >-
  Paste a URL, get a prioritized audit across SEO, security, performance and
  conversion. How I built AuditScout — and why it tells you what it did not
  scan.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - nextjs
  - saas
  - security
  - ai
project: auditscout
heroImage: /images/auditscout/hero.png
draft: false
---

Most website-audit tools hand you a wall of red and a number you can't act on. I wanted the opposite: a short list of things that are actually wrong, ranked by how much they matter, written in language a contractor or a solo founder can read — plus a 30-day plan and a copy/paste prompt that fixes them. That's AuditScout. It's live at [auditscout.vercel.app](https://auditscout.vercel.app), in public beta, and the most interesting engineering decisions in it are about honesty.

## What it is

You paste a public URL. AuditScout fetches the page, runs a battery of passive checks across twelve dimensions — SEO, AEO, GEO, security, performance, mobile UX, accessibility, trust, conversion, and business strategy among them — and streams progress back over Server-Sent Events while it works. What comes out is a scorecard: an overall number, sub-scores per dimension, a ranked list of fixes, a 30-day plan, and a prompt you can paste into your own coding agent.

No login is required for your first audit. Anonymous users get one, free accounts get three a month, and the paid tiers go up from there.

The stack is Next.js 16 App Router with React 19, TypeScript, Tailwind v4, Prisma 7 against Neon Postgres, and NextAuth v5. Scanning is HTTP-fetch-first with a Playwright fallback when a page comes back under 500 characters or with an error status — plenty of sites render nothing useful without JavaScript, and plenty of others don't need a browser at all.

## How it was built

Same loop as everything else here: I decided what the product was, wrote a locked spec, turned that into an eleven-phase implementation plan, and Claude executed it test-first with separate reviewer passes between phases. The spec and plan are in `docs/superpowers/`. Then came something like nine passes of frontend and copy work, mostly driven by me looking at the live site and not liking what I saw.

Those passes were less about pixels than about claims. The first version of the hero said "Audit any website in seconds." That's a promise the beta scanner can't fully keep, so it became "Get a prioritized website audit in seconds," and the page grew an explicit **Live now / In progress** split naming exactly which parts of the product work today and which are still being built. There's a "What we don't scan" section listing nine things it deliberately doesn't touch. The pricing table marks unfinished tiers "Coming soon" instead of quietly implying they exist.

That sounds like copywriting. It kept turning into engineering, because every honest claim had to be one the code could actually back.

## Three problems worth writing down

**NextAuth v5 middleware drags Prisma into the Edge runtime.** The deploy failed on the first try because `middleware.ts` imported the auth config, the auth config imported the Prisma adapter, and the Edge runtime rejected `node:util/types`. The fix is a config split: `lib/auth.config.ts` is edge-safe with an empty `providers: []` array and is what middleware imports; `lib/auth.ts` spreads that config and adds the Credentials and Google providers for the Node runtime. Two files, one import graph each.

**Serverless screenshots broke for a reason that had nothing to do with Chromium.** AuditScout swaps full `playwright` locally for `@sparticuz/chromium` plus `playwright-core` on Vercel. It kept failing in production, and every instinct said "the bundled Chromium is wrong." It wasn't. Next's tracer followed `playwright-core` but not its sibling `browsers.json`, so the dynamic `import("playwright-core")` threw at runtime. The fix was `outputFileTracingIncludes` in `next.config.ts`, force-including the whole package:

```ts
outputFileTracingIncludes: {
  '/api/audit/**': [
    './node_modules/playwright-core/**',
    './node_modules/@sparticuz/chromium/**',
  ],
},
```

The trap inside the trap: that key is a picomatch glob. The obvious route key `/api/audit/[id]/stream` silently fails, because `[id]` parses as a character class. Use `/api/audit/**`.

**The score was invisible and every structural check passed.** This is the one I think about. The `ScoreRing` component had both a Tailwind `rotate-90` class and an SVG `transform` attribute on its `<text>` element. The CSS transform wins, and it rotates about the text's own box rather than the SVG origin — so the overall score number sat outside the visible ring on every single report. The DOM had it. The tests had it. Accessibility checks found the label. It was just not on the screen.

The fix is trivial: rotate only the arc via the SVG attribute, never rotate the `<svg>` and counter-rotate the text. The lesson isn't. A structural assertion that an element exists is not an assertion that a human can see it. Now the check is geometric — assert the score `<text>` bounding box lies inside the SVG bounding box — and I take screenshots before believing a UI is fine.

A second one from the same pass: a JSX text child containing a newline has its leading whitespace stripped, so `{SITE} is a solid…` rendered as `brightleafplumbing.comis`. You can find these across a whole site by grepping the prerendered HTML for `\w{2,}<!-- -->[A-Za-z]\w+` — React's SSR comment marks exactly where the text node boundary was.

## Where it stands

The MVP is built, deployed, and verified end-to-end against real URLs: the full pipeline runs, all sections persist and render, signup and auth write to Neon in production. The suite is 64 unit tests; `tsc`, the build, and lint are all clean. A Lighthouse run on the live homepage scores 98 mobile / 100 desktop on performance, 100 on best practices and SEO, and 100 on accessibility — the last of which took darkening three status-color tokens to clear 4.5:1 contrast for small text.

The honest caveats, which are also on the site: production has no `ANTHROPIC_API_KEY` set, so reports currently come from the deterministic fallback generator rather than a model — that path is proven and never crashes, but it isn't the AI-written report the product eventually sells. The anonymous rate limit is in-process memory and needs Redis at any real scale. The SSRF guard resolves DNS and revalidates every redirect hop, but a determined rebinding attack still has a residual TOCTOU window. And Vercel's 60-second Hobby cap means a genuinely slow site can leave an audit stuck in `SCANNING` with no stale-status recovery yet.

Those are the next things to fix, and they're on a public roadmap page rather than in a private issue tracker, which feels like the right place for them.

More projects built this way are on the [projects page](/projects/).
