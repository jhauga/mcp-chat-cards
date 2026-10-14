# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.0.2.0] - 2026-08-27

### Fixed

- Right-click menu items that send a prompt no longer appear to do nothing. Choosing a
  model-defined context action, or "Generate Efficient Verbose Prompt", handed the prompt
  to the host and then said nothing at all: on a host that receives `ui/message` without
  answering it, the click was indistinguishable from a broken build. Only the items that
  send a prompt were affected - "Copy card" is local and kept working - so the failure
  looked arbitrary. A menu prompt now always reports its outcome: confirmed when the host
  acknowledges the handoff, and otherwise, after a short wait, an in-card panel holding
  the prompt with a copy button, since an unacknowledged send must never be reported as
  sent. The MCP-UI postMessage fallback has no reply channel at all, so it always takes
  the second path.
- The canvas port had the same defect from the other direction: menu actions called
  `/api/prompt` and discarded both the `delivered` flag and any error. The result is now
  shown as a toast, and a prompt the agent could not be reached with goes to the
  clipboard.

### Added

- Efficient prompt builder. Every card's right-click menu now carries a built-in
  "Generate Efficient Verbose Prompt" item, alongside "Copy card" and whatever actions the
  model defined. It opens a three-step flow that turns a short description into one lean,
  self-contained prompt:
  1. A gist card asks, in no more than 350 characters, where the user wants to go. A live
     counter tracks what is typed, and the submission carries the rules for the rest of the
     flow, so nothing is restated later.
  2. Up to three refine rounds ask the fewest multiple-choice questions that close the gaps
     the gist left - radios by default, checkboxes where several answers can be true at
     once, and a free-text "Other" on every question. A question left blank comes back as
     "no preference" rather than as an unanswered token. The flow skips this step entirely
     when the gist is already clear.
  3. The finished prompt renders with its character and token count, editable in place.
     A **Send this prompt** button opens a confirmation box; the prompt reaches the
     conversation only when that box is accepted, and what goes is whatever the textarea
     holds at that moment. A copy button covers hosts with no channel back to the chat.

  The saving is in the shape of the exchange: the model reads a bounded gist and a bounded
  set of answers instead of a rambling thread, and answers with cards instead of prose, so
  the only long text in the whole flow is the prompt the user wanted.

- Syntax highlighting for source files in a code tour, behind a **Raw | Code** toggle. A file
  in `create_code_tour_card` used to be flat monospace text; it now reads the way a repository
  browser shows it - highlighted for its own language, line-numbered in an unselectable
  gutter, with Code as the view on arrival and Raw one click away. Nineteen languages ship
  with grammars (C, C++, C#, CSS, Go, Java, JavaScript, JSON, JSX, PHP, Python, Ruby, Rust,
  shell, SQL, TOML, TSX, TypeScript, YAML) plus the aliases a model reaches for (`node`,
  `js`, `py`, `golang`, `yml`). The grammar is chosen from the file's own detected language
  and compiled on first use, so a tour of Python files never touches the Rust rules and a
  language with no grammar renders as the plain code block it always did.

  Raw is the code view with its styling switched off rather than a second copy of the file,
  so the toggle costs no extra markup; the line-number gutter is a sibling of the code, so
  the copy button still hands back the file and nothing else.
- Markdown files in a code tour render as a page instead of a fenced code block. A README
  or guide in `create_code_tour_card` was shown as source like any other file, which is the
  one case where that is the wrong default. `.md`, `.markdown`, `.mdown`, `.mkd`, and `.mdx`
  files now render through the existing marked-based markdown pipeline - headings, card-styled
  tables, links, fenced code with copy buttons - with a **Raw | Rendered** toggle back to the
  source. Rendered is the arrival view; the raw pane is the ordinary code block and its copy
  button still returns the file byte for byte. Both views ship in the card, so the toggle
  costs no round trip and the choice survives switching file tabs. Unlike the markdown card,
  a file view keeps its own first H1: that heading belongs to the page, not to a card title.
  Every other extension renders exactly as before.
