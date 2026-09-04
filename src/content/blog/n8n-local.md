---
title: Self-Hosting n8n and Letting Claude Build the Workflows
description: >-
  I ran n8n in Docker on my own PC, registered it with Claude Code as an MCP
  server, and had the agent build three production automations node by node.
pubDate: 2026-09-01T00:00:00.000Z
tags:
  - n8n
  - automation
  - mcp
  - docker
project: n8n-local
draft: false
---

n8n is a workflow automation tool — the self-hostable, node-graph kind, where you wire a schedule to an HTTP call to a database write and it runs without you. Normally you build those graphs by dragging boxes around a canvas. I did something different: I ran n8n in Docker on my own machine, registered it with Claude Code as an MCP server, and then built three real workflows by *describing* them to the agent, which created and edited the nodes programmatically. The canvas became a place I went to verify, not a place I went to build.

## What it is

The install itself is deliberately boring. Official image `docker.n8n.io/n8nio/n8n`, one container named `n8n`, port 5678, a named volume `n8n_data:/home/node/.n8n` so the workflows and credentials survive a container rebuild. I picked Docker over a native install or a WSL install specifically because n8n's state is annoying to relocate later and a named volume makes "where does this live" a question with one answer.

The part that makes it interesting is the wiring. n8n ships an instance-level MCP server — turn it on in Settings, and the instance exposes its own API as agent tools. I registered it in the project-scoped `.claude.json` as `n8n-local`: http transport, endpoint `http://localhost:5678/mcp-server/http`, Bearer auth using an n8n API key.

One naming trap worth flagging, because I set it myself and then confused myself with it: I already had a *global* MCP entry called `n8n` pointing at a hosted n8n Cloud instance. So `n8n` and `n8n-local` are two different servers pointed at two different n8n installs. Every "why isn't my workflow there" moment for the first day traced back to that.

With the server connected, the build loop for a workflow looks like this:

1. `get_sdk_reference` — the agent reads how the workflow SDK actually works
2. `search_nodes` / `get_node_types` — find the right node and its real parameter shape
3. `create_workflow_from_code` — build the graph
4. `update_workflow(operations)` — patch individual nodes as things get fixed

That ordering matters. The failure mode when an agent builds n8n workflows is confidently inventing a node parameter that doesn't exist, and the fix is boringly simple: make it read the node's actual type definition before it writes the node.

## Three workflows

**AI Digest** (20 nodes, daily at 07:00 America/New_York) pulls six AI-news RSS feeds — Anthropic, Simon Willison, Latent Space, n8n, Zapier, Hacker News — tags each item with its source, merges all six streams, filters to the last 24 hours, and appends new items to a Notion database, skipping anything already there. End-to-end test wrote 13 rows covering all six sources; re-running it immediately added exactly 0, which is the number you want from a dedup path.

**Plumbing Diagnostics Agent** is a web form that returns a structured diagnosis. Form Trigger → a Code node that validates input and scans the description for emergency keywords (`flooding`, `burst pipe`, `gas smell`, `sewage backup`…) → a Basic LLM Chain running local Ollama `qwen2.5:7b-instruct` behind a structured output parser → a data table that logs the case → a completion page that renders the report. The parser enforces a fixed schema — problem identification, ranked causes with probabilities, immediate actions, whether it needs a pro, urgency, a cost range, prevention tips — because asking a 7B model for JSON and calling `JSON.parse` on the result is a coin flip. I verified it with three scenarios, a forced failure path, and a real browser submission; the gas-smell case correctly led with the red emergency banner.

**SDWIS Copper Monitor** checks EPA drinking-water compliance data weekly (Mondays, 08:00) for a specific public water system, joins two API calls into a trend, and emails me only if an alert condition fires. It was a port: the original lived on n8n Cloud, whose connector wanted an interactive OAuth flow I couldn't complete from an agent session. Rebuilding it fresh on the local instance was faster than fixing the auth. Live-tested against real EPA data for PWSID FL4504393, it returned `copperPresent: false`, `pb90Latest: 0.0014`, `pb90Max: 0.002` — an exact match to what the cloud version had produced, which is how I knew the port was faithful.

