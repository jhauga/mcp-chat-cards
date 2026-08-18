import { describe, expect, it } from "vitest";
import { parse } from "node-html-parser";
import { markdownToCardHtml } from "../src/util/markdown.js";
import { buildMarkdownCard } from "../src/cards/doc.js";
import { buildCodeTourCard } from "../src/cards/code-tour.js";

const SAMPLE = `# Sample Guide

Intro paragraph with \`inline code\`.

## Getting started

| Step | Command |
| ---- | ------- |
| 1 | run it |

\`\`\`bash
cargo run
\`\`\`

## Going further

- point one
- point two
`;

describe("markdownToCardHtml", () => {
  const result = markdownToCardHtml(SAMPLE);

  it("extracts the H1 as title and removes it from the body", () => {
    expect(result.title).toBe("Sample Guide");
    expect(result.bodyHtml).not.toContain("<h1");
  });

  it("folds H2 sections into reveals with controls", () => {
    expect(result.sectionCount).toBe(2);
    expect(result.bodyHtml).toContain('data-mcc-expand="all"');
    expect(result.bodyHtml).toContain("<summary>Getting started</summary>");
    expect(result.bodyHtml).toContain('<details class="mcc-reveal" open>');
  });

  it("restyles tables and code blocks for cards", () => {
    expect(result.bodyHtml).toContain('class="mcc-table"');
    expect(result.bodyHtml).toContain("mcc-table-scroll");
    expect(result.bodyHtml).toContain("mcc-copy-code");
    expect(result.bodyHtml).toContain("cargo run");
  });

  // Policy: raw HTML in markdown is not supported. It renders as literal
  // text, which is what every other card does with a non-html field, so the
  // same string is no longer safe in one card and live in another.
  it("renders raw html as literal text instead of live markup", () => {
    const dirty = markdownToCardHtml('Safe.\n\n<script>alert("x")</script>\n\n<p onclick="x()">para</p>');
    expect(dirty.bodyHtml).not.toContain("<script");
    expect(dirty.bodyHtml).not.toContain("<p onclick");
    expect(dirty.bodyHtml).toContain("&lt;script&gt;");
    expect(dirty.bodyHtml).toContain("&lt;p onclick=&quot;x()&quot;&gt;para&lt;/p&gt;");
  });

  // The structural half of the raw-HTML report: escaping made the content
  // inert but left it as a bare text node between two <p> siblings, so it
  // inherited no margin or line-height and collided with its neighbours.
  it("wraps escaped block html in the block element the markdown implies", () => {
    const out = markdownToCardHtml(
      "A user submits this as their bio:\n\n" +
        '<div class="user-bio">Hi <b>everyone</b></div>\n\n' +
        "If that text reaches the page unescaped, the browser does not see text.",
    );
    expect(out.bodyHtml).toContain(
      "<p>&lt;div class=&quot;user-bio&quot;&gt;Hi &lt;b&gt;everyone&lt;/b&gt;&lt;/div&gt;</p>",
    );

    // No loose text between block elements anywhere in the body.
    const root = parse(out.bodyHtml);
    for (const node of root.childNodes) {
      if (node.nodeType === 3) expect(node.rawText.trim()).toBe("");
    }
  });

  it("keeps multi-line block html together in one paragraph", () => {
    const out = markdownToCardHtml("Intro.\n\n<table>\n<tr><td>a</td></tr>\n</table>\n");
    expect(out.bodyHtml).toContain("<p>&lt;table&gt;<br>&lt;tr&gt;&lt;td&gt;a&lt;/td&gt;&lt;/tr&gt;<br>&lt;/table&gt;</p>");
  });

  // Escaping a comment would turn an invisible tooling directive into visible
  // prose, which is not what the author wrote it for.
  it("drops html comments rather than showing them as text", () => {
    const out = markdownToCardHtml("Intro.\n\n<!-- markdownlint-disable MD024 -->\n\nOutro.");
    expect(out.bodyHtml).not.toContain("markdownlint");
    expect(out.bodyHtml).toContain("<p>Intro.</p>");
    expect(out.bodyHtml).toContain("<p>Outro.</p>");
  });

  it("keeps a raw tag in prose inside its paragraph", () => {
    // The regression: a live <div> closed the enclosing <p>, so the trailing
    // prose rendered outside the paragraph it was written in.
    const out = markdownToCardHtml(
      'Raw tag in prose: <div class="probe">inline html</div> and a self-closer <br/>.',
    );
    expect(out.bodyHtml).not.toContain('<div class="probe">');
    expect(out.bodyHtml).toContain("&lt;div class=&quot;probe&quot;&gt;");
    expect(out.bodyHtml).toContain("and a self-closer &lt;br/&gt;.</p>");
    expect(out.bodyHtml.match(/<p>/g)).toHaveLength(1);
  });

  it("escapes a caller's entity once in prose and table cells, and not at all twice in code", () => {
    const out = markdownToCardHtml(
      "Prose &amp; more.\n\n| Head &amp; |\n| --- |\n| &amp; |\n| &lt;div&gt; |\n\n" +
        "Inline `&amp;` span.\n\n```\nfenced &amp; code\n```\n",
    );
    // Prose and table cells no longer decode a level on the way through.
    expect(out.bodyHtml).toContain("Prose &amp;amp; more.");
    expect(out.bodyHtml).toContain("<th>Head &amp;amp;</th>");
    expect(out.bodyHtml).toContain("<td>&amp;amp;</td>");
    expect(out.bodyHtml).toContain("<td>&amp;lt;div&amp;gt;</td>");
    // Code spans and fences already preserved it; they must not regress.
    expect(out.bodyHtml).toContain("<code>&amp;amp;</code>");
    expect(out.bodyHtml).toContain("fenced &amp;amp; code");
  });

  it("escapes link titles and image alt text like the prose around them", () => {
    const out = markdownToCardHtml(
      '![alt &amp; caption](https://example.com/a.png "title &amp;")\n\n' +
        "[label &amp;](https://example.com)\n\n[bad](javascript:alert(1))",
    );
    expect(out.bodyHtml).toContain('alt="alt &amp;amp; caption"');
    expect(out.bodyHtml).toContain('title="title &amp;amp;"');
    expect(out.bodyHtml).toContain(">label &amp;amp;</a>");
    // Unsafe schemes are still dropped from url-bearing attributes.
    expect(out.bodyHtml).not.toContain("javascript:");
  });

  it("can render without section folding", () => {
    const flat = markdownToCardHtml(SAMPLE, { splitSections: false });
    expect(flat.bodyHtml).not.toContain("mcc-reveal");
    expect(flat.bodyHtml).toContain("<h2");
  });
});

