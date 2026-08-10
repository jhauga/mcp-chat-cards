// Renders card markup two ways from one source of truth:
// - renderCardBody produces the <article> markup plus the runtime config,
//   which MCP Apps hosts inject into the pre-declared card template.
// - renderCardDocument wraps that article in a complete, self-contained
//   HTML document (inline theme, runtime, and a restrictive CSP) used as
//   the embedded-resource fallback for hosts without MCP Apps support.
import { escapeHtml, uid, wrapTermsInHtml, type TutorTerm } from "../util/html.js";
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
  contextActions?: ContextAction[];
  dwellMs?: number;
  copyable?: boolean;
  draggable?: boolean;
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
}

const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  "img-src https: data:; media-src https: data:; font-src data:;";

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
    body = wrapTermsInHtml(body, options.tutorTerms);
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
  const subtitle = options.subtitle
    ? `<p class="mcc-subtitle">${escapeHtml(options.subtitle)}</p>`
    : "";

  const articleHtml = `<article class="mcc-card" data-card-id="${escapeHtml(id)}">
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
<meta http-equiv="Content-Security-Policy" content="${CSP}">
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
