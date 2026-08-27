// Syntax highlighting and the Raw | Code file view. The properties that
// matter are not "does it colour the right word" but: the source survives
// intact, nothing in the source can escape into markup, the grammar is chosen
// from the card's own language, and a language with no grammar is no worse
// off than before.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  canonicalLanguage,
  grammarFor,
  highlightCode,
  highlightableLanguages,
  isHighlightable,
} from "../src/util/highlight.js";
import { renderCodeFileView } from "../src/util/file-view.js";
import { buildCodeTourCard, renderedTabCost } from "../src/cards/code-tour.js";
import { buildTabCard } from "../src/cards/tabs.js";
import { escapeHtml } from "../src/util/html.js";

const TS = `// Count active users.
import { db } from "./db";

export async function activeUsers(days = 30): Promise<number> {
  const since = Date.now() - days * 86_400_000;
  const rows = await db.query("SELECT id FROM users WHERE seen > $1", [since]);
  return rows.length; /* total */
}
`;

// The text of a highlighted block, as the reader and the clipboard see it.
function textOf(html: string): string {
  return new JSDOM(`<div>${html}</div>`).window.document.body.textContent ?? "";
}

describe("language resolution", () => {
  it("resolves the aliases a model is likely to pass", () => {
    const cases: [string, string][] = [
      ["Node.js", "javascript"],
      ["JS", "javascript"],
      ["TypeScript", "typescript"],
      ["ts", "typescript"],
      ["py", "python"],
      ["C#", "csharp"],
      ["golang", "go"],
      ["yml", "yaml"],
      ["bash", "shell"],
    ];
    for (const [input, expected] of cases) {
      expect(canonicalLanguage(input)).toBe(expected);
      expect(isHighlightable(input)).toBe(true);
    }
  });

  it("reports no grammar for a language it does not know", () => {
    expect(isHighlightable("brainfuck")).toBe(false);
    expect(isHighlightable(undefined)).toBe(false);
    expect(grammarFor("text")).toBeNull();
  });

  it("builds each grammar once and reuses it", () => {
    // Grammars are resolved per language at render time. Nothing is fetched
    // and nothing is installed, so the same request must return the same
    // compiled object rather than rebuilding the keyword sets per file.
    expect(grammarFor("python")).toBe(grammarFor("py"));
    expect(highlightableLanguages()).toContain("typescript");
    expect(highlightableLanguages()).toContain("python");
  });
});

describe("highlightCode", () => {
  it("never changes the text of the code it marks up", () => {
    for (const language of highlightableLanguages()) {
      expect(textOf(highlightCode(TS, language))).toBe(TS);
    }
  });

  it("returns escaped source unchanged when there is no grammar", () => {
    expect(highlightCode(TS, "brainfuck")).toBe(escapeHtml(TS));
    expect(highlightCode(TS, undefined)).toBe(escapeHtml(TS));
  });

  it("marks comments, strings, numbers, keywords, and known types", () => {
    const html = highlightCode(TS, "typescript");
    expect(html).toContain('<span class="mcc-t-c">// Count active users.</span>');
    expect(html).toContain('<span class="mcc-t-c">/* total */</span>');
    expect(html).toContain('<span class="mcc-t-k">export</span>');
    expect(html).toContain('<span class="mcc-t-k">await</span>');
    expect(html).toContain('<span class="mcc-t-y">Promise</span>');
    expect(html).toContain('<span class="mcc-t-n">30</span>');
    expect(html).toContain("mcc-t-s");
  });

  it("uses the grammar of the language it was given, not a fixed one", () => {
    // "def" is a Python keyword and an ordinary word in JavaScript; "#" opens
    // a comment in Python and does not in JavaScript.
    const source = "def x = 1  # note\n";
    expect(highlightCode(source, "python")).toContain('<span class="mcc-t-k">def</span>');
    expect(highlightCode(source, "javascript")).not.toContain('<span class="mcc-t-k">def</span>');
    expect(highlightCode(source, "python")).toContain('<span class="mcc-t-c"># note</span>');
    expect(highlightCode(source, "javascript")).not.toContain("mcc-t-c");
  });

  it("cannot let source text escape into markup", () => {
    const hostile = 'const a = "</span></code></pre><script>alert(1)</script>";\n// <img onerror=x>\n';
    const html = highlightCode(hostile, "javascript");
    // Every token is escaped as it is emitted, so the only tags present are
    // the ones the highlighter itself opened.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("</code>");
    expect(html).not.toContain("<img");
    expect(textOf(html)).toBe(hostile);
    const doc = new JSDOM(`<div>${html}</div>`).window.document;
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    expect(doc.querySelectorAll("img")).toHaveLength(0);
  });

  it("does not run away on an unterminated comment or string", () => {
    expect(textOf(highlightCode('const a = "oops\nconst b = 1;\n', "javascript"))).toBe(
      'const a = "oops\nconst b = 1;\n',
    );
    expect(textOf(highlightCode("/* never closed\nmore\n", "javascript"))).toBe(
      "/* never closed\nmore\n",
    );
    expect(textOf(highlightCode('"""open\nrest\n', "python"))).toBe('"""open\nrest\n');
  });

  it("keeps a decimal or underscored number in one token", () => {
    const html = highlightCode("const n = 86_400_000; const f = 1.5;\n", "javascript");
    expect(html).toContain('<span class="mcc-t-n">86_400_000</span>');
    expect(html).toContain('<span class="mcc-t-n">1.5</span>');
  });
});

