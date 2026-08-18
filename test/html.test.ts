import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  looksLikeUrl,
  renderCodeBlock,
  sanitizeHtml,
  textToBlocks,
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

  // Input is literal text, never decoded first. A caller writing about HTML
  // passes "&amp;" because the reader should SEE "&amp;", so the entity's own
  // ampersand is escaped like any other character.
  it("escapes a pre-escaped entity a second time so it displays literally", () => {
    expect(escapeHtml("Predict, Spot &amp; Fix")).toBe("Predict, Spot &amp;amp; Fix");
    expect(escapeHtml("&lt;tag&gt; and &#39;quote&#39;")).toBe(
      "&amp;lt;tag&amp;gt; and &amp;#39;quote&amp;#39;",
    );
  });

  it("escapes a bare ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("AT&T")).toBe("AT&amp;T");
    expect(escapeHtml("a & b &amp; c")).toBe("a &amp; b &amp;amp; c");
  });

  it("escapes exactly once, never twice, for raw markup characters", () => {
    expect(escapeHtml('&amp;<script>alert("x")</script>')).toBe(
      "&amp;amp;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
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

describe("renderCodeBlock", () => {
  it("renders a copy button over an escaped code block", () => {
    const out = renderCodeBlock('let x = "<a>" & 1;', "rust");
    expect(out).toContain("mcc-copy-code");
    expect(out).toContain('<code class="language-rust">');
    expect(out).toContain("let x = &quot;&lt;a&gt;&quot; &amp; 1;");
  });

  it("defaults the language to text", () => {
    expect(renderCodeBlock("x")).toContain('class="language-text"');
  });
});

describe("textToBlocks", () => {
  it("turns fenced runs into code blocks and keeps their indentation", () => {
    const out = textToBlocks(
      "Add a bool field:\n\n```rust\n#[arg(long)]\n    quiet: bool,\n```\n\nWhy it works: clap reads it.",
    );
    expect(out).toContain("<p>Add a bool field:</p>");
    expect(out).toContain('<code class="language-rust">');
    expect(out).toContain("#[arg(long)]\n    quiet: bool,");
    expect(out).toContain("mcc-copy-code");
    expect(out).toContain("<p>Why it works: clap reads it.</p>");
  });

  it("closes an unterminated fence at the end of the text", () => {
    const out = textToBlocks("Intro.\n\n```\nstill code");
    expect(out).toContain("<p>Intro.</p>");
    expect(out).toContain("<pre><code");
    expect(out).toContain("still code");
  });

  it("matches textToParagraphs when there is no fence", () => {
    expect(textToBlocks("a\n\nb")).toBe(textToParagraphs("a\n\nb"));
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

  // The regression: a lowercase "path" earlier in the document swallowed the
  // tip meant for the shell's PATH, and glossed a filesystem path with it.
  it("matches terms case-sensitively by default", () => {
    const html = "<p>Take an optional path; fall back to stdin.</p><p>drops it on your PATH</p>";
    const out = wrapTermsInHtml(html, [{ term: "PATH", tip: "The directories your shell searches" }]);
    expect(out).toContain('<span class="mcc-term" data-tip="The directories your shell searches">PATH</span>');
    expect(out).toContain("an optional path;");
    expect(out.match(/mcc-term/g)).toHaveLength(1);
  });

  // The adversarial ordering that regresses: the lowercase verbs appear
  // EARLIER in the document than the capitalized trait names, so a
  // case-insensitive scan claims them first and glosses the wrong word.
  it("prefers the exact-case match later in the document over a lowercase one earlier", () => {
    const html =
      "<p>You can copy a handle and drop it when finished.</p>" +
      "<p>Types implementing Copy are duplicated bitwise; Drop runs cleanup.</p>";
    const out = wrapTermsInHtml(html, [
      { term: "Copy", tip: "Bitwise-duplicable types" },
      { term: "Drop", tip: "Runs cleanup when a value goes out of scope" },
    ]);
    expect(out).toContain('<span class="mcc-term" data-tip="Bitwise-duplicable types">Copy</span>');
    expect(out).toContain(
      '<span class="mcc-term" data-tip="Runs cleanup when a value goes out of scope">Drop</span>',
    );
    // The earlier lowercase verbs are left alone.
    expect(out).toContain("You can copy a handle and drop it when finished.");
    expect(out.match(/mcc-term/g)).toHaveLength(2);
  });

  it("matches a capitalized heading from a lowercase term when opted in", () => {
    const out = wrapTermsInHtml("<h2>Ownership</h2><p>and more</p>", [
      { term: "ownership", tip: "Who frees the value", caseInsensitive: true },
    ]);
    expect(out).toContain('data-tip="Who frees the value">Ownership</span>');
  });

  it("matches any casing when a term opts in", () => {
    const out = wrapTermsInHtml("<p>an optional path here</p>", [
      { term: "PATH", tip: "Any casing", caseInsensitive: true },
    ]);
    expect(out).toContain('data-tip="Any casing">path</span>');
  });

  it("keeps a case-sensitive term and its any-case twin on separate budgets", () => {
    const out = wrapTermsInHtml("<p>path then PATH</p>", [
      { term: "PATH", tip: "Shell search list" },
      { term: "path", tip: "Filesystem location" },
    ]);
    expect(out).toContain('data-tip="Filesystem location">path</span>');
    expect(out).toContain('data-tip="Shell search list">PATH</span>');
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
