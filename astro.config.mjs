import { defineConfig } from 'astro/config'
import { remarkSitelenIAL } from './src/plugins/remark-sitelen-ial.mjs'

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkSitelenIAL],
  },
})
