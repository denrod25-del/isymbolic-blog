import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://isymbolic-blog.netlify.app',
  integrations: [sitemap()],
});
