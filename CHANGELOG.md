# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
