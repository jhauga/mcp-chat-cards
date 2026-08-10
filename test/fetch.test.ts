import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isPrivateIp, safeFetch } from "../src/fetcher/fetch.js";

describe("isPrivateIp", () => {
  it("flags loopback, rfc1918, link-local, and cgnat ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.9.9", "100.64.0.1", "::1", "fe80::1", "fd00::1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("passes public addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:2800:220:1:248:1893:25c8:1946"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http protocols", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(/http/);
    await expect(assertPublicHttpUrl("ftp://example.com")).rejects.toThrow(/http/);
  });

  it("rejects localhost and private ip literals", async () => {
    await expect(assertPublicHttpUrl("http://localhost:8080/")).rejects.toThrow(/Blocked/);
    await expect(assertPublicHttpUrl("http://127.0.0.1/")).rejects.toThrow(/Blocked/);
    await expect(assertPublicHttpUrl("http://192.168.0.10/admin")).rejects.toThrow(/Blocked/);
    await expect(assertPublicHttpUrl("http://intranet.local/")).rejects.toThrow(/Blocked/);
  });

  it("accepts public ip literals without dns", async () => {
    const url = await assertPublicHttpUrl("http://93.184.216.34/page");
    expect(url.hostname).toBe("93.184.216.34");
  });

  it("skips checks when private networks are allowed", async () => {
    const url = await assertPublicHttpUrl("http://127.0.0.1:9999/", true);
    expect(url.port).toBe("9999");
  });
});

describe("safeFetch against a local server", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "/target" });
        res.end();
        return;
      }
      if (req.url === "/big") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("x".repeat(10_000));
        return;
      }
      if (req.url === "/echo" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          res.writeHead(200, { "content-type": "text/plain" });
          res.end(`received:${body}`);
        });
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>target page</body></html>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("is blocked by default for loopback targets", async () => {
    await expect(safeFetch(`${base}/`)).rejects.toThrow(/Blocked/);
  });

  it("fetches and follows redirects when private access is allowed", async () => {
    const result = await safeFetch(`${base}/redirect`, { allowPrivateNetworks: true });
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(`${base}/target`);
    expect(result.body).toContain("target page");
  });

  it("caps the body size and reports truncation", async () => {
    const result = await safeFetch(`${base}/big`, { allowPrivateNetworks: true, maxBytes: 1000 });
    expect(result.truncated).toBe(true);
    expect(result.body.length).toBe(1000);
  });

  it("posts form-encoded bodies", async () => {
    const result = await safeFetch(`${base}/echo`, {
      allowPrivateNetworks: true,
      method: "POST",
      body: "a=1&b=2",
    });
    expect(result.body).toBe("received:a=1&b=2");
  });
});
