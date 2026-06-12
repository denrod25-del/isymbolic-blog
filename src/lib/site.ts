import { SITE_URL } from '../../scripts/lib/config.mjs';

export const SITE = {
  url: SITE_URL,
  title: 'iSymbolic',
  description:
    'Projects built with Claude — games, 3D art, desktop tools, and AI experiments, with the gotchas that made them work.',
};

export const postUrl = (slug: string) => `${SITE.url}/blog/${slug}/`;
