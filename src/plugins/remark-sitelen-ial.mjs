import { visit, SKIP } from 'unist-util-visit'

// Matches ASCII “ and typographic “ “ (U+201C/U+201D) — remarkSmartypants converts
// straight quotes to curly quotes before this plugin runs, so both forms must match.
const SITELEN_INLINE_RE = /\n\{:sitelen data-sitelen-ratio=[“””]([^”””]+)[“””]\}\s*$/
const SITELEN_STANDALONE_RE = /^\{:sitelen data-sitelen-ratio=["“”][^"“”]+["“”]\}$/

/**
 * Serialize mdast inline nodes back to an HTML string.
 * Used to reconstruct the full text of a paragraph before table-detection logic runs.
 */
function serializeChildren(children) {
  return children.map(child => {
    switch (child.type) {
      case 'text':       return child.value
      case 'html':       return child.value
      case 'inlineCode': return `<code>${child.value}</code>`
      case 'strong':     return `<strong>${serializeChildren(child.children)}</strong>`
      case 'emphasis':   return `<em>${serializeChildren(child.children)}</em>`
      case 'link':       return `<a href="${child.url}">${serializeChildren(child.children)}</a>`
      default:           return child.value ?? ''
    }
  }).join('')
}

function parseCellsFromLine(line) {
  const parts = line.split('|')
  // Remove leading empty element (line starts with '|') and trailing empty if present
  const cells = parts.slice(1)
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop()
  return cells.map(c => c.trim())
}

function parseAlignments(alignLine) {
  return parseCellsFromLine(alignLine).map(cell => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
    if (cell.endsWith(':')) return 'right'
    return null  // left (browser default)
  })
}

/**
 * Remark plugin handling Kramdown IAL patterns used in the lipu-nasin-pona content files.
 *
 * Five transforms:
 * 1. {:sitelen data-sitelen-ratio="N"} at end of a toki pona paragraph → adds
 *    data-sitelen="true" and data-sitelen-ratio="N" attributes to the <p> element.
 * 2. {:sitelen data-sitelen-ratio="N"} as a standalone paragraph → removed.
 * 3. Headerless Kramdown tables (first line is an alignment row like |:-:|-|-) →
 *    converted to a raw <table class="loseta"> HTML node. remark-gfm cannot parse
 *    these because GFM requires a header row; this pass handles them explicitly.
 * 4. {:.loseta} after a standard table → adds class="loseta" to that table node.
 * 5. Jekyll {% include %} / {%comment%} paragraphs → removed entirely.
 */
export function remarkSitelenIAL() {
  return (tree) => {
    // Pass 1: {:sitelen} IAL — either inline (end of paragraph) or standalone
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index == null) return
      const lastChild = node.children[node.children.length - 1]
      if (!lastChild || lastChild.type !== 'text') return

      const text = lastChild.value

      const inlineMatch = text.match(SITELEN_INLINE_RE)
      if (inlineMatch) {
        lastChild.value = text.slice(0, inlineMatch.index)
        if (lastChild.value === '') node.children.pop()
        node.data ??= {}
        node.data.hProperties = {
          'data-sitelen': 'true',
          'data-sitelen-ratio': inlineMatch[1],
        }
        return
      }

      if (text.trim().match(SITELEN_STANDALONE_RE)) {
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })

    // Pass 2: headerless Kramdown tables — first line is an alignment row (|:-:|-|-)
    // remark-gfm can only parse GFM tables (header row + delimiter row + data rows).
    // Kramdown tables start with the alignment row directly, so remark treats the whole
    // block as a paragraph. This pass detects that pattern and emits a raw HTML table.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index == null) return

      const fullText = serializeChildren(node.children)
      const lines = fullText.split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return

      // First line must start with | and consist only of alignment markers (no cell text)
      if (!lines[0].startsWith('|')) return
      const firstLineCells = parseCellsFromLine(lines[0])
      if (!firstLineCells.length) return
      if (!firstLineCells.every(c => /^[-:]+$/.test(c))) return

      const alignments = parseAlignments(lines[0])
      const lastLine = lines[lines.length - 1]
      const hasLoseta = lastLine === '{:.loseta}'
      const dataLines = hasLoseta ? lines.slice(1, -1) : lines.slice(1)
      if (dataLines.length === 0) return

      const htmlRows = dataLines.map(line => {
        const cells = parseCellsFromLine(line)
        const tds = cells.map((cell, colIndex) => {
          const align = alignments[colIndex]
          const styleAttr = align ? ` style="text-align:${align}"` : ''
          return `<td${styleAttr}>${cell}</td>`
        })
        return `<tr>${tds.join('')}</tr>`
      })

      const classAttr = hasLoseta ? ' class="loseta"' : ''
      const html = `<table${classAttr}>\n<tbody>\n${htmlRows.join('\n')}\n</tbody>\n</table>`
      parent.children.splice(index, 1, { type: 'html', value: html })
      return [SKIP, index]
    })

    // Pass 3: {:.loseta} placeholder — add class to preceding table, then remove paragraph.
    // Handles the case where remark-gfm DID parse a standard GFM table and the IAL
    // appears as a separate paragraph immediately after.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index == null) return
      if (node.children.length !== 1 || node.children[0].type !== 'text') return
      if (node.children[0].value.trim() !== '{:.loseta}') return

      if (index > 0 && parent.children[index - 1].type === 'table') {
        const table = parent.children[index - 1]
        table.data ??= {}
        table.data.hProperties = { class: 'loseta' }
      }
      parent.children.splice(index, 1)
      return [SKIP, index]
    })

    // Pass 4: remove Jekyll template directives in paragraph form
    // ({% include %}, {%comment%}...{%endcomment%})
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index == null) return
      if (!node.children.length) return
      const firstChild = node.children[0]
      if (firstChild.type === 'text' && firstChild.value.trim().startsWith('{%')) {
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })

    // Pass 5: remove raw HTML block nodes that wrap Jekyll directives
    // (e.g. <!-- {% include kasi-nav.html %} --> which remark parses as an html node)
    visit(tree, 'html', (node, index, parent) => {
      if (!parent || index == null) return
      if (node.value.includes('{%')) {
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })
  }
}
