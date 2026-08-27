// MCP Apps (SEP-1865) card template. Registered once as a pre-declared
// resource at ui://mcp-chat-cards/card.html with mimeType
// "text/html;profile=mcp-app". Hosts that support the Apps extension render
// this template inline in the conversation as a sandboxed iframe, then
// deliver the tool result to it over JSON-RPC postMessage.
//
// Render-critical behavior (each failing silently on its own):
// 1. ui/notifications/initialized is sent on a short timeout as well as on
//    the ui/initialize reply - the host withholds the tool result until it
//    sees the notification, so gating it on a reply that may never arrive
//    leaves a mounted card empty forever.
// 2. The card paints from the result's structuredContent, which only ships
//    when the tool declares an output schema (see server.ts).
// 3. ui/notifications/size-changed is reported after every paint and on
//    resize - content drives the iframe size; without it the card can stay
//    collapsed and invisible.
// 4. Message handling is tolerant: method names are substring-matched and
//    the card payload is located by deep search (any object carrying an
//    articleHtml string), because hosts nest results differently.
//
// Debugging in Claude Desktop: enable Developer Mode, open the webview
// devtools, and filter the console for "[mcp-chat-cards]". Call
// window.__mccDebug() in that console for a state snapshot including the
// recent message log.
//
// The bootstrap script avoids backticks and dollar-brace sequences so it can
// live inside a TypeScript template literal.
import { CARD_THEME_CSS } from "./theme.js";
import { CARD_RUNTIME_JS } from "./runtime.js";
import { CARD_TEMPLATE_CSP } from "./shell.js";

export const CARD_TEMPLATE_URI = "ui://mcp-chat-cards/card.html";
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const APPS_PROTOCOL_VERSION = "2026-01-26";

