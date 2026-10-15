// Outbound HTTP with guardrails: http(s) only, public addresses only (SSRF
// guard), manual redirect handling with re-validation, response size cap,
// and timeouts. Private-network access can be enabled explicitly for
// intranet use via options or MCP_CHAT_CARDS_ALLOW_PRIVATE=1.
import { lookup } from "node:dns/promises";
import net from "node:net";

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowPrivateNetworks?: boolean;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
  truncated: boolean;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = "mcp-chat-cards/1.0.0-alpha.1.0.1 (+https://github.com/jhauga/mcp-chat-cards)";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  );
}

function allowPrivateByEnv(): boolean {
  return process.env.MCP_CHAT_CARDS_ALLOW_PRIVATE === "1";
}

// Validate that a URL is http(s) and does not point at a private or
// loopback address. Resolves DNS so hostname tricks are also caught.
export async function assertPublicHttpUrl(urlString: string, allowPrivate = false): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new FetchError(`Invalid URL: ${urlString}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError(`Only http(s) URLs are allowed, got: ${url.protocol}`);
  }
  if (allowPrivate || allowPrivateByEnv()) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new FetchError(`Blocked host: ${hostname}`);
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new FetchError(`Blocked private address: ${hostname}`);
    return url;
  }
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new FetchError(`DNS lookup failed for: ${hostname}`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new FetchError(`Blocked: ${hostname} resolves to private address ${address}`);
    }
  }
  return url;
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { body: "", truncated: false };
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      chunks.push(value.subarray(0, value.length - (received - maxBytes)));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { body: Buffer.concat(chunks).toString("utf8"), truncated };
}

export async function safeFetch(urlString: string, options: SafeFetchOptions = {}): Promise<FetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowPrivate = options.allowPrivateNetworks ?? false;

  let currentUrl = urlString;
  let method = (options.method ?? "GET").toUpperCase();
  let body = options.body;

  for (let redirects = 0; ; redirects++) {
    const url = await assertPublicHttpUrl(currentUrl, allowPrivate);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          ...(body !== undefined ? { "content-type": "application/x-www-form-urlencoded" } : {}),
          ...options.headers,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new FetchError(`Request to ${currentUrl} failed: ${reason}`);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      // Drain the redirect body so the connection can be reused.
      await response.arrayBuffer().catch(() => undefined);
      if (!location) {
        return {
          url: urlString,
          finalUrl: currentUrl,
          status: response.status,
          ok: false,
          contentType: response.headers.get("content-type") ?? "",
          body: "",
          truncated: false,
        };
      }
      if (redirects >= maxRedirects) {
        throw new FetchError(`Too many redirects fetching ${urlString}`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      // Standard browser behavior: redirects after POST become GET.
      if (method !== "GET" && method !== "HEAD") {
        method = "GET";
        body = undefined;
      }
      continue;
    }

    const { body: text, truncated } = await readBodyCapped(response, maxBytes);
    return {
      url: urlString,
      finalUrl: currentUrl,
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      contentType: response.headers.get("content-type") ?? "",
      body: text,
      truncated,
    };
  }
}
