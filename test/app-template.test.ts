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

  it("handles tool result and cancellation notifications tolerantly", () => {
    expect(html).toContain("tool-result");
    expect(html).toContain("tool-cancelled");
    expect(html).toContain("articleHtml");
  });

  it("never gates the initialized announcement on the init reply", () => {
    expect(html).toContain("setTimeout(announceReady");
  });

  it("reports its size and exposes the devtools inspector", () => {
    expect(html).toContain("ui/notifications/size-changed");
    expect(html).toContain("ResizeObserver");
    expect(html).toContain("__mccDebug");
    expect(html).toContain("[mcp-chat-cards]");
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