describe("code file view", () => {
  it("offers Raw | Code and opens on Code", () => {
    const html = renderCodeFileView(TS, "typescript", "src/users.ts");
    expect(html).toContain('data-mcc-view-set="raw"');
    expect(html).toContain('data-mcc-view-set="code"');
    expect(html).toContain('data-mcc-view="code"');
    // "Raw" is the first button but not the opening view, the way a
    // repository browser shows a file.
    expect(html.indexOf('data-mcc-view-set="raw"')).toBeLessThan(
      html.indexOf('data-mcc-view-set="code"'),
    );
  });

  it("numbers lines in a gutter that is not part of the file", () => {
    const doc = new JSDOM(`<div>${renderCodeFileView(TS, "typescript")}</div>`).window.document;
    const gutter = doc.querySelector("pre.mcc-gutter");
    expect(gutter?.getAttribute("aria-hidden")).toBe("true");
    expect(gutter?.textContent?.split("\n")).toHaveLength(TS.split("\n").length);
    // The file itself is a sibling, so its text is the file and nothing else.
    expect(doc.querySelector("pre.mcc-code")?.textContent).toBe(TS);
  });

  it("carries one copy of the source, not one per view", () => {
    // Raw is the code view restyled, so the source appears once. Shipping it
    // twice would roughly double what every source file costs the card.
    const html = renderCodeFileView(TS, "typescript");
    expect(html.split("activeUsers")).toHaveLength(2);
  });
});

describe("code tour integration", () => {
  function tour() {
    return buildCodeTourCard({
      title: "Tour",
      files: [
        { path: "src/users.ts", content: TS },
        { path: "notes.unknownext", content: TS },
      ],
    });
  }

  it("gives a known language the file view and leaves an unknown one alone", () => {
    const html = tour().articleHtml;
    expect(html.match(/mcc-codefile/g)).toHaveLength(1);
    // The unknown file still renders, as the plain code block it always was.
    expect(html).toContain('class="language-text"');
  });

  it("keeps ordinary tab cards on plain code blocks", () => {
    // Only the tour opts in; a tab card the model wrote by hand is unchanged.
    const card = buildTabCard({
      title: "Snippet",
      tabs: [{ label: "example.ts", code: TS, language: "typescript" }],
    });
    expect(card.articleHtml).not.toContain("mcc-fileview");
    expect(card.articleHtml).toContain("mcc-codewrap");
  });

  it("counts the highlighted panel against the size budget", () => {
    const highlighted = renderedTabCost({ path: "a.ts", content: TS });
    const plain = renderedTabCost({ path: "a.unknownext", content: TS });
    expect(highlighted).toBeGreaterThan(plain);
    // A tour of highlighted files splits rather than overflowing the card.
    const card = buildCodeTourCard({ title: "T", files: [{ path: "a.ts", content: TS }] });
    expect(card.parts).toMatchObject({ current: 1, total: 1 });
  });

  it("switches views in a live card without touching the source", async () => {
    const card = tour();
    const dom = new JSDOM(card.html, {
      runScripts: "dangerously",
      url: "https://cards.invalid/",
      pretendToBeVisual: true,
    });
    const { window } = dom;
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    const doc = window.document;
    const wrap = doc.querySelector(".mcc-codefile") as HTMLElement;
    const source = () => (doc.querySelector("pre.mcc-code") as HTMLElement).textContent;

    expect(wrap.getAttribute("data-mcc-view")).toBe("code");
    const before = source();

    (wrap.querySelector('[data-mcc-view-set="raw"]') as HTMLElement).click();
    expect(wrap.getAttribute("data-mcc-view")).toBe("raw");
    // Raw is a restyling: the pane stays, and so does every character in it.
    expect((doc.querySelector('[data-mcc-pane="code"]') as HTMLElement).hidden).toBe(false);
    expect(source()).toBe(before);

    (wrap.querySelector('[data-mcc-view-set="code"]') as HTMLElement).click();
    expect(wrap.getAttribute("data-mcc-view")).toBe("code");
  });

  it("copies the file without its line numbers", async () => {
    const card = tour();
    const dom = new JSDOM(card.html, {
      runScripts: "dangerously",
      url: "https://cards.invalid/",
      pretendToBeVisual: true,
    });
    const { window } = dom;
    let copied = "";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { copied = text; return Promise.resolve(); } },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 30));

    (window.document.querySelector(".mcc-copy-code") as HTMLElement).click();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(copied).toBe(TS);
  });
});
