# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1-alpha] - 2026-08-11

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

## [0.1.0-alpha] - 2026-08-10

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

## [0.0.0-alpha] - 2026-08-10

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
