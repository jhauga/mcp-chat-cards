// Integration tests: run the real server over an in-memory MCP transport
// and call tools exactly the way a chat client would.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createServer } from "../src/server.js";
import {
  ITEM_TARGET_COST,
  splittingMarkdown,
  splittingTourFiles,
  SPLIT_MARKDOWN_HEADINGS,
} from "./fixtures/split-payloads.js";
import { DEFAULT_CARD_BUDGET } from "../src/util/budget.js";
import { planTourParts, renderedTabCost } from "../src/cards/code-tour.js";

interface ContentBlock {
  type: string;
  text?: string;
  uri?: string;
  mimeType?: string;
  resource?: { uri: string; mimeType?: string; text?: string };
}

// Non-Apps hosts get a link to the standalone document rather than ~16KB of
// theme and runtime inlined in every result; this is how they fetch it.
async function readCardHtml(result: { content: unknown }): Promise<string> {
  const content = result.content as ContentBlock[];
  const link = content.find((block) => block.type === "resource_link");
  expect(link?.uri).toMatch(/^ui:\/\/mcp-chat-cards\/html\//);
  const read = await client.readResource({ uri: link?.uri as string });
  return (read.contents[0] as { text?: string }).text ?? "";
}

interface CardStructuredContent {
  card: { articleHtml: string; config: { id: string; kind: string } };
  parts?: { current: number; total: number; hasMore: boolean };
}

function cardOf(result: { structuredContent?: unknown }): CardStructuredContent {
  return result.structuredContent as CardStructuredContent;
}

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
});

describe("tool listing", () => {
  it("exposes every card tool", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual(
      [
        "create_animation_card",
        "create_chart_card",
        "create_code_tour_card",
        "create_form_card",
        "create_list_card",
        "create_markdown_card",
        "create_reveal_card",
        "create_tab_card",
        "create_table_card",
        "create_video_card",
        "fetch_reference",
        "get_insert_bookmarklet",
        "mirror_web_form",
        "read_local_file",
        "submit_web_form",
        "unpack_archive",
      ].sort(),
    );
  });
});

describe("tool schema dialect interoperability", () => {
  // A strict host validating with a 2020-12-only validator rejects any tool
  // whose schema declares the draft-07 dialect - in practice every card
  // tool, since only they carry an outputSchema. Served schemas must not
  // declare draft-07.
  it("serves every tool schema without a draft-07 dialect declaration", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect((tool.inputSchema as Record<string, unknown>)?.["$schema"]).toBeUndefined();
      const output = tool.outputSchema as Record<string, unknown> | undefined;
      if (output) expect(output["$schema"]).toBeUndefined();
    }
    // The card tools' output schemas - the part strict hosts validate - are
    // still being served at all.
    expect(tools.filter((tool) => tool.outputSchema).length).toBeGreaterThan(0);
  });

  // The guard the six-defect pass asked for: one tool regressing to another
  // dialect breaks every card call on a strict host, and the failure surfaces
  // client-side before dispatch, so no server-side test would ever see it.
  // MCP's default dialect is 2020-12, so a schema that declares nothing is
  // validated as 2020-12; declaring it explicitly is equally fine. Anything
  // else - draft-07 above all - is the regression.
  it("serves every tool schema under the 2020-12 dialect", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    const dialectOf = (schema: unknown): unknown =>
      (schema as Record<string, unknown> | undefined)?.["$schema"];
    for (const tool of tools) {
      for (const schema of [tool.inputSchema, tool.outputSchema]) {
        if (!schema) continue;
        const dialect = dialectOf(schema);
        expect(
          dialect === undefined || dialect === "https://json-schema.org/draft/2020-12/schema",
          `${tool.name} declares dialect ${String(dialect)}`,
        ).toBe(true);
      }
    }
    // Every card tool carries an outputSchema, which is the part a strict
    // host validates; if these stopped being served the guard would pass
    // vacuously.
    const cardTools = tools.filter((tool) => tool.name.startsWith("create_"));
    expect(cardTools.length).toBeGreaterThan(0);
    expect(cardTools.every((tool) => tool.outputSchema)).toBe(true);
  });

  // Canary pinning the SDK behavior the shim compensates for: a bare
  // McpServer still stamps draft-07. When an SDK upgrade makes this test
  // fail, the SDK emits a different dialect and schema-dialect.ts can be
  // retired.
  it("canary: the bare SDK still stamps schemas with draft-07", async () => {
    const raw = new McpServer({ name: "canary", version: "0.0.0" });
    raw.registerTool(
      "canary_tool",
      {
        inputSchema: { value: z.string() },
        outputSchema: { value: z.string() },
      },
      async () => ({ content: [], structuredContent: { value: "x" } }),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await raw.connect(serverTransport);
    const rawClient = new Client({ name: "canary-client", version: "0.0.0" });
    await rawClient.connect(clientTransport);
    const { tools } = await rawClient.listTools();
    expect((tools[0].outputSchema as Record<string, unknown>)["$schema"]).toBe(
      "http://json-schema.org/draft-07/schema#",
    );
    await rawClient.close();
  });
});

