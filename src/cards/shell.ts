// Renders card markup two ways from one source of truth:
// - renderCardBody produces the <article> markup plus the runtime config,
//   which MCP Apps hosts inject into the pre-declared card template.
// - renderCardDocument wraps that article in a complete, self-contained
//   HTML document (inline theme, runtime, and a restrictive CSP) used as
//   the embedded-resource fallback for hosts without MCP Apps support.
import { escapeHtml, uid, wrapTermsInHtml, type TutorTerm } from "../util/html.js";
import type { CardParts } from "../util/budget.js";
import { CARD_THEME_CSS } from "./theme.js";
import { CARD_RUNTIME_JS } from "./runtime.js";

export interface ContextAction {
  label: string;
  prompt: string;
}

export interface CardShellOptions {
  title: string;
  subtitle?: string;
  // Card kind slug shown in the footer badge, e.g. "tabs" or "table".
  kind: string;
  // Pre-rendered body markup. Builders are responsible for escaping.
  body: string;
  tutorTerms?: TutorTerm[];
  // Highlight tutor terms inside code samples too. Off by default: marking up
  // language keywords in sample source is noise, not teaching.
  tutorTermsInCode?: boolean;
  contextActions?: ContextAction[];
  dwellMs?: number;
  copyable?: boolean;
  draggable?: boolean;
  // Header toggle that shows the card's own HTML source in a code panel.
  codeToggle?: boolean;
  // Header toggle that collapses the card down to its header row.
  collapsible?: boolean;
}

export interface CardConfig {
  id: string;
  kind: string;
  dwellMs: number;
  contextActions: ContextAction[];
  draggable: boolean;
}

export interface RenderedCard {
  id: string;
  // Complete standalone HTML document (embedded-resource fallback).
  html: string;
  // <article> markup alone, injected into the MCP Apps card template.
  articleHtml: string;
  config: CardConfig;
  summary: string;
  // Present only on builders that split oversized content into parts.
  parts?: CardParts;
}

// Policy for the self-contained fallback document. Nothing loads except the
// inline theme and runtime plus the media the card points at, so img-src and
// media-src carry every scheme a card source may legitimately use - keep this
// in step with isPlayableMediaUrl/isDisplayableImageUrl in util/html.ts.
export const CARD_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  "img-src https: data: blob:; media-src https: data: blob:; font-src data:;";

// Policy for the MCP Apps template. The template is rendered by the host,
// which may inject its own bridge script or stylesheet into the frame, so the
// script/style/connect directives stay permissive; only the media and image
// directives are pinned, because those are what a card actually needs and
// what a host default policy is most likely to omit.
export const CARD_TEMPLATE_CSP =
  "default-src 'self' https:; script-src 'unsafe-inline' 'self' https:; " +
  "style-src 'unsafe-inline' 'self' https:; img-src https: data: blob:; " +
  "media-src https: data: blob:; font-src https: data:; connect-src 'self' https:;";

// Escape "<" so a "</script>" inside JSON values cannot break out of the
// config script element.
export function configToJson(config: CardConfig): string {
  return JSON.stringify(config).replace(/</g, "\\u003c");
}

export function renderCardBody(options: CardShellOptions): {
  id: string;
  articleHtml: string;
  config: CardConfig;
} {
  const id = uid("card");
  let body = options.body;
  if (options.tutorTerms && options.tutorTerms.length > 0) {
    body = wrapTermsInHtml(body, options.tutorTerms, {
      includeCode: options.tutorTermsInCode === true,
    });
  }

  const config: CardConfig = {
    id,
    kind: options.kind,
    dwellMs: options.dwellMs ?? 1200,
    contextActions: options.contextActions ?? [],
    draggable: options.draggable !== false,
  };

  const copyButton =
    options.copyable !== false
      ? '<button type="button" class="mcc-btn mcc-copy-card" title="Copy this card as standalone HTML to paste elsewhere">Copy card</button>'
      : "";
  // The code and collapse toggles are created by the runtime, not rendered
  // here, so cards from older tool results also grow them when repainted.
  // These attributes are how a builder opts a card out.
  const toggleAttrs =
    (options.codeToggle === false ? ' data-mcc-no-code="1"' : "") +
    (options.collapsible === false ? ' data-mcc-no-collapse="1"' : "");
  const subtitle = options.subtitle
    ? `<p class="mcc-subtitle">${escapeHtml(options.subtitle)}</p>`
    : "";

  const articleHtml = `<article class="mcc-card" data-card-id="${escapeHtml(id)}"${toggleAttrs}>
  <header class="mcc-head">
    <div>
      <h1>${escapeHtml(options.title)}</h1>
      ${subtitle}
    </div>
    <div class="mcc-tools">${copyButton}</div>
  </header>
  <div class="mcc-body">
${body}
  </div>
  <footer class="mcc-foot">mcp-chat-cards &middot; ${escapeHtml(options.kind)} card</footer>
</article>`;

  return { id, articleHtml, config };
}

export function renderCardDocument(options: CardShellOptions): {
  id: string;
  html: string;
  articleHtml: string;
  config: CardConfig;
} {
  const { id, articleHtml, config } = renderCardBody(options);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CARD_CSP}">
<title>${escapeHtml(options.title)}</title>
<style>${CARD_THEME_CSS}</style>
</head>
<body>
${articleHtml}
<script type="application/json" id="mcc-config">${configToJson(config)}</script>
<script>${CARD_RUNTIME_JS}</script>
</body>
</html>`;

  return { id, html, articleHtml, config };
}
