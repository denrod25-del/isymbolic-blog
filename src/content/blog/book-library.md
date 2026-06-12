---
title: "Book Library: A Local RAG That Answers From My Own PDFs"
description: "I turned a folder of downloaded PDF books into an offline RAG chat that answers only from the text and cites the exact page — running entirely on my RTX 3070."
pubDate: 2026-06-12
tags: [rag, python, local-llm, gpu]
project: book-library
draft: true
---

I have a folder full of PDF books I downloaded — a couple hundred of them, mostly programming and technical references. The problem with a couple hundred PDFs is that they're write-only memory: I know the answer is in one of them, I just have no idea which one or what page. Book Library is the fix. It's a chat box in my browser where I ask a question, and it answers using only the text of my books, with citation chips that open the source PDF right at the page it pulled the answer from. No cloud, no API keys, nothing leaves the machine. I built it with Claude as a pair programmer.

## What it is

It's a retrieval-augmented-generation app over a personal PDF library. You type a question, it finds the most relevant passages across every indexed book, hands those passages to a local language model, and the model writes an answer grounded in them. Every claim comes with a `[Title, p.N]` citation, and in the UI those render as little chips you can click to jump straight to the cited page in the original PDF.

The whole thing runs offline on my RTX 3070. Ollama serves both models on the GPU: `qwen2.5:7b-instruct` writes the answers and `nomic-embed-text` turns text into the vectors used for search. PyMuPDF extracts the text, ChromaDB stores the embeddings, and a small FastAPI backend ties it together behind a vanilla-JS chat page. The reason I cared about "local" wasn't privacy theater — it's that I wanted to point it at a folder of copyrighted books I own and not ship their contents to anyone's server, and I wanted it to keep working with no subscription and no rate limits.

The grounding is the point. The system prompt is blunt about it: answer using *only* the provided excerpts, cite every claim, and if the excerpts don't contain the answer, say you couldn't find it in the library — do not use outside knowledge. That last instruction is what separates this from just asking a chatbot. A chatbot will confidently fill gaps; this thing is supposed to tell me when my books don't cover something.

## How it was built

The pipeline is the usual RAG shape — ingest, chunk, embed, store, retrieve, cite — but each stage had a small decision that mattered.

**Ingest** walks the PDF folder and pulls text page by page with PyMuPDF. A page that fails to parse yields an empty string instead of killing the whole document, and a book with no extractable text at all (a scanned image with no text layer) is logged and skipped rather than crashing the run. Ingestion is resumable: it writes a JSON manifest after every file, so re-running it only processes books it hasn't seen. That mattered a lot, because indexing the whole library is a 30-to-60-minute job and I add books to the folder over time.

**Chunking** is deliberately page-aware. Chunks never span a page boundary, which means every chunk carries an exact page number — and that's what makes the citations trustworthy. Text is sliced into ~1800-character windows with 300 characters of overlap so a sentence split across a boundary still survives in one piece somewhere. 1800 characters is roughly 450 tokens, kept conservative on purpose (more on why in the gotchas).

**Embed and store**: each chunk goes through `nomic-embed-text` and lands in a ChromaDB collection configured for cosine distance, with the filename, human-readable title, and page number as metadata. Chunk IDs are a SHA-1 of `filename::page::index` so re-ingesting is idempotent. Embeddings are added in batches of 64 to keep memory flat.

**Retrieve and cite**: a question gets embedded the same way, Chroma returns the top 6 nearest chunks, and anything past a cosine-distance threshold is dropped as "not actually a match." The surviving excerpts are formatted into the prompt with their `[Title, p.N]` labels, the model streams an answer back token by token, and a deduplicated citation list rides along in the response. The browser shows the answer as it streams and renders the citations as clickable chips. The entire UI is one static HTML file with a `fetch` and a stream reader — no framework.

The division of labor was the same as my other projects: I decided what it should do and made the design calls, Claude wrote essentially all the code, and I drove it through a brainstorm-then-spec-then-plan flow before any implementation. Both the design doc and the task plan live in the repo.

## The gotchas

Three real ones, each of which cost actual debugging time.

**The embedder rejects overlong chunks, and that decided my chunk size.** `nomic-embed-text` has its own context window, and feeding it a chunk that's too long fails with "input length exceeds context length." Dense pages — code listings, tables, CJK text — pack far more into 1800 characters than prose does, so a naive larger chunk size blew up on exactly the technical books I most wanted indexed. The fix was two-part: keep chunks conservative at 1800 chars, and make a single rejected chunk a skip-with-a-note instead of a fatal error. One bad chunk shouldn't lose the whole book.

**Browsers download PDFs instead of honoring `#page=N`.** The citation chips link to `/pdf/<file>#page=42`, expecting the browser's built-in viewer to open at page 42. Instead Chrome kept *downloading* the file and ignoring the fragment entirely. The cause: by default the server sent the PDF with a `Content-Disposition: attachment` disposition, which tells the browser "save this," not "view this." Serving it with `content_disposition_type="inline"` flips it to "open in the viewer," and only then does `#page=N` actually jump to the page. A citation you can't click to is worthless, so this was load-bearing.

**The LLM context window has to hold all the excerpts at once.** With six retrieved chunks plus the system prompt plus the question, the default Ollama context was too small and answers would quietly get truncated or lose the earlier excerpts. Setting `num_ctx=8192` explicitly gives the model enough room to actually see all six passages it's supposed to be reasoning over. It's an easy thing to forget because nothing errors — the model just silently gets less context than you think it has.

(A fourth, minor one: ChromaDB's telemetry prints harmless `capture()` errors to the console even with telemetry disabled. Cosmetic, but worth knowing it's not your bug.)

## What works today

It works, and the index has outgrown its first numbers. The live ChromaDB collection now holds roughly 250 books and about 78,000 chunks — up from the 163 books and ~52,000 chunks of the first working version, because the whole point of resumable ingest is that I keep dropping new downloads into the folder and re-running it. The books with no text layer are still skipped; OCR for those scanned PDFs is on the list but not done.

In the browser I can ask a real question, watch the answer stream in, and click a citation chip to land on the exact page in the source PDF. The answers stay inside the library — when my books genuinely don't cover something, it tells me instead of inventing an answer, which is the behavior I actually wanted.

It's not perfect. There's no chat memory yet — each question is answered independently — and a few stubborn PDFs don't always honor the page jump. Those are the known edges. But for the thing I built it to do — turning a write-only pile of PDFs into something I can actually ask — it delivers, and it does it entirely on my own GPU with nothing leaving the machine.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
