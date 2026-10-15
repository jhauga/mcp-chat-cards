#!/usr/bin/env node
// stdio entry point for desktop chat clients such as Claude Desktop.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, SERVER_VERSION } from "./server.js";

// A process that dies without a word shows up in the host's log as a bare
// "transport closed", indistinguishable from a network drop - which sends
// whoever debugs it down the wrong path. Every exit route is named on stderr
// (the host captures it per server); stdout carries the MCP protocol and
// must stay clean.
process.on("uncaughtException", (error) => {
  console.error("mcp-chat-cards uncaught exception:", error);
  process.exit(1);
});

// Card rendering is stateless per call, so a stray rejection is logged and
// survived rather than taking down every other tool with it.
process.on("unhandledRejection", (reason) => {
  console.error("mcp-chat-cards unhandled rejection (continuing):", reason);
});

process.on("exit", (code) => {
  console.error(`mcp-chat-cards exiting with code ${code}`);
});

async function main(): Promise<void> {
  // Diagnostics ride on stderr next to the lifecycle lines above, so the
  // host's per-server log shows whether it ever read the card template.
  const server = createServer({ diagnostics: (line) => console.error(line) });
  server.server.onclose = () => {
    console.error("mcp-chat-cards transport closed by host");
  };
  await server.connect(new StdioServerTransport());
  console.error(`mcp-chat-cards ${SERVER_VERSION} ready on stdio`);
}

main().catch((error) => {
  console.error("mcp-chat-cards failed to start:", error);
  process.exit(1);
});
