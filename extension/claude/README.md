# Chat Cards - Claude artifact template

A supplemental Claude artifact port of the [mcp-chat-cards](../../README.md) card kinds.
Everything lives in one self-contained HTML page - no build step, no dependencies, no
network requests. Claude fills the page's card spec block and publishes the result as an
artifact; the same file also opens directly in a browser.

## How Claude uses it

1. Start from `chat-cards.html`.
2. Replace the JSON array inside `<script id="mcc-card-specs" type="application/json">`
   near the top of the file with one object per card: `{ "kind": "<kind>", ...options }`.
3. Publish the edited page as the artifact. To change the deck later, edit the same
   block and publish again.

Inside JSON strings, write a literal `</script>` as `<\/script>` so the spec block
survives HTML parsing.

## Card kinds

| `kind` | Card |
| ------ | ---- |
| `tabs` | Tabbed views of one subject (markdown, text, HTML, or code per tab with copy buttons) |
| `table` | HTML table from explicit rows or loosely delimited raw text (delimiter auto-detected, URL cells become links) |
| `chart` | SVG bar, line, pie, or donut chart with legend and a collapsible data table |
| `form` | Form whose submission produces a prompt to send back to the conversation |
| `show-hide` | Collapsible sections with show-all/hide-all controls |
| `list` | Nested sequential outline numbered 1., 1.1., 1.1.1. |
| `document` | Markdown document as one card: H1 becomes the title, H2 sections fold into reveals |
| `video` | HTML video player for a short clip (direct file URL, `data:video/*`, or `blob:`) |

Option shapes match the create actions of the
[canvas extension](../github/README.md) and the MCP tools. Example spec block:

```json
[
  {
    "kind": "table",
    "title": "JavaScript array methods",
    "headers": ["Method", "Purpose"],
    "rows": [
      ["map", "Transform each item"],
      ["filter", "Keep matching items"]
    ]
  },
  {
    "kind": "form",
    "title": "Study preferences",
    "promptTemplate": "Teach {{topic}} with {{style}} examples.",
    "fields": [
      { "name": "topic", "label": "Topic", "required": true },
      { "name": "style", "type": "select", "options": ["practical", "theoretical"] }
    ]
  }
]
```

Cards keep the deck interactions: copy card as a standalone HTML document, view a
card's HTML source, collapse, drag to reorder, tutor-term tooltips after a hover
dwell, per-card right-click actions, and a light/dark theme toggle (a `data-theme`
attribute stamped on the root element by a host is respected).

## Differences from the canvas extension

- **No live agent channel.** Submitting a form reveals the built prompt with a copy
  button, and right-click actions copy their prompt to the clipboard; the user pastes
  it into the conversation as their next message.
- **The spec block is the deck.** Removing or reordering cards on the page changes
  only that open page; the deck itself changes by editing the spec block and
  publishing again. There are no `update_card`/`remove_card` style operations.
- **Invalid specs stay visible.** A spec that cannot be built renders as an error
  card naming the problem instead of disappearing.
- **Media sources.** A host page may block external `http(s)` media; `data:` URIs
  always work for images and short clips.

## Folder layout

```text
extension/claude/
  chat-cards.html   The artifact template (theme, card builders, deck runtime, spec block)
  README.md         This file
```

The folder is self-contained - it imports nothing from the rest of this repository -
and can be copied elsewhere as-is. The card builders inside `chat-cards.html` mirror
`extension/github/cards-core.mjs`; when one changes, port the change to the other.