- Three MCP tools behind that flow: `create_prompt_gist_card`,
  `create_prompt_refine_card`, and `create_efficient_prompt_card`. The same three exist as
  canvas actions in the Copilot extension, and the same three card kinds
  (`prompt-gist`, `prompt-refine`, `prompt-final`) exist as spec kinds in the Claude
  artifact port.

### Changed

- A code tour's size budget measures the rendered panel for any file that is highlighted or
  rendered, not the file's escaped source. Highlighted markup runs roughly two to three times
  the size of plain source, so a large tour now splits into more parts than it used to. That
  is the intended trade: the packer and the renderer can never disagree, and a tour cannot
  quietly overflow the host's result ceiling. Files with no grammar are costed exactly as
  before.
- The markdown file view and the new code file view share one toggle mechanism
  (`data-mcc-view`, `data-mcc-view-set`, `data-mcc-pane`) and one runtime handler, rather than
  each carrying its own near-identical implementation.
- The canvas extension counts refine rounds itself rather than trusting the round number an
  agent supplies, and refuses a fourth round with an error that says to write the prompt
  now. Opening the flow from the canvas menu costs the conversation nothing: the extension
  builds the gist card directly, so the agent is first involved when the gist is submitted.
- The right-click menu opens over the empty deck as well as over a card in the canvas and
  artifact ports. Card-specific items still require a card; the prompt builder does not.
- Form answers are gathered per field name instead of assigned, and empty values are
  dropped. A choice group and a text input can now share one name and arrive as a single
  comma-joined answer, and an unanswered group renders as an empty value rather than
  leaving a literal `{{name}}` in the built prompt.
- The Claude artifact port strips the send button and confirmation box from the finished
  prompt card. That page has no channel to the conversation, so the clipboard is the whole
  story there and the card now says so.

## [1.0.0-alpha.0.1.3] - 2026-08-18

Follow-up to a third live review pass, which exercised every card tool against a running
instance and found six defects in what the tools actually returned.

### Fixed

- Text fields are escaped exactly once and never decoded first. The escaper used to skip
  the `&` of a well-formed character reference, so a caller who passed `&amp;` to document
  HTML got a card displaying `&` instead - and the same string rendered differently
  depending on which field it landed in: markdown fenced blocks and inline code preserved
  it, while markdown table cells, table card headers and rows, and tab card `text` and
  `code` fields silently decoded a level. Every non-`html` field is now literal text, so
  `&amp;` displays as `&amp;` everywhere. Raw `&`, `<`, `>`, `"`, `'`, and backslashes are
  unaffected.
- Multi-part results say so in a field a program can read. An oversized code tour or
  document announced the split only as `(part 1 of 2)` appended to the rendered title, so
  a consumer that did not string-scrape the HTML could not tell it was holding a partial
  payload and silently lost files. Card results now carry
  `structuredContent.parts { current, total, hasMore }`; the title suffix stays for
  humans, and both tool descriptions document the field.
- `create_video_card` rejects streaming platform page URLs (YouTube, Vimeo, Dailymotion,
  Twitch, TikTok, and similar, including subdomains) instead of emitting a `<video>`
  element that can never play. The error names the constraint and points at
  `create_animation_card`, as the tool description already advised. A direct URL whose
  path carries no recognized video extension is accepted but warned about in the summary.
- `create_markdown_card` no longer passes raw HTML through live. A `<div>` written in
  prose used to survive as an element and terminate its enclosing `<p>`, pushing the
  trailing prose outside the paragraph, while the same string was escaped by every other
  card. Markdown is now under one stated policy: raw HTML renders as literal text, the
  same as every other non-`html` field. Fields explicitly named `html` (tab and reveal
  sections) still accept sanitized markup.
