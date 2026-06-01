# lipu Nasin Pona — Astro site

An [Astro](https://astro.build/) static site for the Toki Pona interpretation of the Dao De Ching project.

Each of the 81 chapters lives as a Markdown file at the repo root (`01.md`–`81.md`).


## Commands

```sh
npm install
npm run dev      # dev server at http://localhost:4321/
npm run build    # static output → dist/
npm run preview  # preview the built output
```


## Content files

Chapter files use standard YAML frontmatter:

```yaml
---
chapter: 1
title: lupa pi nasa pona ale
status: done      # done | wip | ready | notready
layout: lipu-nasin-pona   # ignored by Astro 5, kept for historical reasons
---
```

The Astro content collection (`src/content.config.ts`) loads them with `glob({ base: '.', pattern: '[0-9][0-9].md' })` so entry IDs are `01`, `02`, … `81`.



## Remark plugin — `src/plugins/remark-sitelen-ial.mjs`

The chapter files were authored for [Jekyll](https://jekyllrb.com/) with [Kramdown](https://kramdown.gettalong.org/)-specific syntax that standard remark/GFM cannot handle. A custom remark plugin translates these patterns at parse time.

### Five transforms

**1 & 2 — `{:sitelen data-sitelen-ratio="N"}` inline attribute lists**

Kramdown IAL syntax appended to a paragraph (no blank line before it):
```
jan li pona.
{:sitelen data-sitelen-ratio="1"}
```
→ the IAL is stripped and `data-sitelen="true" data-sitelen-ratio="1"` are added to the `<p>` element. The [sitelen-sitelen-renderer](https://github.com/Olaf-Olaf/sitelen-sitelen-renderer) then finds those `<p>` elements and replaces them with SVG glyphs.

When the IAL appears as a standalone paragraph (no preceding Toki Pona text), it is removed entirely — those mark chapters whose translation is not yet written.

> **Quote-handling note:** Astro's default `remarkSmartypants` plugin runs *before* custom plugins and converts straight `"` to typographic `"…"` (U+201C/U+201D). The plugin's regexes therefore match both ASCII and curly-quote variants via the character class `["""“”]`.

**3 — Headerless Kramdown tables**

Kramdown tables begin with the alignment row; GFM tables require a header row first. remark-gfm cannot parse them, so the entire block lands as a paragraph node in the AST. The plugin detects paragraphs whose first line consists entirely of alignment markers (e.g. `|:-:|-|-`) and converts the block to a raw `<table class="loseta">` HTML node. Inline content inside cells — `<wbr/>`, `<!--comments-->`, `_emphasis_` — is preserved by serialising the inline AST back to HTML before splitting on `|`.

**4 — `{:.loseta}` standalone**

If a GFM table (parsed normally by remark-gfm) is followed by a `{:.loseta}` paragraph, the class is applied to the table and the placeholder paragraph is removed.

**5 — Jekyll template directives**

`{% include … %}` and `{%comment%}…{%endcomment%}` blocks are removed, both when they appear as paragraphs and when they are wrapped in an HTML comment (`<!-- {% … %} -->`), which remark parses as a block `html` node rather than a paragraph.

## Content-layer cache gotcha

Astro 5's content layer pre-renders Markdown at sync time and caches the results:

| mode | cache location |
|------|----------------|
| dev (`astro dev`) | `.astro/data-store.json` |
| build (`astro build`) | `node_modules/.astro/data-store.json` |

The cache key is a digest of the file content, *not* the remark pipeline. Adding or changing a remark plugin does **not** invalidate the cache — Astro serialises function values as `null` when computing the config digest.

**Whenever the remark plugin changes, delete the relevant cache before running:**

```sh
# after editing src/plugins/remark-sitelen-ial.mjs:
rm -f .astro/data-store.json node_modules/.astro/data-store.json
```

Both files are listed in `.gitignore` and safe to delete; Astro recreates them on the next run.

## Public assets

| file | source |
|------|--------|
| `public/sitelen-sitelen-renderer.min.js` | [sitelen-sitelen-renderer](https://github.com/Olaf-Olaf/sitelen-sitelen-renderer) |
| `public/fonts/fang-zheng-xiao-zhuan-ti.ttf` | 方正小篆体 Fang Zheng Xiao Zhuan Ti |
| `public/fonts/ebas927.ttf` | EBAS seal script font |
| `public/fonts/jin-wen.ttf` | JinWen (金文) bronze inscription font |
