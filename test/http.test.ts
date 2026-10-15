// The Streamable HTTP entry point, exercised the way a remote connector
// reaches it: a real listener on an ephemeral loopback port, the SDK's
// Streamable HTTP client, and a bearer token on every request.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearerMatches, startHttpServer, type RunningHttpServer } from "../src/http.js";

const TOKEN = "test-token-0123456789abcdef";
const APPS_CAPABILITIES = {
  extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } },
};
const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

let running: RunningHttpServer;
const lines: string[] = [];

beforeAll(async () => {
  running = await startHttpServer({
    port: 0,
    token: TOKEN,
    diagnostics: (line) => lines.push(line),
  });
});

afterAll(async () => {
  await running.close();
});

function initializeBody(id: number): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "raw-client", version: "0.0.0" },
    },
  });
}

describe("Streamable HTTP entry point", () => {
  it("binds to loopback on the requested port", () => {
    expect(running.host).toBe("127.0.0.1");
    expect(running.port).toBeGreaterThan(0);
    expect(running.url).toBe(`http://127.0.0.1:${running.port}/mcp`);
  });

  it("serves the card tools, the template, and card results over one session", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(running.url), {
      requestInit: { headers: { authorization: `Bearer ${TOKEN}` } },
    });
    const client = new Client(
      { name: "http-test", version: "0.0.0" },
      { capabilities: APPS_CAPABILITIES as Record<string, unknown> },
    );
    await client.connect(transport);

    const capabilities = client.getServerCapabilities() as
      | { extensions?: Record<string, unknown> }
      | undefined;
    expect(capabilities?.extensions?.["io.modelcontextprotocol/ui"]).toBeDefined();

    const { tools } = await client.listTools();
    const table = tools.find((tool) => tool.name === "create_table_card");
    const ui = (table?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
    expect(ui?.resourceUri).toBe("ui://mcp-chat-cards/card.html");

    const read = await client.readResource({ uri: "ui://mcp-chat-cards/card.html" });
    expect((read.contents[0] as { mimeType?: string }).mimeType).toBe("text/html;profile=mcp-app");

    const result = await client.callTool({
      name: "create_table_card",
      arguments: { title: "Over HTTP", headers: ["A"], rows: [["1"]] },
    });
    const structured = result.structuredContent as { card: { articleHtml: string } };
    expect(structured.card.articleHtml).toContain("mcc-card");
    // An Apps client gets no standalone-html fallback, same as over stdio.
    expect((result.content as { type: string }[]).every((block) => block.type === "text")).toBe(
      true,
    );
    expect(running.sessionCount()).toBe(1);

    await transport.terminateSession();
    await client.close();
    expect(running.sessionCount()).toBe(0);

    expect(lines.some((line) => line.includes("connected (apps extension: declared)"))).toBe(true);
    expect(lines.some((line) => line.startsWith("mcp-chat-cards template read by host ("))).toBe(
      true,
    );
    expect(lines.some((line) => /^mcp-chat-cards http: session \S+ opened/.test(line))).toBe(true);
    expect(lines.some((line) => /^mcp-chat-cards http: session \S+ closed by client/.test(line))).toBe(
      true,
    );
  });

  it("rejects a missing or wrong bearer token with 401 before any session work", async () => {
    const attempts: Record<string, string>[] = [
      {},
      { authorization: "Bearer not-the-token-0123456789" },
      { authorization: TOKEN },
    ];
    for (const headers of attempts) {
      const response = await fetch(running.url, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...headers },
        body: initializeBody(1),
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      await response.text();
    }
    expect(running.sessionCount()).toBe(0);
    expect(lines.filter((line) => line.includes("missing or wrong bearer token")).length).toBe(3);
  });

  it("rejects an unknown session, a session-less non-initialize request, and other paths", async () => {
    const headers = { ...JSON_HEADERS, authorization: `Bearer ${TOKEN}` };
    const unknownSession = await fetch(running.url, {
      method: "POST",
      headers: { ...headers, "mcp-session-id": "no-such-session" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(unknownSession.status).toBe(404);
    await unknownSession.text();

    const noInitialize = await fetch(running.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
    });
    expect(noInitialize.status).toBe(400);
    await noInitialize.text();

    const notJson = await fetch(running.url, { method: "POST", headers, body: "{not json" });
    expect(notJson.status).toBe(400);
    await notJson.text();

    const otherPath = await fetch(running.url.replace(/\/mcp$/, "/elsewhere"), {
      method: "POST",
      headers,
      body: initializeBody(4),
    });
    expect(otherPath.status).toBe(404);
    await otherPath.text();
    expect(running.sessionCount()).toBe(0);
  });

  it("compares bearer tokens exactly, case-insensitive only in the scheme", () => {
    expect(bearerMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(bearerMatches(`bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(bearerMatches(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(bearerMatches(`Bearer ${TOKEN.toUpperCase()}`, TOKEN)).toBe(false);
    expect(bearerMatches(TOKEN, TOKEN)).toBe(false);
    expect(bearerMatches(undefined, TOKEN)).toBe(false);
  });

  it("refuses to start with a short token", async () => {
    await expect(startHttpServer({ port: 0, token: "short" })).rejects.toThrow(/at least 16/);
  });
});
