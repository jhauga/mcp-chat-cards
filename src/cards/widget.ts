// Visualizer widget delivery. Some hosts call this server's tools but never
// mount its MCP Apps template: Claude's device bridge, which carries local
// stdio servers into chats on the Claude app, rebuilds each tool's _meta
// without ui.resourceUri and hands the model only structuredContent. Those
// chats do have an inline HTML renderer of their own, the visualizer tool
// show_widget, which paints an HTML fragment in a sandboxed frame inline in
// the conversation. A card can ride on it:
//
//   widget_code = critical CSS + <article> + #mcc-config + <script src=bundle>
//
// The bundle (widget/mcc-widget.js, generated from this module by
// scripts/build-widget.mjs and served from a CDN the visualizer's CSP allows)
// injects the full card theme mapped onto the host's design tokens, installs
// a host bridge that turns card prompts into sendPrompt() and links into
// openLink(), and runs the same card runtime the Apps template runs. The
// critical CSS keeps the card legible while it streams and if the bundle
// cannot load; the bundle removes it once the full theme is in place.
//
// Like the runtime, the bundle source avoids backticks and dollar-brace
// sequences so it can live inside a template literal.
import { CARD_THEME_CSS } from "./theme.js";
import { CARD_RUNTIME_JS } from "./runtime.js";
import { configToJson, type CardConfig } from "./shell.js";

// Repository the CDN serves the bundle from. jsDelivr is on the visualizer's
// script allowlist and serves any tagged file of a public GitHub repository.
export const WIDGET_REPOSITORY = "jhauga/mcp-chat-cards";
export const WIDGET_BUNDLE_PATH = "widget/mcc-widget.js";

// The bundle URL for a release. Pinned to the release tag so a cached copy
// can never disagree with the server that emitted the card markup.
// MCP_CHAT_CARDS_WIDGET_SRC overrides it (a fork, or a local test server).
export function widgetBundleUrl(version: string): string {
  const override = (process.env.MCP_CHAT_CARDS_WIDGET_SRC ?? "").trim();
  if (override) return override;
  return `https://cdn.jsdelivr.net/gh/${WIDGET_REPOSITORY}@v${version}/${WIDGET_BUNDLE_PATH}`;
}

// Card variables re-pointed at the visualizer's design tokens, so a card
// matches the conversation around it in light and dark mode. The accent
// palette stays the card's own; data-mcc-dark="1" (set by the bundle when the
// host is dark) switches it. The host-token block comes second at equal
// specificity, so surfaces and text follow the host in both modes. Fallbacks are the card theme's light values, for
// a host that defines none of the tokens.
// The card's dark accent palette, re-keyed to the bundle's own attribute so
// the bundle never writes the host's data-theme.
const DARK_BLOCK = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(CARD_THEME_CSS)?.[1] ?? "";

const WIDGET_HOST_CSS = `
:root[data-mcc-host="widget"][data-mcc-dark="1"] {${DARK_BLOCK}}
:root[data-mcc-host="widget"],
:root[data-mcc-host="widget"][data-mcc-dark="1"] {
  --mcc-surface: var(--surface-2, #ffffff);
  --mcc-text: var(--text-primary, #1f2328);
  --mcc-muted: var(--text-secondary, #5b6b7b);
  --mcc-border: var(--border, #d8e2ec);
  --mcc-head-a: var(--surface-1, #f2f7fc);
  --mcc-head-b: var(--surface-1, #eaf1f8);
  --mcc-soft-bg: var(--surface-1, #f7fafc);
  --mcc-code-bg: var(--surface-1, #f3f6fa);
  --mcc-reveal-bg: var(--surface-2, #fbfdfe);
}
:root[data-mcc-host="widget"] body {
  background: transparent;
  padding: 0;
  font-family: var(--font-sans, "Segoe UI", system-ui, -apple-system, Arial, sans-serif);
}
:root[data-mcc-host="widget"] .mcc-card { box-shadow: none; border-radius: 12px; }
:root[data-mcc-host="widget"] .mcc-head h1 { font-weight: 500; }
`;

