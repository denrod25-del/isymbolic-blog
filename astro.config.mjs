import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './scripts/lib/config.mjs';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
});
