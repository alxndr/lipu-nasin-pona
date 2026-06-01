import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const chapters = defineCollection({
  loader: glob({ base: '.', pattern: '[0-9][0-9].md' }),
  schema: z.object({
    chapter: z.number(),
    title: z.string().optional(),
    status: z.enum(['done', 'wip', 'ready', 'notready']),
    layout: z.string().optional(),
  }),
})

export const collections = { chapters }
