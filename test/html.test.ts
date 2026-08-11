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

  it("does not re-escape text that already carries an entity", () => {
    expect(escapeHtml("Predict, Spot &amp; Fix")).toBe("Predict, Spot &amp; Fix");
    expect(escapeHtml("&lt;tag&gt; and &#39;quote&#39; and &#x27;hex&#x27;")).toBe(
      "&lt;tag&gt; and &#39;quote&#39; and &#x27;hex&#x27;",
    );
  });

  it("still escapes a bare ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("AT&T")).toBe("AT&amp;T");
    expect(escapeHtml("a & b &amp; c")).toBe("a &amp; b &amp; c");
  });

  it("escapes markup characters even when the input is pre-escaped elsewhere", () => {
    // The safety property that lets the entity pass-through above be safe:
    // nothing a caller sends can reopen a tag or break out of an attribute.
    expect(escapeHtml('&amp;<script>alert("x")</script>')).toBe(
      "&amp;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
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
    const out = wrapTermsInHtml("<p>x x x x x</p>", [{ term: "x" }], { maxPerTerm: 2 });
    expect(out.match(/mcc-term/g)).toHaveLength(2);
  });

  it("highlights a term once per card by default", () => {
    const out = wrapTermsInHtml("<p>trait and trait and trait</p>", [{ term: "trait" }]);
    expect(out.match(/mcc-term/g)).toHaveLength(1);
  });

  it("never writes a term into another term's tip attribute", () => {
    // The regression: "clap" is wrapped first, and its tip mentions "crate",
    // so a second pass over the emitted markup used to nest a span inside the
    // data-tip value.
    const out = wrapTermsInHtml("<p>clap parses args</p>", [
      { term: "clap", tip: "The standard Rust crate for parsing arguments" },
      { term: "crate", tip: "A Rust package" },
    ]);
    expect(out).toContain('data-tip="The standard Rust crate for parsing arguments"');
    // One wrapper, and nothing injected inside its tip.
    expect(out.match(/<span/g)).toHaveLength(1);
    for (const [, tip] of out.matchAll(/data-tip="([^"]*)"/g)) {
      expect(tip).not.toContain("mcc-term");
    }
  });

  it("leaves SVG title tooltips as plain text", () => {
    const svg = '<svg><rect><title>Rust · Memory safety: 5</title></rect><text>Memory safety</text></svg>';
    const out = wrapTermsInHtml(svg, [{ term: "Memory safety", tip: "No data races" }]);
    expect(out).toContain("<title>Rust · Memory safety: 5</title>");
    expect(out).toContain('<text><span class="mcc-term" data-tip="No data races">Memory safety</span></text>');
  });

  it("skips script and style text", () => {
    const html = "<style>.term { color: red }</style><script>var term = 1;</script><p>term</p>";
    const out = wrapTermsInHtml(html, [{ term: "term" }]);
    expect(out).toContain("<style>.term { color: red }</style>");
    expect(out).toContain("<script>var term = 1;</script>");
    expect(out).toContain('<p><span class="mcc-term" data-tip="">term</span></p>');
  });

  it("skips code samples unless asked", () => {
    const html = "<pre><code>let owner = 1;</code></pre><p>owner</p>";
    const terms = [{ term: "owner", tip: "Who frees the value" }];
    expect(wrapTermsInHtml(html, terms)).toContain("<code>let owner = 1;</code>");
    const opted = wrapTermsInHtml(html, terms, { includeCode: true, maxPerTerm: 2 });
    expect(opted).toContain('<code>let <span class="mcc-term"');
  });

  it("de-duplicates repeated terms and prefers the longest match", () => {
    const out = wrapTermsInHtml("<p>memory safety matters</p>", [
      { term: "memory", tip: "RAM" },
      { term: "memory safety", tip: "No data races" },
      { term: "Memory", tip: "duplicate" },
    ]);
    expect(out).toContain('data-tip="No data races">memory safety</span>');
    expect(out).not.toContain('data-tip="RAM"');
  });

  it("caps the total number of highlights in one card", () => {
    const terms = Array.from({ length: 10 }, (_, i) => ({ term: `t${i}` }));
    const html = `<p>${terms.map((t) => t.term).join(" ")}</p>`;
    expect(wrapTermsInHtml(html, terms, { maxTotal: 3 }).match(/mcc-term/g)).toHaveLength(3);
  });

  it("matches terms against the escaped text the card actually contains", () => {
    const out = wrapTermsInHtml(`<p>${escapeHtml("R&D budget")}</p>`, [
      { term: "R&D", tip: "Research and development" },
    ]);
    expect(out).toContain('data-tip="Research and development">R&amp;D</span>');
  });
});

describe("looksLikeUrl", () => {
  it("accepts http(s) urls and rejects other text", () => {
    expect(looksLikeUrl("https://example.com/page")).toBe(true);
    expect(looksLikeUrl("ftp://example.com")).toBe(false);
    expect(looksLikeUrl("plain text")).toBe(false);
  });
});