describe("MCP Apps integration", () => {
  it("links every card tool to the ui template via _meta.ui.resourceUri", async () => {
    const { tools } = await client.listTools();
    const linked = tools
      .filter((tool) => {
        const ui = (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
        return ui?.resourceUri === "ui://mcp-chat-cards/card.html";
      })
      .map((tool) => tool.name)
      .sort();
    expect(linked).toEqual([
      "create_animation_card",
      "create_chart_card",
      "create_code_tour_card",
      "create_form_card",
      "create_list_card",
      "create_markdown_card",
      "create_reveal_card",
      "create_tab_card",
      "create_table_card",
      "create_video_card",
      "mirror_web_form",
    ]);
  });

  it("pre-declares the card template resource with the mcp-app mime type", async () => {
    const { resources } = await client.listResources();
    const template = resources.find((r) => r.uri === "ui://mcp-chat-cards/card.html");
    expect(template).toBeDefined();
    expect(template?.mimeType).toBe("text/html;profile=mcp-app");

    const read = await client.readResource({ uri: "ui://mcp-chat-cards/card.html" });
    const content = read.contents[0] as { mimeType?: string; text?: string };
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toContain('"ui/initialize"');
    expect(content.text).toContain('id="mcc-root"');
  });

  it("returns structuredContent.card for the template to render", async () => {
    const result = await client.callTool({
      name: "create_reveal_card",
      arguments: {
        title: "FAQ",
        sections: [{ heading: "What is this?", text: "A card." }],
      },
    });
    const structured = result.structuredContent as CardStructuredContent;
    expect(structured.card.articleHtml).toContain("mcc-card");
    expect(structured.card.articleHtml).not.toContain("<html");
    expect(structured.card.config.kind).toBe("show-hide");
  });
});

describe("create_animation_card", () => {
  it("renders a scene player card through the tool schema", async () => {
    const result = await client.callTool({
      name: "create_animation_card",
      arguments: {
        title: "Build pipeline in 3 scenes",
        scenes: [
          { heading: "The pipeline", text: "From source to binary.", transition: "fade" },
          {
            transition: "draw",
            shapes: [
              { type: "rect", x: 8, y: 35, w: 22, h: 22, label: "Source" },
              { type: "arrow", x: 32, y: 46, x2: 55, y2: 46 },
              { type: "rect", x: 58, y: 35, w: 22, h: 22, label: "Binary" },
            ],
          },
          {
            heading: "Build times",
            chart: {
              type: "bar",
              labels: ["clean", "cached", "incremental"],
              values: [42, 8, 3],
              zoom: { from: 1, to: 2 },
            },
          },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as CardStructuredContent;
    expect(structured.card.config.kind).toBe("motion");
    expect(structured.card.articleHtml).toContain("mcc-motion");
    expect(structured.card.articleHtml).toContain("data-mcc-zoom=");
  });
});

describe("insert bookmarklet", () => {
  it("returns the Insert Card bookmarklet with usage instructions", async () => {
    const result = await client.callTool({ name: "get_insert_bookmarklet", arguments: {} });
    const content = result.content as ContentBlock[];
    const text = content[0].text ?? "";
    expect(text).toContain("javascript:");
    expect(text).toContain("Insert Card");
    // The payload is URL-encoded so it survives being saved as a bookmark URL.
    expect(text).toContain(encodeURIComponent("__mccInsertInstalled"));
  });
});

describe("capability-aware results", () => {
  it("omits the embedded html fallback for clients declaring Apps support", async () => {
    const [appsClientTransport, appsServerTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(appsServerTransport);
    const appsClient = new Client(
      { name: "apps-client", version: "0.0.0" },
      {
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] },
          },
        } as Record<string, unknown>,
      },
    );
    await appsClient.connect(appsClientTransport);

    const result = await appsClient.callTool({
      name: "create_table_card",
      arguments: { title: "Compact", headers: ["A"], rows: [["1"]] },
    });
    const content = result.content as ContentBlock[];
    expect(content.some((block) => block.type === "resource")).toBe(false);
    const structured = result.structuredContent as CardStructuredContent;
    expect(structured.card.articleHtml).toContain("mcc-card");
    await appsClient.close();
  });
});

describe("result size", () => {
  it("does not inline the standalone document in a card result", async () => {
    const result = await client.callTool({
      name: "create_table_card",
      arguments: { title: "Compact", headers: ["A"], rows: [["1"]] },
    });
    const serialized = JSON.stringify(result.content);
    // The theme and runtime are byte-for-byte identical in every card; the
    // whole point of the link is that they no longer ride along.
    expect(serialized).not.toContain("<!DOCTYPE html>");
    expect(serialized).not.toContain("mccInit");
    expect(serialized.length).toBeLessThan(2000);
  });

  it("splits a multi-file code tour instead of emitting an oversized result", async () => {
    // Five files that individually render fine but together exceeded the
    // host's ceiling as one card.
    const files = Array.from({ length: 5 }, (_, i) => ({
      path: `src/mod${i}.rs`,
      content: `// module ${i}\n${'fn work<T>(v: &T) -> &T { v }\n'.repeat(260)}`,
    }));
    const result = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Rust tour", files },
    });
    expect(result.isError).toBeUndefined();
    const content = result.content as ContentBlock[];
    expect(content[0].text).toContain("more part(s) remain");
    expect(JSON.stringify(result).length).toBeLessThan(40_000);

    const part2 = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Rust tour", files, part: 2 },
    });
    expect(part2.isError).toBeUndefined();
    expect(JSON.stringify(part2).length).toBeLessThan(40_000);
  });

  it("reports an actionable error rather than an unrenderable table", async () => {
    const rows = Array.from({ length: 4000 }, (_, i) => [`row ${i}`, "x".repeat(40)]);
    const result = await client.callTool({
      name: "create_table_card",
      arguments: { title: "Too big", headers: ["Name", "Value"], rows },
    });
    expect(result.isError).toBe(true);
    const content = result.content as ContentBlock[];
    expect(content[0].text).toContain("over the");
    expect(content[0].text).toContain("Split the content");
  });
});

