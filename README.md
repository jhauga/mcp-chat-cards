# mcp-chat-cards

An MCP (Model Context Protocol) server that renders interactive HTML cards inside desktop
chat clients. Instead of walls of text, conversations get tab boxes, tables, charts, forms,
short video clips, collapsible sections, and numbered outlines. On hosts that support the
[MCP Apps extension](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
(SEP-1865), cards render inline in the conversation as sandboxed iframes; other hosts
receive each card as a self-contained embedded HTML resource.

> Status: `0.0.0-alpha`. Interfaces and card markup may change without notice.

## Features

- **Tab cards**: view different contexts of one subject side by side (per language,
  per OS, per skill level), including code samples with copy buttons.
- **Table cards**: build HTML tables from explicit rows or loosely delimited raw text.
  Delimiters are auto-detected, columns are balanced, and URL cells become links.
- **Chart cards**: dynamically generated SVG bar, line, pie, and donut charts with
  legends and a collapsible data table for accessibility.
- **Form cards**: forms the user fills in to give the conversation context and direction.
  Submitting sends the values back to the chat as the next prompt.
- **Mirrored website forms**: fetch a real page, rebuild one of its forms as a card, then
  submit the actual website form with the user-entered values via `submit_web_form`.
- **Video cards**: HTML `<video>` players for short clips.
- **Show/hide cards**: collapsible sections with show-all/hide-all controls.
- **Sequential list cards**: nested ordered lists numbered 1., 1.1., 1.1.1. via CSS counters.
- **Document cards**: render a markdown document (a guide or walkthrough the model wrote)
  as one interactive card with collapsible sections, styled tables, and copyable code.
- **Code tour cards**: present a project as one tab per source file, ordered README,
  manifest, then source, with language-tagged code and copy buttons.
- **Model-generated file ingestion**: read local text files and unpack zip archives the
  model produced earlier in the conversation, so its own deliverables plug straight into
  cards without retyping anything.
- **Reference fetching**: `fetch_reference` pulls a public page and returns structured
  data (headings, text, tables, images, links, form specs) ready to feed into card tools.
- **Card tutor**: educational cards can mark terms that show tooltips after a hover dwell,
  and define right-click context actions that send model-anticipated prompts.
- **Movable content**: card blocks can be drag-reordered, drag out of the card carries the
  block as HTML, and every card has a "Copy card" button that copies the standalone HTML
  for pasting into other responses or files.

## When the model should call this server

The server advertises itself for conversations about research, education, professional
skills, general hobbyist skills (woodworking, arts, and similar), professional topics,
history, and news, plus related subjects, whenever a card communicates better than text.

## Installation

```bash
git clone https://github.com/jhauga/mcp-chat-cards.git
cd mcp-chat-cards
npm install
npm run build
```

Requires Node.js 18.17 or newer.

## Use with Claude Desktop

Add the server to `claude_desktop_config.json` (Settings > Developer > Edit Config),
adjusting the path to where you cloned the repository:

```json
{
  "mcpServers": {
    "chat-cards": {
      "command": "node",
      "args": ["C:/path/to/mcp-chat-cards/dist/index.js"]
    }
  }
}
```

Restart the desktop client after saving. The same stdio command works in any MCP host;
for hosts that support MCP UI resources, cards render as sandboxed iframes.

## Tools

| Tool | Purpose |
| ---- | ------- |
| `create_tab_card` | Tabbed views of one subject (text, HTML, or code per tab) |
| `create_table_card` | HTML table from rows or raw text with delimiter detection |
| `create_chart_card` | SVG bar, line, pie, or donut chart with data table |
| `create_form_card` | Form whose submission becomes the next conversation prompt |
| `create_video_card` | HTML video player for a short clip (direct file URL) |
| `create_reveal_card` | Collapsible show/hide sections |
| `create_list_card` | Nested sequential outline (1., 1.1., 1.1.1.) |
| `create_markdown_card` | Render a markdown document (content or file path) as one card |
| `create_code_tour_card` | Render a project (zip path or explicit files) as file tabs |
| `read_local_file` | Read a local text file for review or card building |
| `unpack_archive` | List a local zip and return its text file contents |
| `fetch_reference` | Fetch a public page and return structured extracted data |
| `mirror_web_form` | Rebuild a website form as an interactive card |
| `submit_web_form` | Submit user-confirmed values to the real website form |

### Example: `create_table_card`

```json
{
  "title": "JavaScript array methods",
  "headers": ["Method", "Purpose"],
  "rows": [
    ["map", "Transform each item"],
    ["filter", "Keep matching items"],
    ["reduce", "Fold items into one value"]
  ]
}
```

**Output:** a text summary plus an embedded resource
(`ui://mcp-chat-cards/<id>`, `text/html`) containing the full card document.

### Example: `create_form_card`

```json
{
  "title": "Study preferences",
  "promptTemplate": "Teach {{topic}} with {{style}} examples.",
  "fields": [
    { "name": "topic", "label": "Topic", "required": true },
    { "name": "style", "type": "select", "options": ["practical", "theoretical"] }
  ]
}
```

When the user submits the card, the filled template is posted to the host as the next
prompt. If the host does not consume the message, the card reveals the prompt text with a
copy button as a fallback.

### Example: plug-n-play with files the model generates

Suppose earlier in the conversation the model built a small project and delivered
`project.zip` plus a `GUIDE.md` walkthrough. Instead of the user unpacking and reading
them by hand, the model turns them into interactive cards in two calls:

```json
{ "path": "C:/Users/jane/Downloads/GUIDE.md" }
```

sent to `create_markdown_card` renders the whole guide as one card: the first H1 becomes
the title, each H2 section folds into a show/hide reveal, tables get card styling, and
every fenced code block gets a copy button.

```json
{
  "title": "Project source tour",
  "archivePath": "C:/Users/jane/Downloads/project.zip",
  "intro": "Read the guide card first, then follow these files in order."
}
```

sent to `create_code_tour_card` unpacks the archive in memory and renders one tab per
text file, ordered README, manifest, then source, each language-tagged with a copy
button. Build caches (`target/`, `node_modules/`) and binary entries are skipped
automatically. Use `unpack_archive` or `read_local_file` first when the model needs to
inspect contents before deciding which cards to build.

### Example: mirrored website form

1. `mirror_web_form` with `{ "url": "https://example.com/newsletter" }` renders the page's
   signup form as a card.
2. The user fills it in and submits; the card returns a structured payload to the chat.
3. The model reviews the values with the user, then calls `submit_web_form` with the
   payload to submit the real form and reports the HTTP result.

## How cards render

The server supports two delivery paths, negotiated automatically by the host:

**Inline in the conversation (MCP Apps, SEP-1865).** The server pre-declares one UI
template resource at `ui://mcp-chat-cards/card.html` with MIME type
`text/html;profile=mcp-app`, and every card tool links to it through
`_meta.ui.resourceUri`. Hosts that support the Apps extension (recent Claude Desktop
builds among them) render the template inline in the chat as a sandboxed iframe, complete
the `ui/initialize` handshake, and deliver the tool result to it. The template reads the
card markup from the result's `structuredContent.card` and renders it in place. Card
interactions travel back over JSON-RPC postMessage: form submissions and context actions
become `ui/message` requests (the next conversation prompt), links go through
`ui/open-link`, and telemetry uses logging notifications.

**Embedded resource fallback.** The same tool results also carry the full card as a
self-contained HTML document (inline CSS and JS, restrictive Content-Security-Policy, no
external scripts) in an embedded resource block with a `ui://mcp-chat-cards/<id>` URI.
Hosts without Apps support but with MCP-UI style rendering show that document in a
sandboxed panel; there the card posts MCP-UI style messages (`prompt`, `notify`, `link`).

Hosts without any iframe rendering still receive the HTML and can save it to a file or
show it as text; the "Copy card" button and the form prompt fallback keep the features
usable everywhere.

## Interactivity notes and limits

- Drag and drop reorders blocks inside one card. Dragging a block out of the card carries
  its HTML in the drag data; dropping into another response requires host support, which
  desktop chat clients generally do not expose yet.
- "Copy card" copies the standalone HTML document so a card can be reproduced in another
  response, a file, or a browser tab.
- Tutor tooltips appear after hovering a marked term for about 1.2 seconds; the card also
  notifies the host so the model can follow up while the user explores.
- Right-click context actions are defined by the model per card; `{{selection}}` in an
  action prompt is replaced with the user's selected text.

## Security

- Local file tools (`read_local_file`, `unpack_archive`, and the path/archive inputs of
  the document and code tour cards) read text only, cap sizes, refuse binaries, and cap
  archive extraction (entry count, per-file, and total bytes). Set
  `MCP_CHAT_CARDS_FS_ROOT` to confine all local reads to one directory.
- Outbound requests are limited to http(s) URLs resolving to public addresses. Localhost,
  RFC 1918, link-local, CGNAT, and equivalent IPv6 ranges are blocked, redirects are
  re-validated, bodies are size-capped, and requests time out. Set
  `MCP_CHAT_CARDS_ALLOW_PRIVATE=1` only if you intentionally need intranet fetches.
- All model- and user-supplied text is HTML-escaped; fetched third-party HTML is sanitized
  (scripts, event handlers, frames, forms, and dangerous URLs are stripped).
- Cards ship a restrictive CSP and load no external scripts, stylesheets, or fonts.
- `submit_web_form` should only be called with values the user entered in a mirrored form
  card or explicitly confirmed.

## Development

```bash
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite (unit + in-memory MCP integration)
npm run coverage   # run tests with V8 coverage
npm run dev        # compile in watch mode
```

## License

MIT. See [LICENSE](LICENSE).