// Inline in every widget_code, ahead of the article. Uses only host tokens,
// stays short (it is streamed by the model on every card), and is removed by
// the bundle once the full theme loads, because a <style> in the body would
// otherwise outrank the theme injected into the head.
export const WIDGET_CRITICAL_CSS =
  ".mcc-card{border:0.5px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface-2)}" +
  ".mcc-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--surface-1);border-bottom:0.5px solid var(--border)}" +
  ".mcc-head h1{font-size:16px;font-weight:500;margin:0}" +
  ".mcc-subtitle{margin:2px 0 0;font-size:12px;color:var(--text-secondary)}" +
  ".mcc-body{padding:14px}" +
  ".mcc-block{margin:0 0 12px}" +
  ".mcc-foot{padding:6px 14px;font-size:11px;color:var(--text-muted);border-top:0.5px solid var(--border)}" +
  ".mcc-table{border-collapse:collapse;width:100%;font-size:13px}" +
  ".mcc-table th,.mcc-table td{border:0.5px solid var(--border);padding:6px 10px;text-align:left;vertical-align:top}" +
  ".mcc-panel[hidden],.mcc-tools{display:none}" +
  "pre{white-space:pre-wrap;font-size:12px}";

// The bundle's own setup, run before the card runtime: guard, theme, host
// bridge, dark-mode sync, and a config fallback.
function widgetPrelude(version: string): string {
  return `
  if (window.__mccWidgetLoaded) return;
  window.__mccWidgetLoaded = ${JSON.stringify(version)};

  var root = document.documentElement;
  root.setAttribute("data-mcc-host", "widget");

  var theme = document.createElement("style");
  theme.id = "mcc-theme";
  theme.textContent = ${JSON.stringify(CARD_THEME_CSS + WIDGET_HOST_CSS)};
  (document.head || root).appendChild(theme);
  var critical = document.getElementById("mcc-critical");
  if (critical && critical.parentNode) critical.parentNode.removeChild(critical);

  // Native form submission must never happen in the host frame: a form
  // without an action navigates the frame (in a srcdoc frame, toward the
  // host page itself). The card runtime cancels its own submits; this
  // capture-phase guard covers any form it did not wire. widget_code also
  // marks every form method="dialog", which is inert outside a dialog, for
  // the case where this bundle never loads at all.
  try {
    document.addEventListener("submit", function (event) { event.preventDefault(); }, true);
  } catch (err) { /* optional */ }

  // The visualizer exposes sendPrompt(text) and openLink(url) as globals,
  // which may be lexical bindings rather than window properties, so they are
  // looked up by bare name first. A prompt resolves true once handed over, so
  // the runtime reports it as sent; false makes it offer the prompt to copy.
  function hostFunction(name) {
    try {
      if (name === "sendPrompt" && typeof sendPrompt === "function") return sendPrompt;
      if (name === "openLink" && typeof openLink === "function") return openLink;
    } catch (err) { /* not defined */ }
    return typeof window[name] === "function" ? window[name] : null;
  }
  window.__mccHostBridge = {
    post: function (type, payload) {
      payload = payload || {};
      if (type === "prompt") {
        var send = hostFunction("sendPrompt");
        if (!send) return Promise.resolve(false);
        try {
          send(String(payload.prompt || ""));
          return Promise.resolve(true);
        } catch (err) { return Promise.resolve(false); }
      }
      if (type === "link") {
        var url = String(payload.url || "");
        try {
          var open = hostFunction("openLink");
          if (open) open(url);
          else window.open(url, "_blank", "noopener");
          return Promise.resolve(true);
        } catch (err) { return Promise.resolve(false); }
      }
      // "notify" has no channel in this host; the model learns nothing from
      // hover or ready events here, which is the documented trade-off.
      return undefined;
    }
  };

  // Light or dark, read from what the host paints: the computed text color
  // of the body (the theme maps it to the host's --text-primary), then the
  // raw token, then the media query for a host that defines no token.
  //
  // This must never feed back into the host. Hosts watch the frame's DOM to
  // size it and may touch :root as they do; a sync that mutates the DOM and
  // re-runs on :root style or class changes chases that host forever and
  // hangs the frame (1.0.0-alpha.1.0.0 did exactly that). So the sync reads
  // only, writes one attribute of its own and only when the answer changes,
  // and runs on a throttled timer, never on a microtask.
  function luminance(color) {
    var value = String(color || "").trim();
    var m = /rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)/i.exec(value);
    var rgb = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\\b/i.exec(value);
    if (!rgb && hex) {
      var h = hex[1].length === 3 ? hex[1].replace(/(.)/g, "$1$1") : hex[1];
      rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    if (!rgb) return null;
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  }
  function hostIsDark() {
    var mode = root.getAttribute("data-mode") || root.getAttribute("data-theme");
    if (mode === "dark") return true;
    if (mode === "light") return false;
    var token = getComputedStyle(root).getPropertyValue("--text-primary").trim();
    if (token) {
      var lum = luminance(getComputedStyle(document.body || root).color);
      if (lum === null) lum = luminance(token);
      if (lum !== null) return lum > 0.5;
    }
    return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  var darkState = null;
  function syncTheme() {
    try {
      var dark = hostIsDark();
      if (dark === darkState) return;
      darkState = dark;
      if (dark) root.setAttribute("data-mcc-dark", "1");
      else root.removeAttribute("data-mcc-dark");
    } catch (err) { /* theme sync is cosmetic */ }
  }
  var syncPending = false;
  function scheduleSync() {
    if (syncPending) return;
    syncPending = true;
    setTimeout(function () { syncPending = false; syncTheme(); }, 100);
  }
  syncTheme();
  try {
    new MutationObserver(scheduleSync).observe(root, {
      attributes: true,
      attributeFilter: ["data-mode", "data-theme"]
    });
  } catch (err) { /* optional */ }
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) media.addEventListener("change", scheduleSync);
  } catch (err) { /* optional */ }

  // The runtime initializes itself when #mcc-config exists. widget_code
  // always carries one; rebuild a default from the article if a host
  // stripped it, so the card is still interactive.
  if (!document.getElementById("mcc-config")) {
    var article = document.querySelector("article.mcc-card");
    if (article) {
      var cfg = document.createElement("script");
      cfg.type = "application/json";
      cfg.id = "mcc-config";
      cfg.textContent = JSON.stringify({
        id: article.getAttribute("data-card-id") || "card",
        kind: "card",
        dwellMs: 1200,
        contextActions: [],
        draggable: true
      });
      (document.body || root).appendChild(cfg);
    }
  }
`;
}

