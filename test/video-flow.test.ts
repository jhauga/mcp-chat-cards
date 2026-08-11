// Regression cover for the video card, driven through the same path the host
// uses: the MCP Apps template receives a tool result and injects
// card.articleHtml into its own template rather than loading the standalone
// document. A <video> that survives the standalone renderer but not this path
// is exactly the failure this file exists to catch.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildCardTemplateHtml } from "../src/cards/app-template.js";
import { CARD_CSP, CARD_TEMPLATE_CSP } from "../src/cards/shell.js";
import { buildVideoCard } from "../src/cards/video.js";
import { sanitizeHtml } from "../src/util/html.js";

const CLIP = "https://example.com/clip.mp4";
const INLINE_CLIP = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28y";

function tick(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mounts the template, plays the host side of the handshake, and delivers the
// card exactly as server.ts ships it in structuredContent.
async function renderThroughTemplate(articleHtml: string, config: unknown) {
  const dom = new JSDOM(buildCardTemplateHtml("0.0.0-test"), {
    runScripts: "dangerously",
    url: "https://cards.invalid/",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  window.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: { card: { articleHtml, config } } },
    },
    "*",
  );
  await tick();
  return window;
}

describe("video card through the MCP Apps template", () => {
  it("keeps a playable <video> with its source after injection", async () => {
    const card = buildVideoCard({
      title: "Sample clip",
      src: CLIP,
      poster: "https://example.com/poster.jpg",
    });
    const window = await renderThroughTemplate(card.articleHtml, card.config);
    const video = window.document.querySelector("video") as HTMLVideoElement;

    expect(video).not.toBeNull();
    expect(video.getAttribute("src")).toBe(CLIP);
    expect(video.querySelector("source")?.getAttribute("src")).toBe(CLIP);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("poster")).toBe("https://example.com/poster.jpg");
    expect(window.document.getElementById("mcc-config")?.textContent).toContain('"kind":"video"');
  });

  it("renders an inline data:video clip through the same path", async () => {
    const card = buildVideoCard({ title: "Inline clip", src: INLINE_CLIP, autoplay: true });
    const window = await renderThroughTemplate(card.articleHtml, card.config);
    const video = window.document.querySelector("video") as HTMLVideoElement;

    expect(video).not.toBeNull();
    expect(video.getAttribute("src")).toBe(INLINE_CLIP);
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
  });

  it("ships the video sizing rules in the template, not only the standalone doc", async () => {
    const template = buildCardTemplateHtml("0.0.0-test");
    expect(template).toContain(".mcc-video-frame");
    expect(template).toContain(".mcc-video video");
    expect(template).toContain("aspect-ratio: 16 / 9");
  });

  it("applies a CSP that lets media load in both render paths", () => {
    for (const csp of [CARD_CSP, CARD_TEMPLATE_CSP]) {
      const media = /media-src ([^;]+)/.exec(csp)?.[1] ?? "";
      expect(media).toContain("https:");
      expect(media).toContain("data:");
      expect(media).toContain("blob:");
    }
    expect(buildCardTemplateHtml("0.0.0-test")).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${CARD_TEMPLATE_CSP}">`,
    );
  });

  it("explains itself instead of leaving a gap when a host strips the player", async () => {
    const card = buildVideoCard({ title: "Sample clip", src: CLIP });
    // Stand in for a host allowlist that keeps the block but drops media tags.
    const stripped = card.articleHtml.replace(/<video[\s\S]*?<\/video>/, "");
    const window = await renderThroughTemplate(stripped, card.config);

    expect(window.document.querySelector("video")).toBeNull();
    expect(window.document.querySelector(".mcc-video-note")?.textContent).toContain(
      "removed the embedded video player",
    );
    expect(window.document.querySelector(".mcc-video-fallback a")?.getAttribute("href")).toBe(CLIP);
  });
});

describe("video markup under sanitizeHtml", () => {
  it("keeps media elements and their attributes", () => {
    const card = buildVideoCard({
      title: "Sample clip",
      src: CLIP,
      poster: "https://example.com/poster.jpg",
      loop: true,
      muted: true,
    });
    const clean = sanitizeHtml(card.articleHtml);
    expect(clean).toContain("<video");
    expect(clean).toContain("<source");
    expect(clean).toContain(`src="${CLIP}"`);
    expect(clean).toContain('poster="https://example.com/poster.jpg"');
    expect(clean).toContain("controls");
    expect(clean).toContain("loop");
    expect(clean).toContain("muted");
  });

  it("keeps an inline media source but still drops an active one", () => {
    expect(sanitizeHtml(`<video src="${INLINE_CLIP}"></video>`)).toContain(INLINE_CLIP);
    expect(sanitizeHtml('<video src="data:text/html;base64,PHNjcmlwdD4="></video>')).not.toContain(
      "data:text/html",
    );
    expect(sanitizeHtml('<video src="javascript:alert(1)"></video>')).not.toContain("javascript:");
  });
});
