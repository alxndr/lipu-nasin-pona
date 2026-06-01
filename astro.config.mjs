import { defineConfig } from 'astro/config'
import { remarkSitelenIAL } from './src/plugins/remark-sitelen-ial.mjs'

export default defineConfig({
  site: 'https://alxndr.github.io',
  base: '/lipu-nasin-pona',
  markdown: {
    remarkPlugins: [remarkSitelenIAL],
  },
})
