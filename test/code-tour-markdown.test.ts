// Markdown files in a code tour render as a page with a Raw/Rendered toggle
// instead of a fenced code block. The cases that matter: only .md files change,
// the raw text survives byte for byte, the size budget counts a panel that now
// carries two views of the same file, and raw HTML in the markdown stays inert.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildCodeTourCard,
  isMarkdownFile,
  planTourParts,
  renderedTabCost,
  tabForFile,
} from "../src/cards/code-tour.js";
import { buildMarkdownCard } from "../src/cards/doc.js";
import { escapeHtml } from "../src/util/html.js";

const README = [
  "# Sample App",
  "",
  "A demo tool for **Acme Corp**.",
  "",
  "## Install",
  "",
  "```bash",
  "npm install sample-app",
  "```",
  "",
  "| Flag | Purpose |",
  "| ---- | ------- |",
  "| --fast | Skip checks |",
  "",
  "See the [docs](https://example.com/docs).",
].join("\n");

const PY = "def main():\n    print('hi')\n";

function tourHtml(): string {
  return buildCodeTourCard({
    title: "Sample App tour",
    files: [
      { path: "README.md", content: README },
      { path: "src/main.py", content: PY },
    ],
  }).articleHtml;
}

describe("markdown file detection", () => {
  it("matches markdown extensions regardless of case and nothing else", () => {
    for (const path of ["README.md", "docs/guide.markdown", "a/b/NOTES.MD", "x.mkd", "y.mdx"]) {
      expect(isMarkdownFile(path)).toBe(true);
    }
    for (const path of ["src/main.py", "Makefile", "README", "styles.css", "a.md.bak"]) {
      expect(isMarkdownFile(path)).toBe(false);
    }
  });

  it("gives markdown files a markdown tab and everything else a code tab", () => {
    expect(tabForFile({ path: "README.md", content: README })).toMatchObject({
      label: "README.md",
      markdown: README,
    });
    expect(tabForFile({ path: "src/main.py", content: PY })).toMatchObject({
      label: "src/main.py",
      code: PY,
      language: "python",
    });
  });
});

describe("markdown tab rendering", () => {
  it("ships both views with a Raw/Rendered toggle, Rendered first", () => {
    const html = tourHtml();
    expect(html).toContain('data-mcc-view-set="raw"');
    expect(html).toContain('data-mcc-view-set="rendered"');
    // Rendered is the point of the change, so it is the view on arrival.
    expect(html).toMatch(/data-mcc-pane="raw" hidden/);
    expect(html).not.toMatch(/data-mcc-pane="rendered" hidden/);
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the document as a page: headings, card tables, copyable code", () => {
    const html = tourHtml();
    expect(html).toContain("<h1>Sample App</h1>");
    expect(html).toContain("<h2>Install</h2>");
    expect(html).toContain("mcc-table");
    expect(html).toContain("mcc-copy-code");
    expect(html).toContain('href="https://example.com/docs"');
    // A page, not an outline: file views never fold into show/hide reveals.
    expect(html).not.toContain("mcc-reveal");
  });

  it("keeps the first H1 that the markdown CARD lifts out into its title", () => {
    // The two paths differ deliberately: a card's H1 becomes the card title,
    // but a file view's H1 belongs to the page, as it does anywhere else.
    const card = buildMarkdownCard({ markdown: README });
    expect(card.articleHtml).toContain("<h1>Sample App</h1>");
    expect(card.articleHtml.indexOf("<h1>Sample App</h1>")).toBeLessThan(
      card.articleHtml.indexOf("mcc-body"),
    );
    expect(tourHtml()).toMatch(/data-mcc-pane="rendered"[^>]*><h1>Sample App<\/h1>/);
  });

  it("keeps the raw source intact in the second pane", () => {
    const html = tourHtml();
    const raw = /data-mcc-pane="raw"[\s\S]*?<code class="language-markdown">([\s\S]*?)<\/code>/.exec(html);
    expect(raw).not.toBeNull();
    const decoded = raw![1]
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    expect(decoded).toBe(README);
  });

  it("gives a source file the code file view, not the markdown one", () => {
    const html = tourHtml();
    expect(html).toContain('class="language-python"');
    // Each file gets the view that suits it: one markdown page, one source
    // file. Neither kind gets the other's markup.
    expect(html.match(/mcc-mdfile/g)).toHaveLength(1);
    expect(html.match(/mcc-codefile/g)).toHaveLength(1);
  });

  it("renders an empty markdown file as a note rather than a blank pane", () => {
    const html = buildCodeTourCard({
      title: "Empty",
      files: [{ path: "EMPTY.md", content: "   " }],
    }).articleHtml;
    expect(html).toContain("This file is empty.");
  });
});

