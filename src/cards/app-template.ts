// MCP Apps (SEP-1865) card template. Registered once as a pre-declared
// resource at ui://mcp-chat-cards/card.html with mimeType
// "text/html;profile=mcp-app". Hosts that support the Apps extension render
// this template inline in the conversation as a sandboxed iframe, then
// deliver the tool result to it over JSON-RPC postMessage. The template:
//
// 1. Performs the ui/initialize handshake and sends ui/notifications/initialized.
// 2. Waits for ui/notifications/tool-result, reads structuredContent.card
//    ({ articleHtml, config }), injects it, and calls window.mccInit().
// 3. Installs window.__mccHostBridge so card runtime events map onto Apps
//    JSON-RPC: prompt -> ui/message, link -> ui/open-link,
//    notify -> notifications/message (logging).
//
// The bootstrap script avoids backticks and dollar-brace sequences so it can
// live inside a TypeScript template literal.
import { CARD_THEME_CSS } from "./theme.js";
import { CARD_RUNTIME_JS } from "./runtime.js";

export const CARD_TEMPLATE_URI = "ui://mcp-chat-cards/card.html";
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const APPS_PROTOCOL_VERSION = "2026-01-26";

export function buildCardTemplateHtml(serverVersion: string): string {
  const bootstrap = `(function () {
  "use strict";

  var pending = {};
  var nextId = 1;
  var initialized = false;
  var pendingResult = null;

  function send(message) {
    try { window.parent.postMessage(message, "*"); } catch (err) { /* no host */ }
  }

  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId;
      nextId += 1;
      pending[id] = { resolve: resolve, reject: reject };
      send({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    });
  }

  function notify(method, params) {
    send({ jsonrpc: "2.0", method: method, params: params || {} });
  }

  // Card runtime events are translated to MCP Apps requests.
  window.__mccHostBridge = {
    post: function (type, payload) {
      payload = payload || {};
      if (type === "prompt") {
        request("ui/message", { role: "user", content: { type: "text", text: payload.prompt || "" } });
      } else if (type === "link") {
        request("ui/open-link", { url: payload.url || "" });
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

  function renderCard(card) {
    var mount = document.getElementById("mcc-root");
    if (!mount || !card || !card.articleHtml) return;
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
  }

  function extractCard(result) {
    if (result && result.structuredContent && result.structuredContent.card) {
      return result.structuredContent.card;
    }
    return null;
  }

  function handleToolResult(result) {
    if (!initialized) { pendingResult = result; return; }
    var card = extractCard(result);
    if (card) {
      renderCard(card);
    } else if (result && result.isError) {
      setStatus("The tool reported an error; see the conversation for details.");
    } else {
      setStatus("This tool result carries no card payload.");
    }
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.id !== undefined && msg.method === undefined) {
      var handler = pending[msg.id];
      if (handler) {
        delete pending[msg.id];
        if (msg.error) handler.reject(msg.error); else handler.resolve(msg.result);
      }
      return;
    }
    if (msg.method === "ui/notifications/tool-result") {
      handleToolResult(msg.params);
    } else if (msg.method === "ui/notifications/tool-cancelled") {
      setStatus("The tool call was cancelled.");
    }
    // ui/notifications/tool-input and tool-input-partial are ignored; the
    // card renders from the result, not the arguments.
  });

  request("ui/initialize", {
    protocolVersion: "${APPS_PROTOCOL_VERSION}",
    clientInfo: { name: "mcp-chat-cards", version: "${serverVersion}" },
    appCapabilities: { availableDisplayModes: ["inline"] }
  }).then(function () {
    notify("ui/notifications/initialized");
    initialized = true;
    if (pendingResult) { handleToolResult(pendingResult); pendingResult = null; }
  }, function () {
    setStatus("Host initialization failed; this card cannot render here.");
  });
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