describe("buildMarkdownCard", () => {
  it("uses the document H1 as the card title", () => {
    const card = buildMarkdownCard({ markdown: SAMPLE });
    expect(card.html).toContain("<h1>Sample Guide</h1>");
    expect(card.config.kind).toBe("document");
    expect(card.summary).toContain("2 collapsible section(s)");
  });
});

describe("buildCodeTourCard", () => {
  it("orders files and renders one code tab per file", () => {
    const card = buildCodeTourCard({
      title: "Sample project tour",
      intro: "Start with the manifest, then read main.",
      files: [
        { path: "src/main.rs", content: "fn main() {}" },
        { path: "README.md", content: "# Sample" },
        { path: "Cargo.toml", content: "[package]" },
      ],
    });
    expect(card.html).toContain("Start here");
    const readmeIndex = card.html.indexOf(">README.md<");
    const mainIndex = card.html.indexOf(">src/main.rs<");
    expect(readmeIndex).toBeGreaterThan(-1);
    expect(mainIndex).toBeGreaterThan(readmeIndex);
    expect(card.html).toContain('class="language-rust"');
    expect(card.summary).toContain("README.md, Cargo.toml, src/main.rs");
  });

  it("splits into parts when the tab cap is exceeded", () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      path: `src/file${i}.rs`,
      content: `// file ${i}`,
    }));
    const card = buildCodeTourCard({ title: "Big tour", files, maxTabs: 3 });
    expect(card.summary).toContain("part 1 of 2");
    expect(card.summary).toContain("call create_code_tour_card again with part: 2");
  });
});
