# TODOs

* [ ] deploy to GitHub Pages
  * [x] add `.github/workflows/deploy.yml` — use `withastro/action` or manual `astro build` + `actions/deploy-pages`
  * [x] set `base` in `astro.config.mjs` if deploying to a subpath (e.g. `base: '/lipu-nasin-pona'`)
  * enable Pages in repo settings → source: GitHub Actions
