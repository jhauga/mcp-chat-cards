// Right-click menu items, driven through the MCP Apps template the way a
// host drives it. The bug these cover: a menu item that hands a prompt to the
// host and then says nothing. On a host that does not answer ui/message the
// click looked completely dead, which is indistinguishable from a broken
// build - and only the items that send a prompt were affected, while the
// local "Copy card" item kept working, so the fault looked random.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildCardTemplateHtml } from "../src/cards/app-template.js";
import { buildTabCard } from "../src/cards/tabs.js";

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

const ACTION_LABEL = "Explain this file's role";
const ACTION_PROMPT = "Explain the role of loader.py.";

function card() {
  return buildTabCard({
    title: "loader.py",
    tabs: [{ label: "Source", code: "def load():\n    pass", language: "python" }],
    contextActions: [{ label: ACTION_LABEL, prompt: ACTION_PROMPT }],
  });
}

// Mounts the Apps template, plays the host side of the handshake, and delivers
// one card. answerPrompts models the difference that matters: a host that
// acknowledges ui/message versus one that receives it and stays silent.
async function mountHost(answerPrompts: boolean) {
  const rendered = card();
  const sent: RpcMessage[] = [];
  const dom = new JSDOM(buildCardTemplateHtml("0.0.0-test"), {
    runScripts: "dangerously",
    url: "https://cards.invalid/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const tick = (ms = 30): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data as RpcMessage;
    if (msg?.jsonrpc !== "2.0" || msg.method === undefined) return;
    sent.push(msg);
    if (msg.method === "ui/initialize") {
      window.postMessage({ jsonrpc: "2.0", id: msg.id, result: {} }, "*");
    }
    if (msg.method === "ui/message" && answerPrompts) {
      window.postMessage({ jsonrpc: "2.0", id: msg.id, result: {} }, "*");
    }
  });
  await tick();
  window.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: { card: { articleHtml: rendered.articleHtml, config: rendered.config } } },
    },
    "*",
  );
  await tick();

  const doc = window.document;
  const openMenu = (): HTMLElement[] => {
    doc.querySelector(".mcc-body")!.dispatchEvent(
      new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }),
    );
    return Array.from(doc.querySelectorAll("#mcc-menu button")) as HTMLElement[];
  };
  const outboxStatus = (): string =>
    doc.querySelector("#mcc-outbox .mcc-outbox-status")?.textContent ?? "";
  const fallbackVisible = (): boolean => {
    const body = doc.querySelector("#mcc-outbox .mcc-outbox-body") as HTMLElement | null;
    return body !== null && !body.hidden;
  };

  return { window, doc, sent, tick, openMenu, outboxStatus, fallbackVisible };
}

describe("card context menu", () => {
  it("shows the model's actions plus the two built-in items", async () => {
    const { openMenu } = await mountHost(true);
    expect(openMenu().map((item) => item.textContent)).toEqual([
      ACTION_LABEL,
      "Generate Efficient Verbose Prompt",
      "Copy card",
    ]);
  });

  it("sends a context action as ui/message and confirms it once acknowledged", async () => {
    const { sent, tick, openMenu, outboxStatus, fallbackVisible } = await mountHost(true);
    openMenu().find((item) => item.textContent === ACTION_LABEL)!.click();
    await tick(60);

    const message = sent.find((msg) => msg.method === "ui/message");
    expect(message?.params).toMatchObject({
      role: "user",
      content: { type: "text", text: ACTION_PROMPT },
    });
    expect(outboxStatus()).toContain("Sent to the conversation");
    // The host took it, so there is nothing for the user to copy by hand.
    expect(fallbackVisible()).toBe(false);
  });

  it("offers the prompt for copying when the host never acknowledges it", async () => {
    const { doc, tick, openMenu, outboxStatus, fallbackVisible } = await mountHost(false);
    openMenu().find((item) => item.textContent === ACTION_LABEL)!.click();
    await tick(60);
    expect(outboxStatus()).toContain("Sending");

    // Past the acknowledgement window: an unanswered handoff is reported as
    // unconfirmed, never as sent.
    await tick(1700);
    expect(outboxStatus()).toContain("did not confirm");
    expect(fallbackVisible()).toBe(true);
    expect((doc.querySelector("#mcc-outbox textarea") as HTMLTextAreaElement).value).toBe(ACTION_PROMPT);
  }, 10000);

  it("gives the efficient-prompt item the same visible outcome", async () => {
    const { sent, tick, openMenu, outboxStatus } = await mountHost(true);
    openMenu().find((item) => item.textContent === "Generate Efficient Verbose Prompt")!.click();
    await tick(60);

    const message = sent.find((msg) => msg.method === "ui/message");
    const content = message?.params?.content as { text?: string } | undefined;
    expect(content?.text).toContain("[efficient-prompt]");
    expect(outboxStatus()).toContain("Sent to the conversation");
  });

  it("keeps Copy card local: it never asks the host for anything", async () => {
    const { window, sent, tick, openMenu } = await mountHost(true);
    let copied = "";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { copied = text; return Promise.resolve(); } },
    });
    openMenu().find((item) => item.textContent === "Copy card")!.click();
    await tick(60);

    expect(copied).toContain("mcc-card");
    expect(sent.some((msg) => msg.method === "ui/message")).toBe(false);
  });
});
