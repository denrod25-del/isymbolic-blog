import { describe, it, expect } from 'vitest';
import { parsePost, setFields } from './frontmatter.mjs';

const SAMPLE = `---
title: Test Post
description: A test.
pubDate: 2026-06-12
tags:
  - games
  - phaser
project: lava-leap
draft: true
---

Body **here**.
`;

describe('parsePost', () => {
  it('parses frontmatter data and body content', () => {
    const { data, content } = parsePost(SAMPLE);
    expect(data.title).toBe('Test Post');
    expect(data.draft).toBe(true);
    expect(data.tags).toEqual(['games', 'phaser']);
    expect(content.trim()).toBe('Body **here**.');
  });
});

describe('setFields', () => {
  it('updates fields and preserves everything else', () => {
    const out = setFields(SAMPLE, { draft: false, devtoId: 12345 });
    const { data, content } = parsePost(out);
    expect(data.draft).toBe(false);
    expect(data.devtoId).toBe(12345);
    expect(data.title).toBe('Test Post');
    expect(data.project).toBe('lava-leap');
    expect(content.trim()).toBe('Body **here**.');
  });
});
