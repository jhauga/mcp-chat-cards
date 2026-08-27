# TODO

Ideas for improvements and future implementations, grouped by area.

Written for an agent picking work up unattended. Each item says what to build and what
"done" looks like; where an item touches existing code, the file is named. Checked items
are already shipped and name what carries them. Items that were investigated and ruled
out are collected under [Ruled out](#ruled-out) with the reason, so they are not picked
up again.

## Agent assistance

Let a tool get work done by something other than the calling model. An MCP tool cannot
force its host to spawn an agent: the tool is a function the model called, and control
returns to that same model when the tool responds. These are the routes that do work,
most reliable first.

- [ ] Server-side model call from inside a tool implementation. The server is an ordinary
   process, so a tool can call a model API directly, do the work, and return the result.
   This needs no host support and is the only route with predictable behavior.
   Done when: the API key comes from an environment variable; the tool returns a clear
   "not configured" result rather than throwing when the key is absent; the call is
   timeout-bounded and never blocks a card render; and nothing about it is on by default.
- [ ] MCP sampling via `createMessage`, so the server can ask the HOST to run an
   inference call. The SDK already exposes it (`server.server.createMessage`), so the work
   is the plumbing plus the fallback.
   Done when: the code checks the client's declared `sampling` capability first and falls
   back to the server-side call or a plain result when the host does not offer it.
- [ ] Structured "next action" results that invite the model to call another tool or
   agent. Best effort by nature, since acting on it is the model's choice, not a
   guarantee. Use only to complement the two routes above, never as the sole mechanism.
- [ ] Decide and document the boundary: which work belongs to the calling model and which
   is worth paying a second model for. Without this, every tool grows an "ask another
   model" branch.

## Local system integration

Open files, folders, and URLs from a card. `to-explorer` (`https://github.com/jhauga/to-explorer`)
covers this: it launches the OS default application detached, so nothing blocks.

- [ ] Add `to-explorer` as a dependency **from npm** (`npm install to-explorer`, currently
   1.0.1). Do not add it by git URL: the repository does not commit `dist/` and has no
   `prepare` script, so a git install resolves to a package whose `main` entry is missing
   and every import of it fails at runtime. The npm tarball is built by `prepublishOnly`
   and is fine.
- [ ] Tool that opens a local file or folder in the OS default application.
   Done when: paths resolve through the existing `assertNativePath` and
   `MCP_CHAT_CARDS_FS_ROOT` confinement in `src/util/files.ts`, the same as
   `read_local_file`.
- [ ] File links inside cards that route through that tool. The card runtime already
   posts `link` messages for `http(s)` URLs (`src/cards/runtime.ts`); local paths need
   their own message type so the host is never handed a `file:` URL to open blindly.
- [ ] Tool that opens a URL in the default browser, for flows that end outside the chat.
- [ ] Gate the whole capability behind an explicit opt-in environment variable, default
   off, and refuse to open executable file types.
   Rationale: today this server only reads text files and fetches public pages. Opening
   arbitrary paths in their default application, from model-supplied input, is a much
   larger surface than either, and it must not become available by merely installing.
- [ ] Only after the above: decide separately whether to run arbitrary commands.
   `to-explorer` opens things, it does not execute commands, so this is a different and
   considerably riskier feature and needs its own design, not a flag on this one.

## Host integration

- [ ] Request display-mode changes from the host, and declare per-domain CSP for
   image- and video-heavy cards once hosts support it. The template currently declares
   `availableDisplayModes: ["inline"]` and never asks for a change
   (`src/cards/app-template.ts`).
- [x] Honor `hostContext.theme` and host style variables in the card template.
   `applyHostContext` in `src/cards/app-template.ts` stamps `data-theme` and applies the
   host's CSS custom properties.
- [ ] `prefers-color-scheme` in the card theme itself, so a standalone card document opened
   outside a host still picks a palette. The dark palette exists
   (`:root[data-theme="dark"]` in `src/cards/theme.ts`) but only a host stamping
   `data-theme` currently reaches it.
- [ ] HTTP/SSE transport alongside stdio, for remote hosting.
- [ ] Reach the Claude browser app (`claude.ai`) as a remote connector. Blocked on the
   transport item above: the browser app connects to remote MCP servers over HTTP and
   cannot launch a local stdio process.
   Done when: transport exists, and `README.md` carries setup instructions for adding the
   deployed server as a connector, in the same shape as the existing Claude Desktop
   section.
- [ ] Server-side setting that strengthens how hard the tools advertise themselves, so a
   user can opt into cards being used across all conversations rather than when the model
   judges them useful. Read from an environment variable and adjust
   `SERVER_INSTRUCTIONS` in `src/server.ts`; default off.
   Note: the host's own connector-management UI is not ours to add a toggle to, so this is
   the server-side half of that idea.
- [ ] Cross-card drag and drop once hosts expose a drop target API.
- [ ] Persist card state (tab selection, open sections, form drafts) across re-renders.

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

## Engineering

- [ ] CI workflow (build, test, lint) and publishing to npm.
- [ ] Screenshot tests of rendered cards via headless browser.
- [ ] Localization of built-in card strings.
- [x] Structured output schemas for card tools so hosts can introspect results.
   `CARD_OUTPUT_SCHEMA` in `src/server.ts` is declared on every card tool.

## Ruled out

Investigated and not actionable from this repository. Recorded so they are not picked up
again; reopen only if the stated blocker changes.

- [x] ~~Render cards inside the Claude Code VS Code extension.~~
  - **Not viable here.** Inline cards require the host to implement the MCP Apps extension
    and render the UI resource in an iframe. Nothing this server returns can cause a host
    to do that, and hosts without Apps support are already served correctly: they get the
    text summary plus a readable `ui://mcp-chat-cards/html/<id>` resource. The nearest
    thing that does work is a host-specific companion, as in `extension/github/`, which
    renders the same cards in a GitHub Copilot canvas.
- [x] ~~Stop the repeated `Unrecognized Content-Security-Policy directive 'webrtc'`
  console warning by calling `claudemcpcontent.com`.~~
  - **Not viable here.** The string `webrtc` does not appear anywhere in this repository,
    and neither policy this server emits declares it (`CARD_CSP` and `CARD_TEMPLATE_CSP`
    in `src/cards/shell.ts`). The directive is in the host page's own CSP, so the browser
    emits the warning once per frame it loads regardless of what a card contains, and no
    request to any domain suppresses it. The only lever on this side is rendering fewer
    iframes, which is not a fix.
