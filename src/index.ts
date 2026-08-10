#!/usr/bin/env node
// stdio entry point for desktop chat clients such as Claude Desktop.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, SERVER_VERSION } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  // stdout carries the MCP protocol; log to stderr only.
  console.error(`mcp-chat-cards ${SERVER_VERSION} ready on stdio`);
}

main().catch((error) => {
  console.error("mcp-chat-cards failed to start:", error);
  process.exit(1);
});
