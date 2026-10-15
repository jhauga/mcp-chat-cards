#!/usr/bin/env node
// Streamable HTTP entry point. Lets this server be reached as a remote
// ("custom") connector: the chat client's cloud connects to a public URL, so
// this process is meant to sit behind a tunnel on the machine that runs it.
// Everything is gated by one bearer token, the listener binds to loopback,
// and a missing token refuses to start rather than opening tools that can
// read local files to whoever finds the URL.
//
//   MCP_CHAT_CARDS_HTTP_TOKEN   required; clients send it as
//                               "Authorization: Bearer <token>"
//   MCP_CHAT_CARDS_HTTP_PORT    default 3310
//   MCP_CHAT_CARDS_HTTP_HOST    default 127.0.0.1
//   MCP_CHAT_CARDS_FS_ROOT      confine local file reads (see util/files.ts)
//
// One MCP session per client session: the first POST must be an initialize
// request, which opens a session whose id travels in the mcp-session-id
// header on every later request, as the Streamable HTTP transport specifies.
import { createServer as createNodeServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer, SERVER_VERSION } from "./server.js";

export const DEFAULT_HTTP_PORT = 3310;
export const DEFAULT_HTTP_HOST = "127.0.0.1";
export const HTTP_PATH = "/mcp";
export const MIN_TOKEN_LENGTH = 16;

// A JSON-RPC request is small, and nothing a client sends legitimately comes
// near this; the cap only keeps a stray upload from being buffered whole.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface HttpServerOptions {
  token: string;
  host?: string;
  port?: number;
  path?: string;
  diagnostics?: (line: string) => void;
}

export interface RunningHttpServer {
  url: string;
  host: string;
  port: number;
  sessionCount(): number;
  close(): Promise<void>;
}

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

class BodyTooLargeError extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLargeError());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(res: ServerResponse, status: number, code: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null });
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

// Constant-time comparison, so a wrong token costs the same whether it is
// wrong in the first character or the last.
export function bearerMatches(header: string | undefined, token: string): boolean {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return false;
  const given = Buffer.from(match[1], "utf8");
  const expected = Buffer.from(token, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function startHttpServer(options: HttpServerOptions): Promise<RunningHttpServer> {
  const token = options.token.trim();
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`The bearer token must be at least ${MIN_TOKEN_LENGTH} characters.`);
  }
  const host = options.host ?? DEFAULT_HTTP_HOST;
  const path = options.path ?? HTTP_PATH;
  const diag = options.diagnostics ?? (() => undefined);
  const sessions = new Map<string, Session>();

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== path) {
      rpcError(res, 404, -32000, "Not found");
      return;
    }
    if (!bearerMatches(req.headers.authorization, token)) {
      diag(
        `mcp-chat-cards http: rejected ${req.method ?? "?"} from ` +
          `${req.socket.remoteAddress ?? "?"} (missing or wrong bearer token)`,
      );
      sendJson(
        res,
        401,
        { jsonrpc: "2.0", error: { code: -32000, message: "Unauthorized" }, id: null },
        { "www-authenticate": "Bearer" },
      );
      return;
    }

    let parsedBody: unknown;
    if (req.method === "POST") {
      let raw: string;
      try {
        raw = await readBody(req);
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          rpcError(res, 413, -32000, "Request body too large");
          return;
        }
        throw error;
      }
      try {
        parsedBody = JSON.parse(raw);
      } catch {
        rpcError(res, 400, -32700, "Parse error: the request body is not JSON");
        return;
      }
    }

    const sessionId = headerValue(req, "mcp-session-id");
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        rpcError(res, 404, -32001, "Session not found; send a new initialize request");
        return;
      }
      await session.transport.handleRequest(req, res, parsedBody);
      return;
    }
    if (req.method !== "POST" || !isInitializeRequest(parsedBody)) {
      rpcError(res, 400, -32000, "Bad request: no session; send an initialize request first");
      return;
    }

    // A fresh server per session keeps the recent-card cache and the client
    // capabilities (which decide whether the standalone-HTML link is sent)
    // scoped to the client that produced them.
    const server = createServer({ diagnostics: diag });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      // The SDK's rebinding check compares the Host header with an allowlist.
      // Behind a tunnel that header is the tunnel's hostname, and the bearer
      // token is the gate here, so the check stays off (the SDK deprecates it
      // in favour of external middleware in any case).
      enableDnsRebindingProtection: false,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server });
        diag(`mcp-chat-cards http: session ${id} opened (${sessions.size} open)`);
      },
      onsessionclosed: (id) => {
        if (sessions.delete(id)) {
          diag(`mcp-chat-cards http: session ${id} closed by client (${sessions.size} open)`);
        }
      },
    });
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id && sessions.delete(id)) {
        diag(`mcp-chat-cards http: session ${id} dropped (${sessions.size} open)`);
      }
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  };

  const httpServer = createNodeServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      diag(`mcp-chat-cards http: request failed: ${String(error)}`);
      if (!res.headersSent) rpcError(res, 500, -32603, "Internal error");
      else res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(options.port ?? DEFAULT_HTTP_PORT, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  const address = httpServer.address();
  const port =
    typeof address === "object" && address ? address.port : (options.port ?? DEFAULT_HTTP_PORT);

  return {
    url: `http://${host}:${port}${path}`,
    host,
    port,
    sessionCount: () => sessions.size,
    close: async () => {
      for (const session of sessions.values()) {
        await session.transport.close().catch(() => undefined);
        await session.server.close().catch(() => undefined);
      }
      sessions.clear();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeAllConnections();
      });
    },
  };
}

function optionsFromEnv(): HttpServerOptions {
  const token = (process.env.MCP_CHAT_CARDS_HTTP_TOKEN ?? "").trim();
  if (!token) {
    throw new Error(
      "MCP_CHAT_CARDS_HTTP_TOKEN is not set. Refusing to listen without a bearer token, " +
        "because this entry point is meant to be reachable from the internet through a tunnel.",
    );
  }
  const rawPort = (process.env.MCP_CHAT_CARDS_HTTP_PORT ?? "").trim();
  const port = rawPort === "" ? DEFAULT_HTTP_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`MCP_CHAT_CARDS_HTTP_PORT must be a port number, got "${rawPort}".`);
  }
  const host = (process.env.MCP_CHAT_CARDS_HTTP_HOST ?? "").trim() || DEFAULT_HTTP_HOST;
  return { token, port, host, diagnostics: (line) => console.error(line) };
}

async function main(): Promise<void> {
  const running = await startHttpServer(optionsFromEnv());
  const root = (process.env.MCP_CHAT_CARDS_FS_ROOT ?? "").trim();
  console.error(
    `mcp-chat-cards ${SERVER_VERSION} listening on ${running.url} ` +
      `(bearer token: set, local file root: ${root || "unrestricted"})`,
  );
  const stop = (): void => {
    running.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

const invokedDirectly =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(
      `mcp-chat-cards http failed to start: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
