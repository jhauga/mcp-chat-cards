// Visualizer widget delivery: the path that puts a card in front of the user
// on hosts that call this server's tools but never mount its MCP Apps
// template (Claude's device bridge). Covers the committed CDN bundle, the
// widget code a result carries, the bundle running inside a host-like page,
// and when the server chooses to ship a widget at all.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  articleTitle,
  buildWidgetBundle,
  buildWidgetCode,
  inertForms,
  WIDGET_BUNDLE_PATH,
  widgetBundleUrl,
  widgetTitle,
} from "../src/cards/widget.js";
import { buildTabCard } from "../src/cards/tabs.js";
import { buildTableCard } from "../src/cards/table.js";
import { buildFormCard } from "../src/cards/form.js";
import { createServer, SERVER_VERSION, WIDGET_ACTION } from "../src/server.js";
import { resultCharLimit } from "../src/util/budget.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } };

interface Display {
  shown: boolean;
  action: string;
  title: string;
  loading_messages: string[];
  widget_code: string;
}

interface Structured {
  card: { articleHtml: string; config: { id: string; kind: string } };
  parts: { current: number; total: number; hasMore: boolean };
  display?: Display;
}

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

async function connect(apps: boolean, name = "local-agent-mode-chat-cards") {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const client = new Client(
    { name, version: "1.0.0" },
    apps ? { capabilities: { extensions: APPS } as Record<string, unknown> } : undefined,
  );
  await client.connect(clientTransport);
  return client;
}

async function tableResult(client: Client, title = "Iterator adapters") {
  const result = await client.callTool({
    name: "create_table_card",
    arguments: { title, headers: ["Adapter", "Lazy?"], rows: [["map", "Yes"], ["collect", "No"]] },
  });
  return {
    structured: result.structuredContent as Structured,
    text: (result.content as Array<{ type: string; text?: string }>)[0]?.text ?? "",
    size: JSON.stringify(result).length,
  };
}

describe("widget bundle", () => {
  it("is committed exactly as the generator writes it for this version", () => {
    const committed = readFileSync(join(root, ...WIDGET_BUNDLE_PATH.split("/")), "utf8");
    expect(committed).toBe(buildWidgetBundle(SERVER_VERSION));
  });

  it("is served from the release tag unless overridden", () => {
    expect(widgetBundleUrl("1.2.3")).toBe(
      "https://cdn.jsdelivr.net/gh/jhauga/mcp-chat-cards@v1.2.3/widget/mcc-widget.js",
    );
    process.env.MCP_CHAT_CARDS_WIDGET_SRC = "https://example.com/mcc-widget.js";
    expect(widgetBundleUrl("1.2.3")).toBe("https://example.com/mcc-widget.js");
  });
});

describe("widget code", () => {
  it("leads with critical style and an accessible heading, then article, config, bundle", () => {
    const card = buildTableCard({ title: "A & B <c>", headers: ["x"], rows: [["1"]] });
    const code = buildWidgetCode({
      articleHtml: card.articleHtml,
      config: card.config,
      bundleUrl: "https://cdn.jsdelivr.net/gh/x/y@v1/widget/mcc-widget.js",
    });
    expect(code.startsWith('<style id="mcc-critical">')).toBe(true);
    expect(code).toContain('<h2 class="sr-only">A &amp; B &lt;c&gt; (table card)</h2>');
    expect(code).toContain(card.articleHtml);
    expect(code).toContain(`"id":"${card.config.id}"`);
    expect(code.endsWith('<script src="https://cdn.jsdelivr.net/gh/x/y@v1/widget/mcc-widget.js"></script>')).toBe(true);
    // The visualizer rejects full documents.
    expect(code).not.toMatch(/<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]/i);
  });

  it("makes every form inert to native submission", () => {
    const card = buildFormCard({
      title: "Prefs",
      fields: [{ name: "topic", label: "Topic" }],
    });
    const code = buildWidgetCode({ articleHtml: card.articleHtml, config: card.config, bundleUrl: "https://x.invalid/b.js" });
    expect(card.articleHtml).toMatch(/<form class="mcc-form"/);
    expect(code).toMatch(/<form method="dialog" class="mcc-form"/);
    expect(inertForms('<form method="post" a="1">')).toBe('<form method="post" a="1">');
    expect(inertForms("<formula><form>")).toBe('<formula><form method="dialog">');
  });

  it("derives a snake_case title from the card heading and kind", () => {
    const card = buildTableCard({ title: "Rust iterator adapters — run 3", headers: ["x"], rows: [["1"]] });
    expect(articleTitle(card.articleHtml)).toBe("Rust iterator adapters — run 3");
    expect(widgetTitle(card.articleHtml, "table")).toBe("rust_iterator_adapters_run_3_table_card");
    expect(widgetTitle("<article></article>", "show-hide")).toBe("show_hide_card");
  });
});