- `tutorTerms` matching is case-sensitive. A tip written for `PATH` attached itself to the
  first lowercase `path` in the card - an unrelated and actively misleading gloss - and
  left the real reference unmarked. Terms now match case exactly; set
  `caseInsensitive: true` on a term to opt back into any-case matching. Word boundaries
  and the existing exclusions (code samples, tooltips, other terms' tips) are unchanged.
- `create_reveal_card` sections take `code` and `language`, mirroring the tab card, so
  indented source keeps its monospace, its leading whitespace, and its copy button instead
  of being flattened into a `<p>` with `<br>` breaks. A ``` fenced block inside a section's
  `text` is promoted to a code block for the same reason.

- Escaped block-level HTML in a markdown card is wrapped in the paragraph markup the
  markdown structure implies. Escaping made the content inert, but it was emitted as a
  bare text node between two `<p>` siblings, so it inherited no margin or line-height and
  collided visually with the paragraphs around it. HTML comments are now dropped rather
  than escaped, so a `<!-- markdownlint-disable -->` directive no longer turns into
  visible prose.

### Changed

- `structuredContent.parts` is emitted on **every** card result, not only the two tools
  that can split. Cards that cannot split report `{current: 1, total: 1, hasMore: false}`,
  so a generic completeness check (`if (result.parts.hasMore)`) works on every card type
  instead of throwing `undefined` on the ones that happen never to split - which is the
  same class of silent-partial-content bug the field was added to prevent.
- The canvas extension's card core (`extension/github/cards-core.mjs`) takes the same
  escaping and tutor-term changes, so a string renders identically on both surfaces.

### Added

- A test asserting every served tool schema is valid under JSON Schema 2020-12 - declaring
  either nothing (MCP's default dialect) or 2020-12 explicitly - so one tool regressing to
  another dialect cannot silently break every card call on a strict host again.
- Split fixtures (`test/fixtures/split-payloads.ts`) sized by measured RENDERED cost rather
  than raw input length, so the `parts.hasMore === true` branch is exercised
  deterministically. The budget is measured after escaping, which expands content
  unpredictably, so hand-built payloads split or do not split more or less by chance. A
  companion test asserts the fixtures still straddle the budget, so a change to the budget
  or the cost function fails loudly instead of leaving the split assertions passing
  vacuously.
- Regression cover for the behaviour verified in review: entity preservation across all six
  text fields, tutor terms with the adversarial early-lowercase / late-uppercase ordering,
  both directions of video source validation (including direct URLs a denylist must not
  sweep up), both reveal-card code paths, the tab `html` sanitizer keeping `<b>` and `<i>`
  while stripping scripts and `onerror`, and `{{token}}` surviving unsubstituted outside a
  form's `promptTemplate`, nesting included.

## [1.0.0-alpha.0.1.2] - 2026-08-14

Follow-up to a second live review pass (reviewed via Claude Desktop), which confirmed the
1.0.0-alpha.0.1.1 result-shape and size fixes in the running server and surfaced two new
findings around local paths and file ordering, both fixed here.

### Fixed

- Tool schemas are served without a JSON Schema draft-07 dialect declaration. The MCP SDK
  stamps every serialized zod schema with `"$schema": "http://json-schema.org/draft-07/schema#"`,
  and a strict host whose validator supports only the spec's default 2020-12 dialect
  (GitHub Copilot is one) rejected every tool declaring it - in practice every card tool,
  since only they carry an `outputSchema`, while schema-less tools kept working. Outgoing
  tool listings now drop the draft-07 stamp at the transport boundary (every emitted
  construct means the same thing in both dialects), so each host validates under its own
  default and accepts the tools. A canary test pins the SDK behavior so the shim is
  retired the moment an SDK upgrade emits a different dialect.
- Paths from another operating system are rejected with a clear error instead of being
  silently grafted onto the local filesystem. A POSIX path like `/home/demo-user/project.zip`
  sent to a server running on Windows previously resolved to
  `C:\home\demo-user\project.zip` and reported "not found" - a path that never existed on
  either machine. The error now names the mismatch and points the caller at passing file
  content directly when the file only exists on their side. Windows paths sent to a POSIX
  server and unexpanded `~/` paths are rejected the same way, on every path-taking tool
  (`read_local_file`, `unpack_archive`, markdown `path`, code tour `archivePath`).
- Code tour cards preserve the caller's file order instead of alphabetizing it. An
  explicit `files` list often encodes a teaching order (data model, then errors, then the
  entry point), which the previous reading-order sort destroyed; now only README and
  manifest files are hoisted to the front and everything else stays where the caller put
  it. Archive-sourced files still arrive in full reading order (README, manifest, then
  source), since zip entry order carries no intent.

### Changed

- The `create_code_tour_card` description states the ordering rule: explicit files render
  in the order given (README and manifests hoisted first); archive files are ordered
  README, manifest, then source.

### Added

- Exit attribution on stderr. The entry point now reports uncaught exceptions, unhandled
  rejections, transport closure, and the final exit code, so a host's per-server log can
  distinguish a server crash from a dropped connection. Unhandled rejections are logged
  and survived (card rendering is stateless per call); uncaught exceptions still exit
  after being named.

## [1.0.0-alpha.0.1.1] - 2026-08-11

### Fixed

- Card results no longer inline the standalone HTML document. Its theme and runtime are
  identical in every card, so echoing them added about 16 KB of boilerplate per call on
  top of markup `structuredContent` already carried - crowding the caller's context and
  pushing ordinary cards past the host's result ceiling, where they render nothing at
  all. Non-Apps hosts now get a link to `ui://mcp-chat-cards/html/<card-id>` and can read
  the same document from there; `MCP_CHAT_CARDS_EMBED_HTML=1` restores the inline copy.
  A small table card's result dropped from roughly 18 KB to about 1.2 KB.
- Code tours are budgeted by what a file costs after rendering rather than by its raw
  length, so a few markup-dense source files split into parts instead of producing one
  oversized card. Every finished result is measured against the host ceiling
  (`MCP_CHAT_CARDS_RESULT_LIMIT`, default 40,000 characters); a card that cannot split
  itself now returns an actionable error naming the overage instead of a result the host
  will silently refuse to render.
- Tutor term highlighting no longer corrupts markup. Terms were substituted term by term
  over previously rewritten output, which let one term land inside another term's
  `data-tip` attribute and inside SVG `<title>` tooltips, where the span showed as
  literal text. Substitution is now a single pass over visible text only: attributes,
  `<title>`, `<script>`, `<style>`, code samples, and text already inside an `.mcc-term`
  span are skipped, and emitted markup is never rescanned.
- Text fields are no longer double-escaped. A title passed as `Predict, Spot &amp; Fix`
  rendered as `Predict, Spot &amp;amp; Fix`; a `&` that already begins a well-formed
  character reference is now left alone. `<`, `>`, `"`, and `'` are still escaped
  unconditionally, so nothing a caller sends can reopen a tag or an attribute.
- Chart y-axis ticks are chosen as readable steps (1, 2, 2.5, or 5 times a power of ten)
  rather than by slicing the range into four equal parts, so integer data reads
  `0, 1, 2, 3, 4, 5` instead of `0, 1.3, 2.5, 3.8, 5`.
- Long chart category labels wrap onto two lines and carry the full text in an SVG
  `<title>`, instead of being hard-truncated to `Runtime spe…` with no way to see the rest.

- Video cards render in the MCP Apps template path, not only in the standalone fallback
  document. The player now sits in a frame that reserves a 16:9 box before metadata
  arrives, so a buffering or blocked clip can no longer collapse the card to an invisible
  zero-height element, and the template reports its size again once metadata lands.
- The card template carries its own Content-Security-Policy declaring
  `media-src https: data: blob:`, so a host default policy that omits media cannot
  silently stop a clip from loading.

### Changed

- Tutor terms are highlighted once per card by default (was up to three times), duplicate
  terms in the list are ignored, overlapping terms resolve longest-first, and a per-card
  ceiling caps total highlights. `create_code_tour_card` gained `tutorTermsInCode` to opt
  code samples back in.
- Tool descriptions state that paths resolve on the machine running the server rather
  than in the caller's sandbox, that cards render in the desktop sidebar only, that text
  fields take plain text, and what the size budgets are.
- `create_video_card` accepts a `data:video/*` URI or a `blob:` URL in addition to a
  direct http(s) URL, matching what the card CSP already permits. Inline sources are
  capped so a card payload stays small enough for hosts to render. A poster may likewise
  be a `data:image/*` URI.
- `create_video_card` gained an `autoplay` option, which implies `muted` because clients
  ignore unmuted autoplay.
- The video element carries its source both as a `src` attribute and as a `<source>`
  child, and an http(s) clip gets a visible "Open the clip directly" link. When a host
  strips the player from the injected markup, the card says so instead of showing a gap.
- `sanitizeHtml` keeps `data:image/*`, `data:video/*`, and `data:audio/*` sources;
  every other `data:` payload is still dropped.

## [1.0.0-alpha.0.1.0] - 2026-08-10

### Added

- `create_animation_card`: model-composed animated clips for when no direct video URL
  exists but motion communicates best. Scenes play sequentially in a 16:9 stage with
  play/pause, replay, and progress controls, built entirely from generated text, inline
  SVG, and CSS animation (no external assets, CSP-safe). Scene ingredients: headings and
  body text, staggered bullet builds, simple diagram shapes (rect/circle/line/arrow on a
  percent grid, with a "draw" transition that traces them in), and compact single-series
  bar/line charts whose viewBox animates into a chosen label range and back out
  (`chart.zoom`). Per-scene transition presets (fade/slide/zoom/draw) and durations let
  one schema produce endless clip variations; autoplay respects
  `prefers-reduced-motion`, and finishing a clip notifies the host. The video card tool
  now points to it when no direct URL is available.

- Collapse/expand card button in the card header: a chevron toggle that folds the card
  down to its header row and back, so long cards can be tucked away in the conversation.
  Collapse state changes are reported to the host as notifications, and the iframe
  resizes to the collapsed height on hosts that honor size-changed notifications.
- Show/hide card code button in the card header: a `</>` toggle, positioned left of the
  collapse/expand button, that reveals the card's own HTML source in a code panel with a
  copy button. Showing the code on a collapsed card expands the card first.
- Both header toggles (and their CSS) are created by the card runtime at init rather than
  rendered into the card markup, so cards from older tool results grow the buttons too
  when repainted, even against stale theme styling.
- Card builders accept `collapsible` and `codeToggle` options (both default `true`) to
  omit either header toggle.
- Insert Card bookmarklet: the `get_insert_bookmarklet` tool returns a bookmarklet plus
  usage steps. After "Copy card" puts a card's HTML on the clipboard, running the
  bookmarklet on the host page shows a floating "Insert Card" item beside every
  right-click; choosing it injects the copied card as a sandboxed iframe at that spot
  (above or below the element under the cursor). Page-local preview only - browsers do
  not let page script extend the native context menu, and the insertion disappears on
  reload.
- The card collapse toggle draws a thin inline SVG chevron that rotates between the
  expanded (pointing down) and collapsed (pointing right) states; icon buttons got a
  consistent square hit area.
- Built-in "Copy card" item in every card's right-click menu, below any model-defined
  context actions (separated by a divider). It copies the card's standalone HTML,
  mirroring the header button, and pairs with the Insert Card bookmarklet.

## [1.0.0-alpha.0.0.0] - 2026-08-10

### Added

- Initial MCP server with stdio transport for desktop chat clients.
- Card tools returning self-contained HTML documents as embedded `ui://` resources:
  `create_tab_card`, `create_table_card`, `create_chart_card`, `create_form_card`,
  `create_video_card`, `create_reveal_card`, and `create_list_card`.
- MCP Apps extension support (SEP-1865, spec 2026-01-26) so cards render inline in the
  conversation on supporting hosts instead of a side panel:
  - Pre-declared UI template resource at `ui://mcp-chat-cards/card.html` with MIME type
    `text/html;profile=mcp-app`.
  - Every card tool links to the template via `_meta.ui.resourceUri`.
  - Card tool results include `structuredContent.card` (article markup plus runtime
    config) consumed by the template.
  - The template performs the `ui/initialize` handshake, renders the card from
    `ui/notifications/tool-result`, and bridges card events to host JSON-RPC:
    prompts to `ui/message`, links to `ui/open-link`, telemetry to logging notifications.
  - The card runtime is exposed as a callable `window.mccInit()` with re-initialization
    guards so the Apps template can inject cards after load; standalone card documents
    still initialize automatically and the embedded-resource fallback is unchanged.
- Plug-n-play ingestion of model-generated files, so deliverables created earlier in a
  conversation become interactive cards without manual reassembly:
  - `create_markdown_card`: render a markdown document (inline content or a local file
    path) as one card - first H1 becomes the title, H2 sections fold into show/hide
    reveals with show-all/hide-all controls, tables get card styling, and fenced code
    blocks get copy buttons.
  - `create_code_tour_card`: render a project as one tab per source file (from a local
    zip path or explicit file data), ordered README, manifest, then source, with
    language tagging and copy buttons.
  - `read_local_file`: size-capped, text-only local file reads.
  - `unpack_archive`: in-memory zip listing and text extraction with caps on entry
    count, per-file size, and total size; build caches and binaries skipped.
  - Optional `MCP_CHAT_CARDS_FS_ROOT` environment variable to confine all local file
    access to one directory.
- Automatic multi-part splitting so hosts never truncate oversized card results:
  - Documents split at H2 boundaries and code tours split at file boundaries when they
    exceed the card size budget (default ~32,000 characters of card markup, tunable via
    `MCP_CHAT_CARDS_CARD_BUDGET`); oversized single files are truncated with a notice.
  - Both bulk tools accept a `part` parameter and each result names the next part to
    request, so every part renders as its own card.
  - Clients that declare the MCP Apps extension capability receive card results without
    the embedded HTML fallback resource, halving payload size on Apps hosts.
- Render-reliability hardening of the Apps template (modeled on a known-good SEP-1865
  reference implementation):
  - Every card tool declares an output schema, so hosts ship `structuredContent` instead
    of dropping it and leaving the card nothing to paint.
  - `ui/notifications/initialized` fires on a timeout as well as on the handshake reply,
    so a host that never answers `ui/initialize` cannot leave a mounted card empty.
  - The card payload is located by deep search (any object with `articleHtml`) and
    method names are matched by substring, tolerating host nesting and naming variance.
  - `ui/notifications/size-changed` is reported after every paint and on resize so the
    inline iframe takes its content height.
  - The template adopts the host theme: applies `hostContext.styles.variables` and a
    full dark palette when the host reports `theme: "dark"`.
  - Console tracing (`[mcp-chat-cards]` prefix) plus a `window.__mccDebug()` inspector
    for Claude Desktop's webview developer tools.
- Reference tools: `fetch_reference` (structured page extraction: headings, text, tables,
  images, links, form specs), `mirror_web_form` (rebuild a website form as a card), and
  `submit_web_form` (submit user-confirmed values to the real form).
- Shared card runtime: tabs, show/hide, copy card, copy code, drag-to-reorder blocks,
  form-to-prompt submission with fallback, tutor dwell tooltips, right-click context
  actions, and MCP-UI style postMessage host integration.
- Text-to-table conversion with delimiter detection and column balancing, replacing the
  legacy reference implementation.
- Sequential nested list numbering via CSS counters.
- SVG chart generation (bar, line, pie, donut) with legends and data-table fallbacks.
- Safe fetching: public-address-only SSRF guard, manual redirect re-validation, response
  size caps, timeouts, and HTML sanitization of fetched content.
- Vitest suite: unit tests, in-memory MCP client/server integration tests, and a
  DOM-level (jsdom) test of the full MCP Apps inline flow: handshake, card injection,
  and form submission arriving as a `ui/message` request.
- Project documentation: README with Claude Desktop config JSON, TODO roadmap, MIT license.