// Contents of widget/mcc-widget.js for a release.
export function buildWidgetBundle(version: string): string {
  return (
    `/* mcp-chat-cards ${version} visualizer widget runtime. Generated from ` +
    `src/cards/widget.ts by scripts/build-widget.mjs; do not edit by hand. */\n` +
    `(function () {\n  "use strict";\n${widgetPrelude(version)}\n${CARD_RUNTIME_JS}\n})();\n`
  );
}

const ENTITY: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&middot;": "·",
};

// The card title as plain text, read back from the escaped <h1> the shell
// rendered, so the widget title needs no extra plumbing through builders.
export function articleTitle(articleHtml: string): string {
  const match = /<h1>([\s\S]*?)<\/h1>/.exec(articleHtml);
  if (!match) return "";
  return match[1]
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|middot);/g, (entity) => ENTITY[entity] ?? entity)
    .trim();
}

// show_widget wants a short snake_case identifier that also names the
// download, so it is derived from the title and kind.
export function widgetTitle(articleHtml: string, kind: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  const base = slug(articleTitle(articleHtml)).slice(0, 48).replace(/_+$/g, "");
  const suffix = slug(kind) || "card";
  return base ? `${base}_${suffix}_card` : `${suffix}_card`;
}

export interface WidgetCodeOptions {
  articleHtml: string;
  config: CardConfig;
  bundleUrl: string;
}

// The fragment handed to show_widget. Order follows the visualizer's
// streaming guidance: short style, content, then scripts (which the host runs
// after streaming completes). The sr-only heading is the accessible summary
// the visualizer asks every HTML widget to lead with.
export function buildWidgetCode(options: WidgetCodeOptions): string {
  const title = /<h1>([\s\S]*?)<\/h1>/.exec(options.articleHtml)?.[1] ?? "Card";
  const kind = options.config.kind.replace(/[^a-z0-9 -]/gi, "");
  const bundle = options.bundleUrl.replace(/"/g, "%22");
  return (
    `<style id="mcc-critical">${WIDGET_CRITICAL_CSS}</style>\n` +
    `<h2 class="sr-only">${title} (${kind} card)</h2>\n` +
    `${inertForms(options.articleHtml)}\n` +
    `<script type="application/json" id="mcc-config">${configToJson(options.config)}</script>\n` +
    `<script src="${bundle}"></script>`
  );
}

// Every form in a widget gets method="dialog": submitting it outside a
// dialog does nothing, so a form the runtime never wired (the bundle failed
// to load) cannot navigate the host frame. The runtime still sees the submit
// event and cancels it as usual.
export function inertForms(html: string): string {
  return html.replace(/<form(?![^>]*\smethod=)(?=[\s>])/gi, '<form method="dialog"');
}

// One loading line per card; the model may write its own.
export function widgetLoadingMessages(kind: string): string[] {
  return [`Laying out the ${kind.replace(/-/g, " ")} card`];
}