// A page shaped like the visualizer's frame: host tokens on :root, sendPrompt
// and openLink as globals, widget_code as the content, and the bundle inlined
// where the CDN script tag would load it.
interface HostOptions {
  // Define sendPrompt/openLink as top-level const bindings (not window
  // properties), the way a host script may.
  lexicalGlobals?: boolean;
  // A host that watches the frame's DOM to size it and touches :root each
  // time - the shape that turned 1.0.0-alpha.1.0.0's theme sync into an
  // endless loop. Capped so a regression fails instead of hanging the run.
  touchRootOnMutation?: boolean;
}

function mountWidget(
  widgetCode: string,
  hostCss = ":root{--text-primary:#141413;--surface-1:#f5f4ee;--surface-2:#ffffff;--border:rgba(0,0,0,.12)}",
  host: HostOptions = {},
) {
  const bundle = buildWidgetBundle("0.0.0-test");
  const html = widgetCode.replace(
    /<script src="[^"]*"><\/script>/,
    () => `<script>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><style>${hostCss}</style>` +
      "<script>window.__prompts=[];window.__links=[];window.__hostTicks=0;" +
      (host.lexicalGlobals
        ? "const sendPrompt=function(t){window.__prompts.push(t)};" +
          "const openLink=function(u){window.__links.push(u)};"
        : "window.sendPrompt=function(t){window.__prompts.push(t)};" +
          "window.openLink=function(u){window.__links.push(u)};") +
      "</script></head><body>" +
      (host.touchRootOnMutation
        ? "<script>new MutationObserver(function(){ if (window.__hostTicks++ > 500) return;" +
          "document.documentElement.style.setProperty('--host-tick', String(window.__hostTicks));" +
          "document.documentElement.className = 'host-' + (window.__hostTicks % 2); })" +
          ".observe(document.body, { subtree: true, childList: true, attributes: true });</script>"
        : "") +
      `${html}</body></html>`,
    { runScripts: "dangerously", url: "https://widget.invalid/", pretendToBeVisual: true },
  );
  const win = dom.window as unknown as Window & {
    __prompts: string[];
    __links: string[];
    __hostTicks: number;
  };
  return {
    window: dom.window,
    doc: dom.window.document,
    prompts: () => win.__prompts.slice(),
    links: () => win.__links.slice(),
    hostTicks: () => win.__hostTicks,
    tick: (ms = 30) => new Promise<void>((resolve) => dom.window.setTimeout(resolve, ms)),
  };
}

function tabWidget() {
  const card = buildTabCard({
    title: "Three iterator chains",
    tabs: [
      { label: "map", code: "v.iter().map(f)", language: "rust" },
      { label: "filter", code: "v.iter().filter(p)", language: "rust" },
    ],
    contextActions: [{ label: "Explain laziness", prompt: "Explain why iterators are lazy." }],
  });
  return buildWidgetCode({ articleHtml: card.articleHtml, config: card.config, bundleUrl: "https://cdn.invalid/b.js" });
}

