import { describe, it, expect } from 'vitest';
import { buildHashnodePayload } from './hashnode.mjs';

const post = {
  data: {
    title: 'Lava Leap',
    description: 'An endless climber.',
    tags: ['game-dev', 'Phaser 3'],
    heroImage: '/images/lava-leap/hero.png',
  },
  content: '![shot](/images/lava-leap/shot.png)',
};

describe('buildHashnodePayload (create)', () => {
  const { input } = buildHashnodePayload(post, 'lava-leap', 'https://example.com', 'pub123');

  it('targets the publication and sets canonical', () => {
    expect(input.publicationId).toBe('pub123');
    expect(input.originalArticleURL).toBe('https://example.com/blog/lava-leap/');
    expect(input.id).toBeUndefined();
  });

  it('builds slug/name tag objects', () => {
    expect(input.tags).toEqual([
      { slug: 'game-dev', name: 'game-dev' },
      { slug: 'phaser-3', name: 'Phaser 3' },
    ]);
  });

  it('sets cover image and absolutizes body images', () => {
    expect(input.coverImageOptions.coverImageURL).toBe('https://example.com/images/lava-leap/hero.png');
    expect(input.contentMarkdown).toContain('https://example.com/images/lava-leap/shot.png');
  });
});

describe('buildHashnodePayload (update)', () => {
  it('uses the post id instead of publicationId', () => {
    const { input } = buildHashnodePayload(post, 'lava-leap', 'https://example.com', 'pub123', 'post456');
    expect(input.id).toBe('post456');
    expect(input.publicationId).toBeUndefined();
  });

  it('omits coverImageOptions when there is no heroImage', () => {
    const p = { data: { title: 'X', description: 'Y', tags: [] }, content: 'body' };
    const { input } = buildHashnodePayload(p, 'x', 'https://example.com', 'pub123');
    expect(input.coverImageOptions).toBeUndefined();
    expect(JSON.stringify(input)).not.toContain('coverImageOptions');
  });
});
