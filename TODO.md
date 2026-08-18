# TODO

Ideas for improvements and future implementations, grouped by area.

## Card types and content

- [ ] Image gallery card with lightbox-style zoom inside the iframe.
- [ ] Timeline card for history and news topics (horizontal SVG timeline).
- [ ] Comparison card: two-column pro/con or before/after layout.
- [ ] Flashcard card with flip animation for study sessions.
- [ ] Quiz card: multiple-choice questions that grade locally and report the score as a prompt.
- [ ] Checklist card whose checked state can be sent back to the conversation.
- [ ] Map card using inline SVG regions for geography topics.
- [ ] Diff card highlighting changes between two code or text samples.
- [ ] Math card rendering formulas with MathML.
- [ ] Kanban-style card for planning conversations.

## Charts and graphics

- [ ] Scatter, area, stacked-bar, and histogram chart types.
- [ ] Canvas-based charts for large datasets where SVG becomes heavy.
- [ ] Sparkline support inside table cells.
- [ ] Axis titles, custom tick counts, and log scale option.
- [ ] Downloadable SVG/PNG export button on chart cards.
- [ ] Auto-chart tool: accept a fetched table and pick a sensible chart type.

## Fetching and extraction

- [ ] Readability-style main-content extraction for cleaner reference text.
- [ ] RSS/Atom feed support for news use cases.
- [ ] OpenGraph/Twitter card metadata extraction for richer link previews.
- [ ] Multi-page fetch with a per-domain budget for short research crawls.
- [ ] Cache fetched pages in memory with a TTL to avoid duplicate requests.
- [ ] Extract definition lists and description lists into table data.
- [ ] Honor robots.txt and add a configurable request throttle.

## Forms and web forms

- [ ] Support multipart form submissions (file-less) and JSON API form targets.
- [ ] Detect CSRF token fields in mirrored forms and refetch them at submit time.
- [ ] Field validation hints pulled from pattern/min/max attributes of the source form.
- [ ] Multi-step wizard forms with progress indicator.
- [ ] Prefill mirrored forms from conversation context supplied by the model.

## Tutor and interactivity

- [ ] Model-created sub-conversations anchored to one card (mini chat panel in the card
   that relays through prompt messages).
- [ ] Dynamic title attributes generated on demand: dwell notify triggers the model to
   supply a definition, which the card applies via a follow-up resource update.
- [ ] Configurable dwell time and per-term dwell analytics summarized back to the model.
- [ ] Glossary side panel that collects every tutor term on the card.
- [ ] Keyboard navigation and screen-reader passes for all interactive elements.

## Host integration

- [ ] Extend MCP Apps support: honor `hostContext.theme` and host style variables in the
   card template, request display-mode changes, and declare per-domain CSP for
   image/video-heavy cards once hosts support it.
- [ ] Cross-card drag and drop once hosts expose a drop target API.
- [ ] Persist card state (tab selection, open sections, form drafts) across re-renders.
- [ ] Theme detection (light/dark) via prefers-color-scheme with a dark palette.
- [ ] HTTP/SSE transport option for remote hosting alongside stdio.

## Engineering

- [ ] CI workflow (build, test, lint) and publishing to npm.
- [ ] Screenshot tests of rendered cards via headless browser.
- [ ] Structured output schemas for card tools so hosts can introspect results.
- [ ] Localization of built-in card strings.
