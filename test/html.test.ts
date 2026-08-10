import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  looksLikeUrl,
  sanitizeHtml,
  textToParagraphs,
  wrapTermsInHtml,
} from "../src/util/html.js";

describe("escapeHtml", () => {
  it("escapes all special characters", () => {
    expect(escapeHtml(`<a href="x" data-y='z'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data-y=&#39;z&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("stringifies null and undefined to empty", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert("x")</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
  });

  it("removes event handler attributes", () => {
    const out = sanitizeHtml('<img src="https://example.com/a.png" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).toContain("https://example.com/a.png");
  });

  it("removes javascript: urls but keeps safe links", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://example.com"');
  });

  it("removes embedded forms and iframes", () => {
    const out = sanitizeHtml('<div><form action="/x"><input name="a"></form><iframe src="https://example.com"></iframe>keep</div>');
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<iframe");
    expect(out).toContain("keep");
  });
});

describe("textToParagraphs", () => {
  it("splits blank-line blocks into paragraphs and escapes content", () => {
    const out = textToParagraphs("first <b>\n\nsecond");
    expect(out).toBe("<p>first &lt;b&gt;</p>\n<p>second</p>");
  });

  it("turns single newlines into line breaks", () => {
    expect(textToParagraphs("a\nb")).toBe("<p>a<br>b</p>");
  });
});

describe("wrapTermsInHtml", () => {
  it("wraps a term found in text but not inside tags", () => {
    const html = '<p class="kerning">kerning is spacing</p>';
    const out = wrapTermsInHtml(html, [{ term: "kerning", tip: "Letter spacing" }]);
    expect(out).toContain('<span class="mcc-term" data-tip="Letter spacing">kerning</span> is spacing');
    expect(out).toContain('class="kerning"');
  });

  it("limits occurrences per term", () => {
    const out = wrapTermsInHtml("<p>x x x x x</p>", [{ term: "x" }], 2);
    expect(out.match(/mcc-term/g)).toHaveLength(2);
  });
});

describe("looksLikeUrl", () => {
  it("accepts http(s) urls and rejects other text", () => {
    expect(looksLikeUrl("https://example.com/page")).toBe(true);
    expect(looksLikeUrl("ftp://example.com")).toBe(false);
    expect(looksLikeUrl("plain text")).toBe(false);
  });
});
