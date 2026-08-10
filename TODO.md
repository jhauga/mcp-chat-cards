# TODO

Ideas for improvements and future implementations, grouped by area.

## Card types and content

1. Image gallery card with lightbox-style zoom inside the iframe.
2. Timeline card for history and news topics (horizontal SVG timeline).
3. Comparison card: two-column pro/con or before/after layout.
4. Flashcard card with flip animation for study sessions.
5. Quiz card: multiple-choice questions that grade locally and report the score as a prompt.
6. Checklist card whose checked state can be sent back to the conversation.
7. Map card using inline SVG regions for geography topics.
8. Diff card highlighting changes between two code or text samples.
9. Math card rendering formulas with MathML.
10. Kanban-style card for planning conversations.

## Charts and graphics

1. Scatter, area, stacked-bar, and histogram chart types.
2. Canvas-based charts for large datasets where SVG becomes heavy.
3. Sparkline support inside table cells.
4. Axis titles, custom tick counts, and log scale option.
5. Downloadable SVG/PNG export button on chart cards.
6. Auto-chart tool: accept a fetched table and pick a sensible chart type.

## Fetching and extraction

1. Readability-style main-content extraction for cleaner reference text.
2. RSS/Atom feed support for news use cases.
3. OpenGraph/Twitter card metadata extraction for richer link previews.
4. Multi-page fetch with a per-domain budget for short research crawls.
5. Cache fetched pages in memory with a TTL to avoid duplicate requests.
6. Extract definition lists and description lists into table data.
7. Honor robots.txt and add a configurable request throttle.

## Forms and web forms

1. Support multipart form submissions (file-less) and JSON API form targets.
2. Detect CSRF token fields in mirrored forms and refetch them at submit time.
3. Field validation hints pulled from pattern/min/max attributes of the source form.
4. Multi-step wizard forms with progress indicator.
5. Prefill mirrored forms from conversation context supplied by the model.

## Tutor and interactivity

1. Model-created sub-conversations anchored to one card (mini chat panel in the card
   that relays through prompt messages).
2. Dynamic title attributes generated on demand: dwell notify triggers the model to
   supply a definition, which the card applies via a follow-up resource update.
3. Configurable dwell time and per-term dwell analytics summarized back to the model.
4. Glossary side panel that collects every tutor term on the card.
5. Keyboard navigation and screen-reader passes for all interactive elements.

## Host integration

1. Extend MCP Apps support: honor `hostContext.theme` and host style variables in the
   card template, request display-mode changes, and declare per-domain CSP for
   image/video-heavy cards once hosts support it.
2. Cross-card drag and drop once hosts expose a drop target API.
3. Persist card state (tab selection, open sections, form drafts) across re-renders.
4. Theme detection (light/dark) via prefers-color-scheme with a dark palette.
5. HTTP/SSE transport option for remote hosting alongside stdio.

## Engineering

1. CI workflow (build, test, lint) and publishing to npm.
2. Screenshot tests of rendered cards via headless browser.
3. Structured output schemas for card tools so hosts can introspect results.
4. Localization of built-in card strings.