describe("text handling through the tool layer", () => {
  it("escapes a pre-escaped title exactly once, so the entity shows literally", async () => {
    const result = await client.callTool({
      name: "create_reveal_card",
      arguments: {
        title: "Predict, Spot &amp; Fix",
        sections: [{ heading: "Why", text: "Because callers pre-escape." }],
      },
    });
    const structured = result.structuredContent as CardStructuredContent;
    // The caller asked for the text "Predict, Spot &amp; Fix" to be READ, so
    // that is what the card displays.
    expect(structured.card.articleHtml).toContain("<h1>Predict, Spot &amp;amp; Fix</h1>");
  });

  it("escapes a plain ampersand in the same field", async () => {
    const result = await client.callTool({
      name: "create_reveal_card",
      arguments: { title: "Predict, Spot & Fix", sections: [{ heading: "Why", text: "Plain." }] },
    });
    const structured = result.structuredContent as CardStructuredContent;
    expect(structured.card.articleHtml).toContain("<h1>Predict, Spot &amp; Fix</h1>");
  });

  it("keeps overlapping tutor terms out of attributes and svg titles", async () => {
    const list = await client.callTool({
      name: "create_list_card",
      arguments: {
        title: "Rust roadmap",
        items: [{ text: "Parse arguments with clap, the argument crate." }],
        tutorTerms: [
          { term: "clap", tip: "The standard Rust crate for parsing command line arguments" },
          { term: "crate", tip: "A Rust package or library" },
        ],
      },
    });
    const listHtml = (list.structuredContent as CardStructuredContent).card.articleHtml;
    for (const [, tip] of listHtml.matchAll(/data-tip="([^"]*)"/g)) {
      expect(tip).not.toContain("mcc-term");
      expect(tip).not.toContain("<span");
    }

    const chart = await client.callTool({
      name: "create_chart_card",
      arguments: {
        title: "Rust scorecard",
        type: "bar",
        labels: ["Memory safety", "Tooling"],
        series: [{ name: "Rust", values: [5, 4] }],
        tutorTerms: [{ term: "Memory safety", tip: "No data races at compile time" }],
      },
    });
    const chartHtml = (chart.structuredContent as CardStructuredContent).card.articleHtml;
    for (const [, text] of chartHtml.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      expect(text).not.toContain("<span");
    }
  });
});