describe("widget bundle in a visualizer-like page", () => {
  it("swaps the critical style for the full theme and marks the host", () => {
    const { doc } = mountWidget(tabWidget());
    expect(doc.getElementById("mcc-theme")?.textContent).toContain(".mcc-card");
    expect(doc.getElementById("mcc-critical")).toBeNull();
    expect(doc.documentElement.getAttribute("data-mcc-host")).toBe("widget");
    // The bundle never writes the host's own theme attribute.
    expect(doc.documentElement.getAttribute("data-theme")).toBeNull();
    expect(doc.documentElement.getAttribute("data-mcc-dark")).toBeNull();
  });

  it("runs the card runtime: tabs switch", () => {
    const { doc, window } = mountWidget(tabWidget());
    const tabs = Array.from(doc.querySelectorAll<HTMLElement>('[role="tab"]'));
    const panels = Array.from(doc.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    expect(panels[1].hidden).toBe(true);
    tabs[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(panels[1].hidden).toBe(false);
    expect(panels[0].hidden).toBe(true);
  });

  it("hands context actions to the host through sendPrompt and reports them sent", async () => {
    const { doc, window, prompts, tick } = mountWidget(tabWidget());
    doc.querySelector(".mcc-body")!.dispatchEvent(
      new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }),
    );
    const item = Array.from(doc.querySelectorAll<HTMLElement>("#mcc-menu button")).find(
      (button) => button.textContent === "Explain laziness",
    );
    item!.click();
    await tick(60);
    expect(prompts()).toEqual(["Explain why iterators are lazy."]);
    expect(doc.querySelector("#mcc-outbox .mcc-outbox-status")?.textContent).toContain(
      "Sent to the conversation",
    );
  });

  it("follows a dark host with its own attribute", () => {
    const { doc } = mountWidget(tabWidget(), ":root{--text-primary:#f0efea;--surface-2:#262624}");
    expect(doc.documentElement.getAttribute("data-mcc-dark")).toBe("1");
    expect(doc.documentElement.getAttribute("data-theme")).toBeNull();
    expect(doc.getElementById("mcc-theme")?.textContent).toContain(
      ':root[data-mcc-host="widget"][data-mcc-dark="1"] {',
    );
  });

  it("does not chase a host that touches :root whenever the frame changes", async () => {
    const { doc, window, tick, hostTicks } = mountWidget(tabWidget(), undefined, {
      touchRootOnMutation: true,
    });
    await tick(400);
    const settled = hostTicks();
    await tick(400);
    // A feedback loop keeps the host observer firing until its cap; a quiet
    // frame stops after the bundle's own setup.
    expect(settled).toBeLessThan(50);
    expect(hostTicks()).toBe(settled);
    const tabs = Array.from(doc.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await tick(400);
    expect(hostTicks() - settled).toBeLessThan(20);
  });

  it("reaches a host whose sendPrompt is a lexical global, not a window property", async () => {
    const { doc, window, prompts, tick } = mountWidget(tabWidget(), undefined, {
      lexicalGlobals: true,
    });
    doc.querySelector(".mcc-body")!.dispatchEvent(
      new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }),
    );
    Array.from(doc.querySelectorAll<HTMLElement>("#mcc-menu button"))
      .find((button) => button.textContent === "Explain laziness")!
      .click();
    await tick(60);
    expect(prompts()).toEqual(["Explain why iterators are lazy."]);
  });

  it("rebuilds a missing config so the card is still interactive", () => {
    const code = tabWidget().replace(/<script type="application\/json" id="mcc-config">[^<]*<\/script>/, "");
    const { doc, window } = mountWidget(code);
    const tabs = Array.from(doc.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(doc.querySelectorAll<HTMLElement>('[role="tabpanel"]')[1].hidden).toBe(false);
  });

  it("initializes once even if the bundle is loaded twice", () => {
    const bundle = buildWidgetBundle("0.0.0-test");
    const doubled = tabWidget().replace(
      /<script src="[^"]*"><\/script>/,
      () => `<script>${bundle}</script>\n<script>${bundle}</script>`,
    );
    const { doc, window } = mountWidget(doubled);
    expect(doc.querySelectorAll("#mcc-theme").length).toBe(1);
    expect((window as unknown as { __mccWidgetLoaded?: string }).__mccWidgetLoaded).toBe("0.0.0-test");
  });
});