## The gotchas

**Action nodes silently clobber `$json`.** This is the one that cost real time and the one I'd tell anyone building n8n workflows first. In the copper monitor, the alert branch goes Gmail-send → log the row. The logging node read `$json` for its fields, which is the obvious thing to write. But after a Gmail node, `$json` *is Gmail's response* — an object with `id` and `threadId` and nothing else. The upstream data is gone. Every logged row on the alert path would have been all-null.

The fix is one line of discipline: after any action node whose output you don't actually want, reference the source node explicitly.

```js
// wrong — $json is now Gmail's send response
const value = $json.pb90Latest;

// right — name the node you actually mean
const value = $('Normalize').item.json.pb90Latest;
```

What matters more than the fix is how it surfaced. The alert condition is supposed to be false almost always — that's the point of a monitor. So the happy path tested clean and the bug was completely invisible. I only found it by temporarily forcing the condition true, running it, inspecting the logged row, seeing all nulls, fixing it, re-verifying, then restoring the real logic before activating. **Test the branch that isn't supposed to fire.** Alert paths, error handlers, and fallbacks are exactly where this class of bug lives, because normal operation never touches them.

**n8n in Docker cannot reach your host's Ollama at `localhost`.** Inside the container, `localhost` is the container. The Ollama credential's base URL has to be `http://host.docker.internal:11434`. The symptom is misleading — you get an Express `Cannot POST /api/chat`, which reads like an n8n bug or a wrong endpoint path rather than "you're talking to the wrong machine."

There's a nastier variant underneath it. I had two Ollama daemons on this box — one from WSL, one native Windows, different versions — and the one the container could see was not the one my host CLI was talking to. So `ollama list` on the host showed a model the workflow couldn't find. The only reliable check is asking from inside the container:

```bash
docker exec n8n wget -qO- http://host.docker.internal:11434/api/tags
```

If the model you want isn't in *that* output, nothing you do on the host matters.

**Per-item side effects want a loop, not a straight line.** The obvious way to build the digest's dedup is linear: look up the URL, IF it's empty, create the row. It's also fragile. The lookup needs `alwaysOutputData` so an empty result still emits an item, and n8n's item pairing across that empty item gets ambiguous fast — you lose track of which RSS article the current branch is even about. Wrapping it in a Split In Batches node with `batchSize: 1` fixes it, because inside the loop `$('Loop over items').item` is unambiguously the article you're processing. Slower, obviously correct, and the pattern the SDK itself recommends for per-item writes.

A few smaller ones, collected: n8n's Notion nodes need an n8n-side Notion credential *and* the target database explicitly shared with that integration, or you get a flat "Could not find database" that looks like a bad ID. Notion property keys use n8n's `Name|type` format (`URL|url`, `Source|select`). Expression values passed through `update_workflow` need the `=` prefix or they're stored as literal strings. The Wait node's smallest unit is seconds, not milliseconds. And Anthropic's official RSS feed is dead — I substituted a Google News RSS query scoped with `site:anthropic.com`, whose links are redirects but stable per article, which is all dedup needs.

## Where it landed

Three workflows built and activated on a local instance that costs nothing to run: a daily digest, an LLM-backed diagnostics form running entirely on local inference with zero API keys, and a weekly regulatory-data monitor. All three were built through the agent rather than the canvas, and all three were verified with real executions against real data before being switched on.

The honest summary of the collaboration: Claude was good at the mechanical parts — finding the right node type, getting parameter shapes right, wiring twenty nodes without typos — and the things that actually broke were environmental. Container networking, credential sharing, and a data-flow assumption that only failed on a branch that almost never runs. None of those show up in a node definition. They show up when you force the unlikely branch to fire and go look at what got written.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
