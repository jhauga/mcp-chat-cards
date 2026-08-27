# ![mcp-chat-cards](assets/logo.png)

An MCP (Model Context Protocol) server that renders interactive HTML cards inside desktop
chat clients. Instead of walls of text, conversations get tab boxes, tables, charts, forms,
short video clips, collapsible sections, and numbered outlines. On hosts that support the
[MCP Apps extension](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
(SEP-1865), cards render inline in the conversation as sandboxed iframes; other hosts
receive each card as a self-contained embedded HTML resource.

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
- **Animation cards**: model-composed animated clips for when no direct video URL exists -
  sequential scenes of text, staggered bullet builds, simple SVG diagrams that trace
  themselves in, and single-series charts that zoom into the data range under discussion,
  all with video-style play/pause, replay, and progress controls.
- **Show/hide cards**: collapsible sections with show-all/hide-all controls.
- **Sequential list cards**: nested ordered lists numbered 1., 1.1., 1.1.1. via CSS counters.
- **Document cards**: render a markdown document (a guide or walkthrough the model wrote)
  as one interactive card with collapsible sections, styled tables, and copyable code.
- **Code tour cards**: present a project as one tab per source file, in the order the
  files are given (README and manifests hoisted first). Source files are syntax-highlighted
  for their detected language and line-numbered behind a **Raw | Code** toggle, the way a
  repository browser shows a file. Markdown files render as a formatted page instead, behind
  a **Raw | Rendered** toggle - a README in a tour reads as documentation, and the source is
  still one click away.
- **Model-generated file ingestion**: read local text files and unpack zip archives the
  model produced earlier in the conversation, so its own deliverables plug straight into
  cards without retyping anything.
- **Automatic multi-part splitting**: large documents and projects are packed into parts
  that each stay under a card size budget, so hosts never truncate an oversized result.
  Each part renders as its own card and the result says exactly how to fetch the next.
- **Reference fetching**: `fetch_reference` pulls a public page and returns structured
  data (headings, text, tables, images, links, form specs) ready to feed into card tools.
- **Card tutor**: educational cards can mark terms that show tooltips after a hover dwell,
  and define right-click context actions that send model-anticipated prompts.
- **Movable content**: card blocks can be drag-reordered, drag out of the card carries the
  block as HTML, and every card has a "Copy card" button that copies the standalone HTML
  for pasting into other responses or files.
- **Header toggles**: every card header has a `</>` button that shows or hides the card's
  own HTML source in a code panel, and a chevron button beside it that collapses the card
  down to its header row and expands it again.
- **Efficient prompt builder**: every card's right-click menu has a built-in "Generate
  Efficient Verbose Prompt" item that opens a three-step flow: a 350-character gist, up to
  three rounds of multiple-choice refinement (each question with a free-text "Other"), and
  a finished prompt shown with its character and token count, editable in place, copyable,
  and sent only after a confirmation box. The model reads a bounded gist and bounded
  answers instead of a rambling thread, so the only long text in the exchange is the prompt
  the user wanted.
- **Copyable cards**: every card's right-click menu has a built-in "Copy card" item that
  copies the standalone HTML, mirroring the header button. For visual placement,
  `get_insert_bookmarklet` returns a bookmarklet that shows a floating "Insert Card" item
  on right-click and injects the copied card at that spot (page-local preview; gone on
  reload).

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
| `create_video_card` | HTML video player for a short clip (direct file URL, `data:video/*`, or `blob:`; streaming platform pages are rejected) |
| `create_reveal_card` | Collapsible show/hide sections (text, HTML, or code per section) |
| `create_list_card` | Nested sequential outline (1., 1.1., 1.1.1.) |
| `create_markdown_card` | Render a markdown document (content or file path) as one card |
| `create_code_tour_card` | Render a project (zip path or explicit files) as file tabs: highlighted source behind Raw/Code, `.md` behind Raw/Rendered |
| `create_prompt_gist_card` | Step 1 of the efficient-prompt flow: collect a 350-character gist |
| `create_prompt_refine_card` | Step 2: multiple-choice questions that close the gaps (max 3 rounds) |
| `create_efficient_prompt_card` | Step 3: the finished prompt, editable, copyable, sent on confirmation |
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

### Example: the efficient-prompt flow

"Generate Efficient Verbose Prompt" in any card's right-click menu sends a message tagged
`[efficient-prompt]`. The model answers with `create_prompt_gist_card`, and the gist the
user submits carries the rules for the rest of the flow, so nothing has to be restated:

```json
{
  "round": 1,
  "questions": [
    {
      "name": "depth",
      "question": "How much detail?",
      "options": ["Overview", "Step by step", "Line by line"]
    },
    {
      "name": "output",
      "question": "What should come back?",
      "options": ["A table", "A checklist", "Prose"],
      "multiple": true
    }
  ]
}
```

Each question also renders a free-text "Other" input under the group's own name, so a typed
answer arrives joined with the checked ones. Anything left blank comes back empty, which the
submitted prompt spells out as "no preference". The flow ends with:

```json
{
  "prompt": "Audit config/loader.py for unhandled error paths. Output: a table of file, line, failure mode, and fix, then one line on the riskiest one.",
  "notes": "Assumes the current logging setup stays."
}
```

The card shows that prompt with its character and token count and a **Send this prompt**
button. Clicking it opens a confirmation box; only "Yes, send it" hands the prompt to the
conversation. On hosts with no channel back to the chat, the copy button is the whole
story: the prompt is copied and the user pastes it as their next message.

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
button. Explicit `files` keep the order the caller gives them (README and manifests are
hoisted to the front), so a deliberate teaching order - data model, then errors, then
the entry point - renders as written instead of alphabetically. Build caches
(`target/`, `node_modules/`) and binary entries are skipped automatically. Use `unpack_archive` or `read_local_file` first when the model needs to
inspect contents before deciding which cards to build.

When a document or project exceeds the card size budget (default about 32,000 characters
of card markup, tunable via `MCP_CHAT_CARDS_CARD_BUDGET`), the tool splits it at natural
boundaries - H2 sections for documents, whole files for tours - and returns part 1 with
an instruction like "call create_code_tour_card again with part: 2". The model repeats
the call until every part has rendered as its own card, and oversized single files are
truncated with a visible notice.

The budget is measured against what a file costs **after** rendering, not its length on
disk: source is HTML-escaped into the tab panel, where a single `<` becomes four
characters, so a handful of markup-dense files can cost far more than their raw size
suggests. Every finished result is then measured once more against the host's ceiling
(about 40,000 characters of serialized result, tunable via
`MCP_CHAT_CARDS_RESULT_LIMIT`). A card that is still too large and cannot split itself -
a table with thousands of rows, say - returns an actionable error naming the overage
instead of an oversized result that the host would silently refuse to render.

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
`_meta.ui.resourceUri` and declares an output schema (hosts drop `structuredContent`
from schema-less tools, leaving the card nothing to paint). Hosts that support the Apps
extension (recent Claude Desktop builds among them) render the template inline in the
chat as a sandboxed iframe, complete the `ui/initialize` handshake, and deliver the tool
result to it. The template is defensive about the parts that fail silently: it announces
`ui/notifications/initialized` on a timeout as well as on the handshake reply (the host
withholds the tool result until it sees the announcement), locates the card payload by
deep search rather than one fixed nesting, reports `ui/notifications/size-changed` after
every paint and on resize so the iframe takes its real height, and adopts the host's
theme (including a full dark palette). Card interactions travel back over JSON-RPC
postMessage: form submissions and context actions become `ui/message` requests (the next
conversation prompt), links go through `ui/open-link`, and telemetry uses logging
notifications.

**Standalone document fallback.** For clients that did not declare the Apps extension,
each result carries a link to `ui://mcp-chat-cards/html/<card-id>`. Reading that resource
returns the same card as a self-contained HTML document (inline CSS and JS, restrictive
Content-Security-Policy, no external scripts). Hosts without Apps support but with MCP-UI
style rendering show that document in a sandboxed panel; there the card posts MCP-UI
style messages (`prompt`, `notify`, `link`).

The document is deliberately **not** inlined in the tool result. Its theme and runtime are
byte-for-byte identical in every card, so inlining repeated about 16 KB of boilerplate per
call: it crowded out the caller's context and was the main reason an otherwise ordinary
card could exceed a host's result ceiling and render nothing at all. Set
`MCP_CHAT_CARDS_EMBED_HTML=1` to restore the inline copy for a host that cannot follow a
resource link. The server keeps the last 24 rendered cards available for reading.

### Consistent result shape

Every card tool returns the same three things, whatever the card kind:

| Part | Contents |
| --- | --- |
| `content[0]` | Text summary of the card, meaningful on its own |
| `content[1]` | Resource link to the standalone HTML (omitted for Apps hosts) |
| `structuredContent` | `{ "card": { "articleHtml": "…", "config": { "id", "kind", … } } }` |

### Rendering surface

Cards render inline in the Claude desktop app sidebar. Other surfaces (mobile and web)
receive the text summary and the structured payload but do not paint the card, so each
summary is written to stand alone and tools are instructed to state a card's conclusion in
the conversation as well.

### Text fields are plain text

Every text field a tool accepts - titles, labels, cell values, tutor tips - is plain text
and is escaped by the server exactly once. Callers must not pre-escape: pass
`Predict, Spot & Fix`, not `Predict, Spot &amp; Fix`.

Input is never decoded first, in any field. A caller who does pass `&amp;` gets a card
that displays the six characters `&amp;`, because that is what a guide documenting HTML,
escaping, or templating means to show its reader. The rule is the same everywhere, so the
same string renders identically in a table cell, a tab, a markdown table, and a code
sample.

Raw HTML is only honoured in fields named `html` (`create_tab_card` and
`create_reveal_card` sections), where it is sanitized: scripts, event handlers, frames,
forms, and dangerous URLs are stripped while formatting such as `<b>` and `<i>` is kept.
Everywhere else - including HTML written inside a `create_markdown_card` document - tags
render as literal text, so use markdown syntax for formatting there. Escaped block-level
HTML is wrapped in the paragraph the markdown structure implies rather than dropped
between siblings as loose text, and HTML comments are dropped rather than shown, since a
`<!-- markdownlint-disable -->` directive is not prose.

### Where paths resolve

`create_markdown_card(path)`, `create_code_tour_card(archivePath)`, `read_local_file`, and
`unpack_archive` all resolve paths on **the filesystem of the machine running this server**.
When the server is reached over a remote bridge, that is not the caller's sandbox: a file
the model generated on its own side does not exist here. Pass the content inline
(`markdown`, `files`) in that case. A path from the wrong operating system - say
`/home/demo-user/project.zip` sent to a server running on Windows - is rejected with an
error naming the mismatch rather than resolved onto a drive where it never existed; the
same goes for Windows paths sent to a POSIX server and for unexpanded `~/` paths. Set
`MCP_CHAT_CARDS_FS_ROOT` to confine local reads to one directory.

## Interactivity notes and limits

- Drag and drop reorders blocks inside one card. Dragging a block out of the card carries
  its HTML in the drag data; dropping into another response requires host support, which
  desktop chat clients generally do not expose yet.
- "Copy card" copies the standalone HTML document so a card can be reproduced in another
  response, a file, or a browser tab.
- Tutor tooltips appear after hovering a marked term for about 1.2 seconds; the card also
  notifies the host so the model can follow up while the user explores. Each term is
  marked once per card (longest term wins where two overlap), duplicates in the term list
  are ignored, and marking never happens inside code samples, native tooltips, or another
  term's tip. Matching is case-sensitive, so a tip written for `PATH` does not attach
  itself to a filesystem `path`; set `caseInsensitive: true` on a term to match any
  casing. Pass `tutorTermsInCode: true` to `create_code_tour_card` to opt code in.
- Every card result carries `structuredContent.parts` as `{ current, total, hasMore }`,
  so one completeness check works on every card type. While `hasMore` is true, content has
  been withheld and the caller calls the same tool again with `part: current + 1`. Only
  `create_markdown_card` and `create_code_tour_card` can split; every other card always
  reports `{ current: 1, total: 1, hasMore: false }`. The rendered title keeps its
  human-readable `(part 1 of 2)` suffix for the reader.
- The split threshold is measured on **rendered** characters, not on the input a caller
  writes. Escaping expands source unpredictably - `<`, `>`, `&`, and quotes each become
  four to six characters - so a payload that looks well under the budget can cross it and
  a larger-looking one may not. Read `parts.hasMore` rather than predicting from input
  size. A markdown document with no H2 headings has no split boundary and always renders
  as one part.
- In a code tour, a source file whose language the highlighter knows gets a **Raw | Code**
  toggle. Code is the view on arrival: syntax-highlighted, with line numbers in an
  unselectable gutter, so a copy or a drag through the file picks up the file and not its
  numbering. Raw is the same text with the highlighting and gutter switched off, so the card
  carries one copy of the source rather than two. Languages covered: C, C++, C#, CSS, Go,
  Java, JavaScript, JSON, JSX, PHP, Python, Ruby, Rust, shell, SQL, TOML, TSX, TypeScript,
  and YAML, plus the usual aliases (`node`, `js`, `py`, `golang`, `yml`, and so on). Anything
  else renders as the plain code block it always did.
- Highlighted files cost more card budget than plain ones (roughly two to three times, since
  every token carries a span), and the packer measures the rendered panel, so a large tour
  splits into more parts than it used to rather than overflowing a card.
- In a code tour, a `.md`, `.markdown`, or `.mdx` file gets a Raw/Rendered toggle. Rendered
  is the view on arrival and shows the document as a page (headings, card-styled tables,
  links, fenced code with copy buttons, never folded into reveals); Raw is the ordinary
  code block, whitespace preserved, whose copy button returns the source byte for byte.
  Both views ship inside the card, so switching costs no round trip and the choice survives
  switching between file tabs. Every other extension is unchanged.
- Right-click context actions are defined by the model per card; `{{selection}}` in an
  action prompt is replaced with the user's selected text. Two items are always present
  regardless of what the model defined: "Generate Efficient Verbose Prompt" and "Copy card".
- The finished prompt card never sends on a single click. The first click opens a
  confirmation box; the prompt goes to the conversation only when that box is accepted, and
  what is sent is whatever the textarea holds at that moment, edits included.
- Form answers are gathered per field name, and empty values are dropped, so a choice group
  and a text input can share one name and arrive as a single comma-joined answer. Every
  named control still yields a key, so an unanswered group renders as an empty value rather
  than leaving a literal `{{name}}` in the prompt.

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

## Debugging cards in Claude Desktop

If a card mounts but stays empty, the failure is usually silent, so the template traces
everything to the console:

1. Enable Developer Mode in Claude Desktop (Settings, Developer), then open the webview
   developer tools for the conversation.
2. Filter the console for `[mcp-chat-cards]`. Every JSON-RPC message the card sends and
   receives is logged with its direction (`tx`/`rx`), so a missing handshake reply or an
   undelivered tool result is visible immediately.
3. Run `window.__mccDebug()` in that console for a snapshot: template version, whether
   `initialized` was announced, whether a card painted, the rendered card HTML, and the
   last 50 protocol messages. Paste its output when reporting a rendering issue.

## Supplemental ports

The [extension/](extension/) folder contains supplemental ports of the card tools for
other hosts. Both are self-contained - they do not import from `src/` or `dist/`, and
the MCP server is unaffected by them.

- [extension/github/](extension/github/README.md) - a GitHub Copilot canvas extension
  named `chat-cards`. The agent drives the same card kinds (tabs, tables, charts, forms,
  show/hide, sequential lists, markdown documents, video) through canvas actions, and
  form submissions come back to the conversation as prompts. Its README covers the
  action list, the differences from the MCP tools, and how the folder maps onto the
  awesome-copilot contribution layout.
- [extension/claude/](extension/claude/README.md) - a Claude artifact template: one
  self-contained HTML page whose card spec block Claude fills and publishes as an
  artifact. Forms and right-click actions produce prompts the user copies back into
  the conversation.

## Development

```bash
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite (unit + in-memory MCP integration)
npm run coverage   # run tests with V8 coverage
npm run dev        # compile in watch mode
```

## License

MIT. See [LICENSE](LICENSE).
