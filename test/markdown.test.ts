import { describe, expect, it } from "vitest";
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

  it("sanitizes scripts out of markdown-embedded html", () => {
    const dirty = markdownToCardHtml('Safe.\n\n<script>alert("x")</script>\n\n<p onclick="x()">para</p>');
    expect(dirty.bodyHtml).not.toContain("<script");
    expect(dirty.bodyHtml).not.toContain("onclick");
    expect(dirty.bodyHtml).toContain("para");
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
