import { describe, it, expect } from 'vitest';
import { buildDevtoPayload, rewriteRelativeImages } from './devto.mjs';

const post = {
  data: {
    title: 'Lava Leap',
    description: 'An endless climber.',
    tags: ['game-dev', 'Phaser 3', 'typescript', 'vite', 'extra-fifth'],
    heroImage: '/images/lava-leap/hero.png',
  },
  content: 'Look:\n\n![shot](/images/lava-leap/shot.png)\n\nAnd [a link](https://example.org).',
};

describe('rewriteRelativeImages', () => {
  it('absolutizes /images/ references, leaves other urls alone', () => {
    const out = rewriteRelativeImages(post.content, 'https://example.com');
    expect(out).toContain('![shot](https://example.com/images/lava-leap/shot.png)');
    expect(out).toContain('[a link](https://example.org)');
  });
});

describe('buildDevtoPayload', () => {
  const { article } = buildDevtoPayload(post, 'lava-leap', 'https://example.com');

  it('sets title, description, published, canonical url', () => {
    expect(article.title).toBe('Lava Leap');
    expect(article.description).toBe('An endless climber.');
    expect(article.published).toBe(true);
    expect(article.canonical_url).toBe('https://example.com/blog/lava-leap/');
  });

  it('sanitizes tags to alphanumeric and caps at 4', () => {
    expect(article.tags).toEqual(['gamedev', 'phaser3', 'typescript', 'vite']);
  });

  it('absolutizes the hero image and body images', () => {
    expect(article.main_image).toBe('https://example.com/images/lava-leap/hero.png');
    expect(article.body_markdown).toContain('https://example.com/images/lava-leap/shot.png');
  });

  it('dedupes tags that collide after sanitization', () => {
    const p = { data: { ...post.data, tags: ['game-dev', 'gamedev', 'unity', 'csharp', 'dotnet'] }, content: '' };
    const { article } = buildDevtoPayload(p, 's', 'https://example.com');
    expect(article.tags).toEqual(['gamedev', 'unity', 'csharp', 'dotnet']);
  });

  it('omits main_image when there is no heroImage', () => {
    const p = { data: { title: 'X', description: 'Y', tags: [] }, content: 'body' };
    const { article } = buildDevtoPayload(p, 'x', 'https://example.com');
    expect(article.main_image).toBeUndefined();
    expect(JSON.stringify(article)).not.toContain('main_image');
  });
});