describe("render mode", () => {
  it("auto: ships a widget to an Apps client whose host never read the template", async () => {
    const client = await connect(true);
    const { structured, text, size } = await tableResult(client);
    expect(structured.display?.shown).toBe(false);
    expect(structured.display?.action).toBe(WIDGET_ACTION);
    expect(structured.display?.title).toBe("iterator_adapters_table_card");
    expect(structured.display?.loading_messages.length).toBeGreaterThan(0);
    expect(structured.display?.widget_code).toContain(structured.card.articleHtml);
    expect(structured.display?.widget_code).toContain(
      `@v${SERVER_VERSION}/widget/mcc-widget.js`,
    );
    // The Apps payload is untouched, so a host that does mount still paints.
    expect(structured.card.articleHtml).toContain("mcc-card");
    expect(structured.parts).toEqual({ current: 1, total: 1, hasMore: false });
    expect(text).toContain("Not displayed yet");
    expect(text).not.toContain("renders inline via the MCP Apps template");
    expect(size).toBeLessThan(resultCharLimit());
    await client.close();
  });

  it("auto: stops shipping widgets once the host reads the template", async () => {
    const client = await connect(true);
    expect((await tableResult(client)).structured.display).toBeDefined();
    await client.readResource({ uri: "ui://mcp-chat-cards/card.html" });
    const after = await tableResult(client);
    expect(after.structured.display).toBeUndefined();
    expect(after.text).toContain("renders inline via the MCP Apps template");
    await client.close();
  });

  it("auto: leaves a client without Apps on the standalone-document link", async () => {
    const client = await connect(false, "plain-client");
    const { structured, text } = await tableResult(client);
    expect(structured.display).toBeUndefined();
    expect(text).toContain("ui://mcp-chat-cards/html/");
    await client.close();
  });

  it("apps: never ships a widget", async () => {
    process.env.MCP_CHAT_CARDS_RENDER = "apps";
    const client = await connect(true);
    expect((await tableResult(client)).structured.display).toBeUndefined();
    await client.close();
  });

  it("widget: always ships one, even after a template read", async () => {
    process.env.MCP_CHAT_CARDS_RENDER = "widget";
    const client = await connect(true);
    await client.readResource({ uri: "ui://mcp-chat-cards/card.html" });
    expect((await tableResult(client)).structured.display?.widget_code).toContain("mcc-card");
    await client.close();
  });

  it("widget mode halves the split budget so every part fits under the ceiling", async () => {
    const section = (n: number) => `## Section ${n}\n\n${"Lorem ipsum dolor sit amet. ".repeat(160)}\n`;
    const markdown = `# Long doc\n\n${Array.from({ length: 12 }, (_, i) => section(i + 1)).join("\n")}`;

    process.env.MCP_CHAT_CARDS_RENDER = "apps";
    const appsClient = await connect(true);
    const apps = await appsClient.callTool({ name: "create_markdown_card", arguments: { markdown } });
    const appsParts = (apps.structuredContent as Structured).parts.total;
    await appsClient.close();

    process.env.MCP_CHAT_CARDS_RENDER = "widget";
    const widgetClient = await connect(true);
    const first = await widgetClient.callTool({ name: "create_markdown_card", arguments: { markdown } });
    const widgetParts = (first.structuredContent as Structured).parts.total;
    expect(widgetParts).toBeGreaterThan(appsParts);
    for (let part = 1; part <= widgetParts; part++) {
      const result = await widgetClient.callTool({
        name: "create_markdown_card",
        arguments: { markdown, part },
      });
      expect(result.isError).toBeFalsy();
      expect(JSON.stringify(result).length).toBeLessThan(resultCharLimit());
    }
    await widgetClient.close();
  });

  it("a code tour of one maximal file still fits as a widget", async () => {
    process.env.MCP_CHAT_CARDS_RENDER = "widget";
    const client = await connect(true);
    const line = 'const value = { "key": "<tag attr=\\"x\\">", n: 42 }; // comment\n';
    const result = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Big", files: [{ path: "big.ts", content: line.repeat(2000) }] },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result).length).toBeLessThan(resultCharLimit());
    await client.close();
  });
});
