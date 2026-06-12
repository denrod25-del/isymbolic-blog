import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    project: z.string(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(true),
    // dev.to uses integer article ids; Hashnode uses UUID strings
    devtoId: z.number().optional(),
    hashnodeId: z.string().optional(),
  }),
});

export const collections = { blog };
