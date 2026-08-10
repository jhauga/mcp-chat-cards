// End-to-end MCP Apps flow in a DOM: load the card template, play the host
// side of the JSON-RPC postMessage handshake, deliver a tool result, and
// verify the card renders and that interactions come back as Apps requests.
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCardTemplateHtml } from "../src/cards/app-template.js";
import { buildFormCard } from "../src/cards/form.js";

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

function tick(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MCP Apps template flow", () => {
  let window: JSDOM["window"];
  let received: RpcMessage[];

  function hostSend(message: RpcMessage): void {
    window.postMessage(message, "*");
  }

  beforeAll(async () => {
    const dom = new JSDOM(buildCardTemplateHtml("0.0.0-test"), {
      runScripts: "dangerously",
      url: "https://cards.invalid/",
      pretendToBeVisual: true,
    });
    window = dom.window;
    received = [];

    // In a top-level JSDOM window, window.parent === window, so the host
    // listener sees every message the template posts to its parent.
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as RpcMessage;
      if (msg?.jsonrpc === "2.0" && msg.method !== undefined) {
        received.push(msg);
      }
    });
    await tick();
  });

  it("sends ui/initialize and ui/notifications/initialized", async () => {
    await tick();
    const init = received.find((msg) => msg.method === "ui/initialize");
    expect(init).toBeDefined();
    expect(init?.params?.protocolVersion).toBe("2026-01-26");

    hostSend({
      jsonrpc: "2.0",
      id: init?.id,
      result: { protocolVersion: "2026-01-26", hostInfo: { name: "test-host", version: "1.0" } },
    });
    await tick();
    expect(received.some((msg) => msg.method === "ui/notifications/initialized")).toBe(true);
  });

  it("renders the card from ui/notifications/tool-result", async () => {
    const card = buildFormCard({
      title: "Study preferences",
      promptTemplate: "Teach {{topic}} simply.",
      fields: [{ name: "topic", label: "Topic", required: true }],
    });
    hostSend({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {
        content: [{ type: "text", text: card.summary }],
        structuredContent: { card: { articleHtml: card.articleHtml, config: card.config } },
      },
    });
    await tick();

    const article = window.document.querySelector(".mcc-card");
    expect(article).not.toBeNull();
    expect(window.document.querySelector("form.mcc-form")).not.toBeNull();
    expect(window.document.getElementById("mcc-config")?.textContent).toContain('"kind":"form"');
  });

  it("submitting the injected form sends a ui/message request", async () => {
    const doc = window.document;
    const input = doc.querySelector("input[name='topic']") as HTMLInputElement;
    input.value = "ownership in Rust";
    const form = doc.querySelector("form.mcc-form") as HTMLFormElement;
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await tick();

    const message = received.find((msg) => msg.method === "ui/message");
    expect(message).toBeDefined();
    const content = message?.params?.content as { type: string; text: string };
    expect(content.text).toBe("Teach ownership in Rust simply.");
  });
});
