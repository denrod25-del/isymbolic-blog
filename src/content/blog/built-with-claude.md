---
title: 'Thirty-Two Projects, One AI Pair Programmer'
description: >-
  What I learned building 32 projects with Claude — games, Blender scenes, local
  AI stacks, a search engine — and the method that made it all work.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - ai
  - claude
  - building
  - meta
project: meta
draft: false
---

This blog has more than thirty write-ups on it now, and they have almost nothing in common. There are games built in two different engines, a 2,700-year-old aqueduct reconstructed in Blender with a real water simulation, a working search engine, a stack of AI tools that run entirely offline on a single graphics card, and a tool whose entire job is to tell me what's hogging a port. The one thread connecting them is how they were made: each one was built pair-programming with Claude, and each one was built the same way.

That sameness is the actual story. "AI wrote some code" is not interesting in 2026. What turned out to be interesting — to me, at least — is that a repeatable *method* let one hobbyist with limited evenings ship across domains I have no business being competent in at once.

## What's in here

The range is the point, so a quick tour. On the games side there's [Lava Leap](/blog/lava-leap/), an endless climber whose levels are mathematically guaranteed to be beatable, plus a faithful [Space Invaders](/blog/space-invaders/) clone and a couple of in-progress prototypes. On the 3D side, [the Nineveh aqueduct](/blog/nineveh-aqueduct/) and a [parametric Atlantis](/blog/atlantis/) built from a single script. There's a [local RAG over my own library of books](/blog/book-library/) that answers with citations and never touches the cloud, and several other [fully-local AI stacks](/blog/pdf-to-podcast/) running on an 8 GB card. There are build-from-source write-ups, desktop tools, a pile of Python data utilities, and [a search engine](/blog/symbolic/). The [full list lives here](/projects/).

I am not an expert in most of those areas. I've never shipped a Lua resource, I'm not a graphics programmer, and I'd never compiled a large C++ application from source before this year. The work still got done, and it got done because of the process, not because I suddenly knew all of those things.

## How it actually worked

Every project followed the same loop, and the loop is boring on purpose:

**Brainstorm, then write it down.** Before any code, a back-and-forth to pin down what the thing actually is and what "done" means — ending in a short written spec. This is the step it's most tempting to skip and the one that saved the most time. A vague idea produces vague code; a spec produces a plan.

**Plan in small, testable pieces.** The spec becomes a numbered plan: discrete tasks, each one small enough to verify on its own. For a game that might be twenty-eight tasks across eight milestones.

**Build test-first, and verify by running the real thing.** Claude wrote the great majority of the code, task by task, with tests written before the implementation. Crucially, "it compiles" was never the bar — the bar was watching the actual game run, the actual render come out, the actual MP4 play back with sound.

**Review before moving on.** Each chunk got looked at with fresh eyes before the next one started.

The division of labor was consistent across all thirty-two: I decided *what* to build and *how it should behave* and made the judgment calls; Claude wrote most of the code and did the tireless parts. That split is the whole trick. The model is extraordinary at breadth, at boilerplate, at patiently following a test-driven loop, and at the grind of compiling someone else's C++ project and decoding the error on line 4,000. It is not the one deciding whether the idea is any good, whether the scope is sane, or whether a plausible-looking answer is actually correct.

## What worked, and what didn't

The honest version, because a post about building with AI that's all upside isn't worth reading.

**What worked better than I expected.** Breadth, mostly. I could move from a Phaser game to a Blender fluid sim to a Postgres-backed web app in the same week without paying the usual "I've never done this" tax up front. Build-from-source debugging in particular — the kind of work that's pure friction, where you're three unfamiliar error messages deep in a toolchain you didn't choose — went from "lose a weekend" to "lose an afternoon." And test-driven development, which I am too lazy to do consistently on my own, happens naturally when it's baked into the loop.

**Where I had to stay in the driver's seat.** Taste and scope never delegated well — left alone, the work will happily expand to fill any amount of effort, and someone has to keep saying "that's out of scope" and "ship the small version." And accuracy needs a human or a second pass. When I had the write-ups for this very blog fact-checked against the source code, that check caught real errors in nearly every post: a wrong test count, a config flag I'd described backwards, a credit attributed to the wrong entity, a render described as "photoreal" when it plainly wasn't. Plausible-but-wrong is the failure mode to watch, and it doesn't announce itself.

## The blog is part of the experiment

This site was built with the same loop — brainstormed, spec'd, planned, built test-first. It went a step further: there's a small agent that drafts the posts. Point it at a project and it reads that project's notes, its repo, and its commit history, then writes a first draft in the house style. Every draft was then fact-checked against the source before anything was committed, which is the only reason I trust the numbers in these write-ups.

I mention that not as a flex but because it's the same lesson one more time: the agent doesn't replace the judgment, it removes the friction. It gets a draft onto the page so I can do the part that needs a person — deciding whether it's true and whether it's any good.

## Where to start

If you want the most representative three, I'd read [Lava Leap](/blog/lava-leap/) for the games, [the Nineveh aqueduct](/blog/nineveh-aqueduct/) for the 3D work, and [the local book-library RAG](/blog/book-library/) for the offline-AI stuff. Otherwise the [projects page](/projects/) has all of them, and more are going up over the coming weeks.

None of this required being an expert in thirty-two things. It required a method, a willingness to write the spec before the code, and the discipline to check the work afterward. That's the part worth stealing.
