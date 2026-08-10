// Integration tests: run the real server over an in-memory MCP transport
// and call tools exactly the way a chat client would.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

interface ContentBlock {
  type: string;
  text?: string;
  resource?: { uri: string; mimeType?: string; text?: string };
}

interface CardStructuredContent {
  card: { articleHtml: string; config: { id: string; kind: string } };
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
        "mirror_web_form",
        "read_local_file",
        "submit_web_form",
        "unpack_archive",
      ].sort(),
    );
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
    const resource = content.find((block) => block.type === "resource")?.resource;
    expect(resource?.uri).toMatch(/^ui:\/\/mcp-chat-cards\//);
    expect(resource?.mimeType).toBe("text/html");
    expect(resource?.text).toContain("<td>map</td>");
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
    const content = result.content as ContentBlock[];
    const resource = content.find((block) => block.type === "resource")?.resource;
    expect(resource?.text).toContain("data-prompt-template");
    expect(resource?.text).toContain("mcc-form");
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
    const content = result.content as ContentBlock[];
    const resource = content.find((block) => block.type === "resource")?.resource;
    expect(resource?.text).toContain("mcc-seq");
  });

  it("renders a markdown card from inline content", async () => {
    const result = await client.callTool({
      name: "create_markdown_card",
      arguments: {
        markdown: "# Field Guide\n\nIntro.\n\n## Basics\n\nContent here.\n\n## Practice\n\nMore.",
      },
    });
    expect(result.isError).toBeUndefined();
    const content = result.content as ContentBlock[];
    const resource = content.find((block) => block.type === "resource")?.resource;
    expect(resource?.text).toContain("<h1>Field Guide</h1>");
    expect(resource?.text).toContain("<summary>Basics</summary>");
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
    const content = result.content as ContentBlock[];
    const resource = content.find((block) => block.type === "resource")?.resource;
    expect(resource?.text).toContain("language-python");
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