export function buildCardTemplateHtml(serverVersion: string): string {
  const bootstrap = `(function () {
  "use strict";

  var pending = {};
  var nextId = 0;
  var announced = false;
  var painted = false;
  var traceLog = [];

  function trace(direction, detail) {
    try {
      traceLog.push({ at: Date.now(), dir: direction, detail: detail });
      if (traceLog.length > 50) traceLog.shift();
      console.log("[mcp-chat-cards] " + direction, detail);
    } catch (err) { /* console may be unavailable */ }
  }

  function send(message) {
    try {
      window.parent.postMessage(message, "*");
      trace("tx", message.method || ("reply:" + message.id));
    } catch (err) { trace("tx-error", String(err)); }
  }

  function request(method, params) {
    return new Promise(function (resolve) {
      nextId += 1;
      // String keys: a host that echoes id 1 back as "1" must still resolve.
      pending[String(nextId)] = resolve;
      send({ jsonrpc: "2.0", id: nextId, method: method, params: params || {} });
    });
  }

  function notify(method, params) {
    send({ jsonrpc: "2.0", method: method, params: params || {} });
  }

  // Card runtime events are translated to MCP Apps requests. "prompt" and
  // "link" return the request promise, resolving true once the host answers
  // and false when it answers with an error. A host that never answers leaves
  // the promise pending forever, which is why the runtime also runs its own
  // timeout: an unanswered handoff must not be reported to the user as sent.
  window.__mccHostBridge = {
    post: function (type, payload) {
      payload = payload || {};
      if (type === "prompt") {
        return request("ui/message", { role: "user", content: { type: "text", text: payload.prompt || "" } })
          .then(function (result) { return result !== null; });
      } else if (type === "link") {
        return request("ui/open-link", { url: payload.url || "" })
          .then(function (result) { return result !== null; });
      } else if (type === "notify") {
        notify("notifications/message", {
          level: "info",
          logger: "mcp-chat-cards",
          data: { message: payload.message || "" }
        });
      }
    }
  };

  function setStatus(text) {
    var el = document.getElementById("mcc-app-status");
    if (el) el.textContent = text;
  }

  function reportSize() {
    notify("ui/notifications/size-changed", {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight
    });
  }

  // hostContext.theme is "light" or "dark"; real design tokens arrive as CSS
  // custom properties under hostContext.styles.variables.
  function applyHostContext(context) {
    if (!context || typeof context !== "object") return;
    try {
      var vars = (context.styles && context.styles.variables) || {};
      var root = document.documentElement;
      for (var name in vars) {
        if (typeof vars[name] === "string") root.style.setProperty(name, vars[name]);
      }
      if (context.theme === "dark") root.setAttribute("data-theme", "dark");
      else if (context.theme === "light") root.removeAttribute("data-theme");
    } catch (err) { trace("theme-error", String(err)); }
  }

  // Whatever object carries an articleHtml string is the card payload,
  // wherever the host nested it.
  function extractCard(node, depth) {
    if (!node || typeof node !== "object" || (depth || 0) > 6) return null;
    if (typeof node.articleHtml === "string") return node;
    for (var key in node) {
      var found = extractCard(node[key], (depth || 0) + 1);
      if (found) return found;
    }
    return null;
  }

  function renderCard(card) {
    var mount = document.getElementById("mcc-root");
    if (!mount || !card || typeof card.articleHtml !== "string") return;
    mount.innerHTML = card.articleHtml;
    var cfgEl = document.getElementById("mcc-config");
    if (!cfgEl) {
      cfgEl = document.createElement("script");
      cfgEl.type = "application/json";
      cfgEl.id = "mcc-config";
      document.body.appendChild(cfgEl);
    }
    cfgEl.textContent = JSON.stringify(card.config || {});
    setStatus("");
    if (typeof window.mccInit === "function") window.mccInit();
    painted = true;
    trace("painted", (card.config && card.config.kind) || "card");
    reportSize();
  }

  function handlePayload(value) {
    var card = extractCard(value, 0);
    if (card) { renderCard(card); return true; }
    return false;
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return;
    trace("rx", msg.method || ("reply:" + msg.id));

    var key = msg.id !== undefined && msg.method === undefined ? String(msg.id) : null;
    if (key !== null && pending[key]) {
      var resolve = pending[key];
      delete pending[key];
      resolve(msg.error ? null : msg.result);
      return;
    }

    var method = typeof msg.method === "string" ? msg.method : "";
    if (method.indexOf("tool-result") > -1) {
      if (!handlePayload(msg.params)) {
        if (msg.params && msg.params.isError) {
          setStatus("The tool reported an error; see the conversation for details.");
        } else {
          setStatus("This tool result carries no card payload.");
        }
      }
      return;
    }
    if (method.indexOf("tool-cancelled") > -1) {
      setStatus("The tool call was cancelled.");
      return;
    }
    if (/theme|context/i.test(method)) {
      applyHostContext((msg.params && msg.params.hostContext) || msg.params);
      return;
    }
    // Last resort: some hosts deliver the payload under other notifications.
    handlePayload(msg.params);
  });

  // The host withholds the tool result until the view announces itself, so
  // the announcement must never be gated on a reply that may not arrive.
  function announceReady() {
    if (announced) return;
    announced = true;
    notify("ui/notifications/initialized", {});
    reportSize();
  }

  request("ui/initialize", {
    protocolVersion: "${APPS_PROTOCOL_VERSION}",
    clientInfo: { name: "mcp-chat-cards", version: "${serverVersion}" },
    appCapabilities: { availableDisplayModes: ["inline"] }
  }).then(function (result) {
    announceReady();
    if (result) {
      applyHostContext(result.hostContext);
      // Some hosts hand the tool result back on the init response itself.
      handlePayload(result);
    }
  });
  setTimeout(announceReady, 600);

  // Media events do not bubble, so the capture phase is the only way to see
  // them from the document. A <video> is 300x150 until its metadata lands;
  // without this the frame keeps the placeholder height it was measured at.
  document.addEventListener("loadedmetadata", function () { if (painted) reportSize(); }, true);
  document.addEventListener("error", function () { if (painted) reportSize(); }, true);

  // Keep the reported size accurate as tabs switch and sections open/close.
  if (typeof ResizeObserver === "function") {
    try {
      new ResizeObserver(function () { if (painted) reportSize(); }).observe(document.body);
    } catch (err) { /* optional */ }
  }

  // Devtools inspector: window.__mccDebug() in the webview console.
  window.__mccDebug = function () {
    return {
      version: "${serverVersion}",
      announced: announced,
      painted: painted,
      cardHtml: (document.getElementById("mcc-root") || {}).innerHTML || "",
      log: traceLog.slice()
    };
  };
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CARD_TEMPLATE_CSP}">
<title>mcp-chat-cards</title>
<style>${CARD_THEME_CSS}
#mcc-app-status { color: var(--mcc-muted); font-size: 12px; padding: 6px 2px; }
#mcc-app-status:empty { display: none; }
</style>
</head>
<body>
<div id="mcc-root" aria-live="polite"></div>
<p id="mcc-app-status">Loading card&hellip;</p>
<script>${CARD_RUNTIME_JS}</script>
<script>${bootstrap}</script>
</body>
</html>`;
}