describe("pre-escaped input renders literally in every text field", () => {
  // Input fields take PLAIN text. A caller documenting HTML or templating
  // passes "&amp;" so the reader sees "&amp;", which means the emitted markup
  // must carry "&amp;amp;". The same string used to render four different
  // ways depending on which field it landed in.
  const LITERAL = "&amp;";
  const ESCAPED_ONCE = "&amp;amp;";

  it("keeps it literal in table card headers and rows", async () => {
    const result = await client.callTool({
      name: "create_table_card",
      arguments: {
        title: "Escaping",
        headers: ["Pre-escaped &amp;"],
        rows: [["&amp;"], ["&lt;div&gt;"], ["&quot;"]],
      },
    });
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain("<th scope=\"col\">Pre-escaped &amp;amp;</th>");
    expect(html).toContain("<td>&amp;amp;</td>");
    expect(html).toContain("<td>&amp;lt;div&amp;gt;</td>");
    expect(html).toContain("<td>&amp;quot;</td>");
  });

  it("keeps it literal in tab card text and code fields", async () => {
    const result = await client.callTool({
      name: "create_tab_card",
      arguments: {
        title: "Escaping",
        tabs: [
          { label: "Prose", text: LITERAL },
          { label: "Source", code: LITERAL, language: "html" },
        ],
      },
    });
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain(`<p>${ESCAPED_ONCE}</p>`);
    expect(html).toContain(`<code class="language-html">${ESCAPED_ONCE}</code>`);
  });

  it("keeps it literal in markdown table cells without regressing code", async () => {
    const result = await client.callTool({
      name: "create_markdown_card",
      arguments: {
        title: "Escaping",
        markdown:
          "| Head &amp; |\n| --- |\n| &amp; |\n\nInline `&amp;` span.\n\n```\nfenced &amp; code\n```\n",
      },
    });
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain("<th>Head &amp;amp;</th>");
    expect(html).toContain("<td>&amp;amp;</td>");
    // Code spans and fences were already correct; they must stay correct.
    expect(html).toContain("<code>&amp;amp;</code>");
    expect(html).toContain("fenced &amp;amp; code");
  });

  it("still escapes raw markup characters exactly once", async () => {
    const result = await client.callTool({
      name: "create_table_card",
      arguments: { title: "Raw", headers: ["A & B"], rows: [["<script>x</script>"]] },
    });
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("multi-part results carry a machine-readable split signal", () => {
  // "(part 1 of 2)" in the rendered title is for humans. A consumer that does
  // not scrape the title had no way to know content was withheld, and silently
  // lost it. The fixtures below are sized by MEASURED rendered cost, not by
  // raw input length, so the hasMore:true branch is exercised deterministically
  // instead of depending on how heavily a hand-written payload happens to
  // escape - which is why that branch went unobserved in live testing.

  it("builds fixtures that provably straddle the budget", () => {
    // Guards the guard: if the budget or the cost function moves, this fails
    // loudly rather than letting the split assertions below pass vacuously on
    // a payload that no longer splits.
    const files = splittingTourFiles();
    const costs = files.map((file) => renderedTabCost(file));
    for (const cost of costs) {
      expect(cost).toBeGreaterThanOrEqual(ITEM_TARGET_COST);
      expect(cost).toBeLessThan(DEFAULT_CARD_BUDGET);
    }
    const total = costs.reduce((sum, cost) => sum + cost, 0);
    expect(total).toBeGreaterThan(DEFAULT_CARD_BUDGET);
    expect(total).toBeLessThanOrEqual(DEFAULT_CARD_BUDGET * 2);
    expect(planTourParts(files)).toHaveLength(2);
  });

  it("reports hasMore true on part 1 of a split code tour and delivers the rest on part 2", async () => {
    const files = splittingTourFiles();
    const first = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Rust tour", files },
    });
    expect(first.isError).toBeUndefined();
    expect(cardOf(first).parts).toEqual({ current: 1, total: 2, hasMore: true });
    // The human-facing suffix stays alongside the machine-readable field.
    expect(cardOf(first).card.articleHtml).toContain("part 1 of 2");

    const second = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Rust tour", files, part: 2 },
    });
    expect(second.isError).toBeUndefined();
    expect(cardOf(second).parts).toEqual({ current: 2, total: 2, hasMore: false });

    // Every file appears in exactly one part: nothing withheld, nothing
    // duplicated. This is the loss the field exists to make detectable.
    const tabsOf = (result: { structuredContent?: unknown }): string[] =>
      files
        .map((file) => file.path)
        .filter((path) => cardOf(result).card.articleHtml.includes(path));
    const inFirst = tabsOf(first);
    const inSecond = tabsOf(second);
    expect(inFirst.length).toBeGreaterThan(0);
    expect(inSecond.length).toBeGreaterThan(0);
    expect(inFirst.filter((path) => inSecond.includes(path))).toEqual([]);
    expect([...inFirst, ...inSecond].sort()).toEqual(files.map((file) => file.path).sort());
  });

  it("reports hasMore true on part 1 of a split markdown document", async () => {
    const markdown = splittingMarkdown();
    const first = await client.callTool({
      name: "create_markdown_card",
      arguments: { markdown },
    });
    expect(first.isError).toBeUndefined();
    expect(cardOf(first).parts).toEqual({ current: 1, total: 2, hasMore: true });

    const second = await client.callTool({
      name: "create_markdown_card",
      arguments: { markdown, part: 2 },
    });
    expect(cardOf(second).parts).toEqual({ current: 2, total: 2, hasMore: false });

    const headingsIn = (result: { structuredContent?: unknown }): string[] =>
      SPLIT_MARKDOWN_HEADINGS.filter((heading) =>
        cardOf(result).card.articleHtml.includes(`<summary>${heading}</summary>`),
      );
    expect([...headingsIn(first), ...headingsIn(second)]).toEqual(SPLIT_MARKDOWN_HEADINGS);
  });

  it("reports hasMore false for a payload under the budget", async () => {
    const small = Array.from({ length: 6 }, (_, i) => ({
      path: `src/small${i}.rs`,
      content: `// small ${i}\n${"fn f() {}\n".repeat(20)}`,
    }));
    const tour = await client.callTool({
      name: "create_code_tour_card",
      arguments: { title: "Small tour", files: small },
    });
    expect(cardOf(tour).parts).toEqual({ current: 1, total: 1, hasMore: false });
    expect(cardOf(tour).card.articleHtml).not.toContain("part 1 of");

    const doc = await client.callTool({
      name: "create_markdown_card",
      arguments: { markdown: "# Small\n\n## Only\n\nBrief." },
    });
    expect(cardOf(doc).parts).toEqual({ current: 1, total: 1, hasMore: false });
  });

  // Resolution (b) of the API-shape question: a generic completeness check
  // must not throw on the card types that never split.
  it("emits parts on every card type, not only the split-capable ones", async () => {
    const calls: { name: string; arguments: Record<string, unknown> }[] = [
      { name: "create_tab_card", arguments: { title: "T", tabs: [{ label: "A", text: "a" }] } },
      { name: "create_table_card", arguments: { title: "T", headers: ["A"], rows: [["1"]] } },
      {
        name: "create_form_card",
        arguments: { title: "T", fields: [{ name: "a", label: "A" }] },
      },
      {
        name: "create_chart_card",
        arguments: {
          title: "T",
          type: "bar",
          labels: ["a"],
          series: [{ name: "s", values: [1] }],
        },
      },
      {
        name: "create_video_card",
        arguments: { title: "T", src: "https://example.com/clip.mp4" },
      },
      {
        name: "create_animation_card",
        arguments: { title: "T", scenes: [{ heading: "One", text: "x" }] },
      },
      {
        name: "create_reveal_card",
        arguments: { title: "T", sections: [{ heading: "H", text: "t" }] },
      },
      { name: "create_list_card", arguments: { title: "T", items: [{ text: "one" }] } },
      { name: "create_markdown_card", arguments: { markdown: "# T\n\nBody." } },
      {
        name: "create_code_tour_card",
        arguments: { title: "T", files: [{ path: "a.rs", content: "fn main() {}" }] },
      },
    ];
    for (const call of calls) {
      const result = await client.callTool(call);
      expect(result.isError, `${call.name} failed`).toBeUndefined();
      // The check a consumer actually writes, on every card type.
      expect(cardOf(result).parts, call.name).toEqual({
        current: 1,
        total: 1,
        hasMore: false,
      });
      expect(cardOf(result).parts?.hasMore, call.name).toBe(false);
    }
  });
});

