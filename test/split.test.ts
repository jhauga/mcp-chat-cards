import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { packByBudget } from "../src/util/budget.js";
import { buildMarkdownCard } from "../src/cards/doc.js";
import { buildCodeTourCard, planTourParts } from "../src/cards/code-tour.js";

afterEach(() => {
  delete process.env.MCP_CHAT_CARDS_CARD_BUDGET;
});

describe("packByBudget", () => {
  it("packs in order under the budget", () => {
    const parts = packByBudget(["aa", "bb", "cc", "dd"], (s) => s.length, 4);
    expect(parts).toEqual([
      ["aa", "bb"],
      ["cc", "dd"],
    ]);
  });

  it("gives an oversized item its own part", () => {
    const parts = packByBudget(["aa", "xxxxxxxxxx", "bb"], (s) => s.length, 4);
    expect(parts).toEqual([["aa"], ["xxxxxxxxxx"], ["bb"]]);
  });

  it("respects the max items per part", () => {
    const parts = packByBudget(["a", "b", "c"], () => 1, 100, 2);
    expect(parts).toEqual([["a", "b"], ["c"]]);
  });
});

function bigMarkdown(): string {
  const section = (name: string) => `## ${name}\n\n${"filler content ".repeat(300)}\n`;
  return `# Big Guide\n\nIntro.\n\n${section("One")}${section("Two")}${section("Three")}${section("Four")}`;
}

describe("multi-part markdown cards", () => {
  it("splits large documents at H2 boundaries with continuation guidance", () => {
    process.env.MCP_CHAT_CARDS_CARD_BUDGET = "10000";
    const part1 = buildMarkdownCard({ markdown: bigMarkdown() });
    expect(part1.html).toContain("part 1 of");
    expect(part1.summary).toContain("call create_markdown_card again with part: 2");
    expect(part1.html).toContain("<summary>One</summary>");
    expect(part1.html).not.toContain("<summary>Four</summary>");
  });

  it("renders later parts with the remaining sections", () => {
    process.env.MCP_CHAT_CARDS_CARD_BUDGET = "10000";
    const part1 = buildMarkdownCard({ markdown: bigMarkdown() });
    const match = part1.summary.match(/part 1 of (\d+)/);
    const total = Number(match?.[1]);
    expect(total).toBeGreaterThan(1);
    const last = buildMarkdownCard({ markdown: bigMarkdown(), part: total });
    expect(last.html).toContain("<summary>Four</summary>");
    expect(last.summary).not.toContain("more part(s) remain");
  });

  it("rejects out-of-range parts", () => {
    expect(() => buildMarkdownCard({ markdown: "# T\n\nSmall.", part: 5 })).toThrow(/between 1 and 1/);
  });

  it("keeps small documents as a single unlabeled card", () => {
    const card = buildMarkdownCard({ markdown: "# Small\n\n## Only\n\nBrief." });
    expect(card.html).toContain("<h1>Small</h1>");
    expect(card.html).not.toContain("part 1 of");
    expect(card.summary).not.toContain("more part(s) remain");
  });
});

describe("multi-part code tours", () => {
  const files = Array.from({ length: 4 }, (_, i) => ({
    path: `src/file${i}.rs`,
    content: `// file ${i}\n${"fn filler() {}\n".repeat(300)}`,
  }));

  it("plans parts deterministically under the budget", () => {
    const parts = planTourParts(files, 10_000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.flat().map((file) => file.path)).toEqual(
      ["src/file0.rs", "src/file1.rs", "src/file2.rs", "src/file3.rs"],
    );
  });

  it("renders part 1 with intro and later parts without it", () => {
    process.env.MCP_CHAT_CARDS_CARD_BUDGET = "10000";
    const part1 = buildCodeTourCard({ title: "Tour", intro: "Start here text.", files });
    expect(part1.html).toContain("Start here");
    expect(part1.summary).toContain("call create_code_tour_card again with part: 2");
    const part2 = buildCodeTourCard({ title: "Tour", intro: "Start here text.", files, part: 2 });
    expect(part2.html).not.toContain("Start here");
    expect(part2.html).toContain("part 2 of");
  });

  it("truncates oversized single files with a notice", () => {
    const huge = [{ path: "src/big.rs", content: "x".repeat(40_000) }];
    const card = buildCodeTourCard({ title: "Huge", files: huge });
    // Asserted on what the reader sees rather than on the markup: a
    // highlighted file wraps the notice's number in a token span, so the
    // notice is no longer one contiguous string in the HTML.
    const code = new JSDOM(card.html).window.document.querySelector("pre.mcc-code");
    expect(code?.textContent?.length).toBeLessThan(40_000);
    expect(code?.textContent).toContain("truncated: 28000 more character(s)");
  });

  it("preserves the caller's teaching order instead of alphabetizing", () => {
    // Deliberate pedagogical order: data model, errors, storage, entry point.
    // An alphabetical sort would render error/main/store/task instead.
    const tour = [
      { path: "Cargo.toml", content: "[package]" },
      { path: "src/task.rs", content: "// task" },
      { path: "src/error.rs", content: "// error" },
      { path: "src/store.rs", content: "// store" },
      { path: "src/main.rs", content: "// main" },
    ];
    const parts = planTourParts(tour);
    expect(parts.flat().map((file) => file.path)).toEqual([
      "Cargo.toml",
      "src/task.rs",
      "src/error.rs",
      "src/store.rs",
      "src/main.rs",
    ]);

    const card = buildCodeTourCard({ title: "Ordered tour", files: tour });
    const labelOrder = ["task.rs", "error.rs", "store.rs", "main.rs"].map((name) =>
      card.articleHtml.indexOf(`src/${name}`),
    );
    expect(Math.min(...labelOrder)).toBeGreaterThan(-1);
    expect([...labelOrder].sort((a, b) => a - b)).toEqual(labelOrder);
  });

  it("hoists a README to the front even when the caller lists it last", () => {
    const parts = planTourParts([
      { path: "src/main.rs", content: "// main" },
      { path: "README.md", content: "# Sample project" },
    ]);
    expect(parts.flat().map((file) => file.path)).toEqual(["README.md", "src/main.rs"]);
  });
});