describe("markdown tabs and the size budget", () => {
  it("costs a markdown file by its panel, not by its source length", () => {
    const asMarkdown = renderedTabCost({ path: "README.md", content: README });
    // The panel carries the rendered page as well as the source, so counting
    // source alone would under-report it and overfill the card.
    expect(asMarkdown).toBeGreaterThan(escapeHtml(README).length * 1.5);
  });

  it("still costs a file with no grammar by its escaped source", () => {
    // A file the highlighter has no grammar for renders as the plain code
    // block it always did, so its cost is unchanged: escaped source plus the
    // fixed per-tab overhead.
    const plain = { path: "notes.unknownext", content: PY };
    expect(renderedTabCost(plain)).toBe(escapeHtml(PY).length + 400);
  });

  it("splits a tour of markdown files instead of overfilling one card", () => {
    const files = Array.from({ length: 6 }, (_, index) => ({
      path: `docs/guide${index}.md`,
      content: `# Guide ${index}\n\n${"Some prose about the thing. ".repeat(60)}`,
    }));
    const parts = planTourParts(files, 8_000);
    expect(parts.length).toBeGreaterThan(1);
    // Every planned part fits the budget it was planned against.
    for (const part of parts) {
      expect(part.reduce((sum, file) => sum + renderedTabCost(file), 0)).toBeLessThanOrEqual(8_000);
    }
    expect(parts.flat().map((file) => file.path)).toEqual(files.map((file) => file.path));
  });
});

describe("markdown tab in a live card", () => {
  async function mount(markdown: string) {
    const card = buildCodeTourCard({
      title: "Tour",
      files: [{ path: "README.md", content: markdown }, { path: "src/main.py", content: PY }],
    });
    const dom = new JSDOM(card.html, {
      runScripts: "dangerously",
      url: "https://cards.invalid/",
      pretendToBeVisual: true,
    });
    const { window } = dom;
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    const doc = window.document;
    // Scoped to the markdown file's view: the source file in the same tour
    // has a toggle of its own, and an unscoped query would race it.
    const md = doc.querySelector(".mcc-mdfile") as HTMLElement;
    return {
      window,
      doc,
      pane: (view: string) => md.querySelector(`[data-mcc-pane="${view}"]`) as HTMLElement,
      button: (view: string) => md.querySelector(`[data-mcc-view-set="${view}"]`) as HTMLElement,
    };
  }

  it("switches panes without asking the host for anything", async () => {
    const { pane, button } = await mount(README);
    expect(pane("rendered").hidden).toBe(false);
    expect(pane("raw").hidden).toBe(true);

    button("raw").click();
    expect(pane("raw").hidden).toBe(false);
    expect(pane("rendered").hidden).toBe(true);
    expect(button("raw").getAttribute("aria-pressed")).toBe("true");
    expect(button("rendered").getAttribute("aria-pressed")).toBe("false");

    button("rendered").click();
    expect(pane("rendered").hidden).toBe(false);
    expect(button("raw").classList.contains("mcc-active")).toBe(false);
  });

  it("keeps the chosen view across a tab switch", async () => {
    const { doc, pane, button } = await mount(README);
    button("raw").click();
    const tabs = doc.querySelectorAll(".mcc-tab");
    (tabs[1] as HTMLElement).click();
    (tabs[0] as HTMLElement).click();
    // Nothing is destroyed on a tab switch, so the choice survives it.
    expect(pane("raw").hidden).toBe(false);
  });

  it("keeps raw HTML inside markdown inert in the rendered pane", async () => {
    const hostile = '# Hi\n\n<img src=x onerror="window.__pwned=1">\n\n<a href="javascript:alert(1)">x</a>';
    const { window, pane } = await mount(hostile);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    // Raw HTML renders as literal prose here, the same policy as every other
    // non-html field, so there is no live element to carry a handler.
    expect(pane("rendered").querySelectorAll("img")).toHaveLength(0);
    expect(
      Array.from(pane("rendered").querySelectorAll("*")).filter((el) => el.hasAttribute("onerror")),
    ).toHaveLength(0);
    // The javascript: URL survives as escaped prose, which is the point: it
    // is text in a paragraph, not an attribute on a link anything can click.
    expect(pane("rendered").querySelectorAll("a")).toHaveLength(0);
    expect(pane("rendered").querySelectorAll('[href^="javascript:"]')).toHaveLength(0);
  });
});
