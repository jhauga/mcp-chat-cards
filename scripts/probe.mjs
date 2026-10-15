#!/usr/bin/env node
// Proves this server's MCP Apps surface over real stdio, the way a desktop
// host reaches it: spawns dist/index.js, connects as a client that declares
// the Apps extension, and checks everything a host needs in order to mount a
// card. A clean run means a card that still shows up as text is the host's
// doing, not the server's. Exits 1 when any check fails.
//
// Usage: npm run build && npm run probe
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "dist", "index.js");
const TEMPLATE_URI = "ui://mcp-chat-cards/card.html";
const APP_MIME = "text/html;profile=mcp-app";
const EXTENSION = "io.modelcontextprotocol/ui";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  stderr: "pipe",
});
// The server's own diagnostics (stderr) are the lines a host log would show.
transport.stderr?.on("data", (chunk) => {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line) console.log(`      [server] ${line}`);
  }
});

const client = new Client(
  { name: "mcp-chat-cards-probe", version: "1" },
  { capabilities: { extensions: { [EXTENSION]: { mimeTypes: [APP_MIME] } } } },
);

try {
  await client.connect(transport);
  const server = client.getServerVersion();
  console.log(`server: ${server?.name ?? "?"} ${server?.version ?? "?"}  (${entry})`);

  const capabilities = client.getServerCapabilities();
  const declared = capabilities?.extensions?.[EXTENSION]?.mimeTypes;
  check(
    "server declares the Apps extension in its capabilities",
    Array.isArray(declared) && declared.includes(APP_MIME),
    JSON.stringify(capabilities?.extensions ?? null),
  );

  const { tools } = await client.listTools();
  const cardTools = tools.filter((t) => t.name.startsWith("create_") || t.name === "mirror_web_form");
  const unlinked = cardTools.filter((t) => t._meta?.ui?.resourceUri !== TEMPLATE_URI);
  check(
    `every card tool links to ${TEMPLATE_URI}`,
    cardTools.length > 0 && unlinked.length === 0,
    unlinked.length
      ? `missing on: ${unlinked.map((t) => t.name).join(", ")}`
      : `${cardTools.length} of ${tools.length} tools`,
  );
  const noSchema = cardTools.filter((t) => !t.outputSchema).map((t) => t.name);
  check("every card tool declares an output schema", noSchema.length === 0, noSchema.join(", "));

  const { resources } = await client.listResources();
  const template = resources.find((r) => r.uri === TEMPLATE_URI);
  check(
    "template resource is listed with the mcp-app mime type",
    template?.mimeType === APP_MIME,
    template ? template.mimeType : "not listed",
  );

  const read = await client.readResource({ uri: TEMPLATE_URI });
  const content = read.contents[0];
  check(
    "template resource reads back as an HTML document",
    content?.mimeType === APP_MIME &&
      typeof content.text === "string" &&
      content.text.startsWith("<!DOCTYPE html>"),
    `${content?.text?.length ?? 0} chars`,
  );

  const result = await client.callTool({
    name: "create_table_card",
    arguments: { title: "Probe", headers: ["A", "B"], rows: [["1", "2"]] },
  });
  const card = result.structuredContent?.card;
  check(
    "create_table_card returns structuredContent.card for the template to paint",
    !result.isError && typeof card?.articleHtml === "string" && typeof card?.config?.id === "string",
    card
      ? `${card.config.kind} ${card.config.id}, ${JSON.stringify(result).length} chars`
      : JSON.stringify(result.content?.[0] ?? null),
  );
  check(
    "an Apps client gets no standalone-html fallback in content",
    Array.isArray(result.content) && result.content.every((block) => block.type === "text"),
    Array.isArray(result.content) ? result.content.map((block) => block.type).join(",") : "?",
  );
} catch (error) {
  check("probe completed without a protocol error", false, String(error));
} finally {
  await client.close().catch(() => undefined);
}

const failed = checks.filter((c) => !c.ok).length;
console.log(
  failed
    ? `\n${failed} check(s) failed: the server side is not healthy.`
    : "\nAll checks passed: the server side is healthy. A card that still renders as text is the host's doing.",
);
process.exit(failed ? 1 : 0);