describe("create_video_card source validation", () => {
  it("rejects a streaming platform page and names the alternative", async () => {
    const result = await client.callTool({
      name: "create_video_card",
      arguments: { title: "Clip", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as ContentBlock[])[0].text ?? "";
    expect(text).toContain("youtube.com");
    expect(text).toContain("create_animation_card");
    expect(result.structuredContent).toBeUndefined();
  });

  it("still accepts a direct video file and infers its type", async () => {
    const result = await client.callTool({
      name: "create_video_card",
      arguments: { title: "Clip", src: "https://example.com/clip.mp4", autoplay: true },
    });
    expect(result.isError).toBeUndefined();
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain("<video class=\"mcc-video-player\" controls playsinline preload=\"metadata\"");
    expect(html).toContain('type="video/mp4"');
    expect(html).toContain(" muted");
    expect(html).toContain(" autoplay");
    // The fallback link is part of the working card, not collateral of the
    // rejection path.
    expect(html).toContain("Open the clip directly");
    expect(html).toContain('href="https://example.com/clip.mp4"');
  });

  // The denylist must stay discriminating. Rejecting a valid direct URL would
  // be a worse defect than the dead player it was added to prevent.
  it("accepts direct sources the denylist must not sweep up", async () => {
    for (const src of [
      "https://example.com/clip.webm",
      "https://cdn.example.com/videos/youtube-review.mp4",
      "https://notyoutube.com/clip.mp4",
      "https://vimeo-mirror.example.com/clip.mp4",
      "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28y",
    ]) {
      const result = await client.callTool({
        name: "create_video_card",
        arguments: { title: "Clip", src },
      });
      expect(result.isError, src).toBeUndefined();
      expect(cardOf(result).card.articleHtml, src).toContain("mcc-video-player");
    }
  });
});

describe("create_reveal_card code sections", () => {
  it("renders a code field as a copyable block, not a paragraph", async () => {
    const result = await client.callTool({
      name: "create_reveal_card",
      arguments: {
        title: "Add a flag",
        sections: [
          {
            heading: "Quiet mode",
            text: "Add a bool field:",
            code: "#[arg(long)]\n    quiet: bool,",
            language: "rust",
          },
        ],
      },
    });
    const html = cardOf(result).card.articleHtml;
    expect(html).toContain("mcc-copy-code");
    expect(html).toContain('<code class="language-rust">');
    expect(html).toContain("#[arg(long)]\n    quiet: bool,");
    expect(html).not.toContain("quiet: bool,<br>");
  });
});

describe("template tokens outside a promptTemplate", () => {
  // {{name}} is substituted by the card runtime only inside a form's
  // promptTemplate and a context action's prompt. Anywhere else it is ordinary
  // text and must survive verbatim, nesting included.
  const TOKENS = "{{topic}} and {{ nested {{x}} }}";

  it("survives unsubstituted in titles, cells, and prose", async () => {
    const table = await client.callTool({
      name: "create_table_card",
      arguments: { title: TOKENS, headers: [TOKENS], rows: [[TOKENS]] },
    });
    const tableHtml = cardOf(table).card.articleHtml;
    expect(tableHtml).toContain(`<h1>${TOKENS}</h1>`);
    expect(tableHtml).toContain(`<th scope="col">${TOKENS}</th>`);
    expect(tableHtml).toContain(`<td>${TOKENS}</td>`);

    const reveal = await client.callTool({
      name: "create_reveal_card",
      arguments: { title: "T", sections: [{ heading: TOKENS, text: TOKENS }] },
    });
    const revealHtml = cardOf(reveal).card.articleHtml;
    expect(revealHtml).toContain(`<summary>${TOKENS}</summary>`);
    expect(revealHtml).toContain(`<p>${TOKENS}</p>`);
  });

  it("is carried into a form's promptTemplate for the runtime to substitute", async () => {
    const result = await client.callTool({
      name: "create_form_card",
      arguments: {
        title: "Ask",
        promptTemplate: "Teach {{topic}} simply.",
        fields: [{ name: "topic", label: "Topic" }],
      },
    });
    expect(cardOf(result).card.articleHtml).toContain(
      'data-prompt-template="Teach {{topic}} simply."',
    );
  });
});

describe("card tool calls", () => {
  it("returns a ui:// html resource for a table card", async () => {
    const result = await client.callTool({
      name: "create_table_card",
      arguments: {
        title: "JavaScript array methods",
        headers: ["Method", "Purpose"],
        rows: [
          ["map", "transform each item"],
          ["filter", "keep matching items"],
        ],
      },
    });
    const content = result.content as ContentBlock[];
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("table card");
    const link = content.find((block) => block.type === "resource_link");
    expect(link?.uri).toMatch(/^ui:\/\/mcp-chat-cards\/html\//);
    expect(link?.mimeType).toBe("text/html");
    expect(await readCardHtml(result)).toContain("<td>map</td>");
  });

  it("returns a form card whose submission drives the next prompt", async () => {
    const result = await client.callTool({
      name: "create_form_card",
      arguments: {
        title: "Study preferences",
        promptTemplate: "Teach {{topic}} with {{style}} examples.",
        fields: [
          { name: "topic", required: true },
          { name: "style", type: "select", options: ["practical", "theoretical"] },
        ],
      },
    });
    const html = await readCardHtml(result);
    expect(html).toContain("data-prompt-template");
    expect(html).toContain("mcc-form");
  });

  it("validates chart inputs and reports tool errors", async () => {
    const result = await client.callTool({
      name: "create_chart_card",
      arguments: { title: "Broken", type: "bar" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as ContentBlock[];
    expect(content[0].text).toContain("labels and series");
  });

  it("builds nested list cards", async () => {
    const result = await client.callTool({
      name: "create_list_card",
      arguments: {
        title: "Outline",
        items: [{ text: "Intro", children: [{ text: "Goals" }] }, { text: "Wrap up" }],
      },
    });
    expect(await readCardHtml(result)).toContain("mcc-seq");
  });

  it("renders a markdown card from inline content", async () => {
    const result = await client.callTool({
      name: "create_markdown_card",
      arguments: {
        markdown: "# Field Guide\n\nIntro.\n\n## Basics\n\nContent here.\n\n## Practice\n\nMore.",
      },
    });
    expect(result.isError).toBeUndefined();
    const html = await readCardHtml(result);
    expect(html).toContain("<h1>Field Guide</h1>");
    expect(html).toContain("<summary>Basics</summary>");
    const structured = result.structuredContent as CardStructuredContent;
    expect(structured.card.config.kind).toBe("document");
  });

  it("requires markdown or path for create_markdown_card", async () => {
    const result = await client.callTool({
      name: "create_markdown_card",
      arguments: { title: "Empty" },
    });
    expect(result.isError).toBe(true);
  });

  it("builds a code tour card from explicit files", async () => {
    const result = await client.callTool({
      name: "create_code_tour_card",
      arguments: {
        title: "Sample tour",
        files: [
          { path: "README.md", content: "# Sample" },
          { path: "src/app.py", content: "print('hi')" },
        ],
      },
    });
    expect(result.isError).toBeUndefined();
    expect(await readCardHtml(result)).toContain("language-python");
  });

  it("blocks private urls in fetch_reference", async () => {
    const result = await client.callTool({
      name: "fetch_reference",
      arguments: { url: "http://127.0.0.1/secret" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as ContentBlock[];
    expect(content[0].text).toContain("Blocked");
  });
});
