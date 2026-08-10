import { describe, expect, it } from "vitest";
import {
  APPS_PROTOCOL_VERSION,
  buildCardTemplateHtml,
  CARD_TEMPLATE_URI,
  MCP_APP_MIME_TYPE,
} from "../src/cards/app-template.js";

describe("MCP Apps card template", () => {
  const html = buildCardTemplateHtml("0.0.0-test");

  it("uses the spec constants", () => {
    expect(CARD_TEMPLATE_URI).toBe("ui://mcp-chat-cards/card.html");
    expect(MCP_APP_MIME_TYPE).toBe("text/html;profile=mcp-app");
    expect(APPS_PROTOCOL_VERSION).toBe("2026-01-26");
  });

  it("performs the ui/initialize handshake and initialized notification", () => {
    expect(html).toContain('"ui/initialize"');
    expect(html).toContain("ui/notifications/initialized");
    expect(html).toContain(APPS_PROTOCOL_VERSION);
    expect(html).toContain("0.0.0-test");
  });

  it("handles tool result and cancellation notifications", () => {
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("ui/notifications/tool-cancelled");
    expect(html).toContain("structuredContent.card");
  });

  it("bridges card events to Apps JSON-RPC methods", () => {
    expect(html).toContain("__mccHostBridge");
    expect(html).toContain('"ui/message"');
    expect(html).toContain('"ui/open-link"');
    expect(html).toContain('"notifications/message"');
  });

  it("ships the card runtime and a mount point", () => {
    expect(html).toContain('id="mcc-root"');
    expect(html).toContain("window.mccInit = mccInit");
  });
});
