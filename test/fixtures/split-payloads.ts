// Payloads built to a known RENDERED size, so a split is guaranteed rather
// than guessed at.
//
// The card budget is measured on rendered characters, not on the input the
// caller wrote: source is HTML-escaped into the card, and one "<" becomes four
// characters. Escape-heavy content therefore crosses the budget at a raw size
// that looks comfortably under it, which is why hand-built payloads split
// unpredictably and why the true branch of parts.hasMore went unobserved.
// Every fixture here measures with the same cost function the packer uses and
// grows until it lands where it means to.
import { DEFAULT_CARD_BUDGET } from "../../src/util/budget.js";
import { renderedTabCost, type TourFile } from "../../src/cards/code-tour.js";
import { parseMarkdownDocument } from "../../src/util/markdown.js";

// Each item costs this much of a full card. Four of them sum to 160% of the
// budget, and the packer preserves order and fills greedily, so the split is
// exactly two parts of two items - never one, never three - no matter how the
// escaping expands.
const ITEMS_PER_FIXTURE = 4;
const ITEM_FRACTION = 0.4;

export const ITEM_TARGET_COST = Math.floor(DEFAULT_CARD_BUDGET * ITEM_FRACTION);

// Deliberately escape-heavy: generics, references, string literals, and markup
// inside a format string all expand under escapeHtml, so a fixture sized this
// way also pins the rendered-vs-raw distinction itself.
const CODE_LINE = 'fn render<T: Display>(v: &T) -> String { format!("<span>{}</span>", v) }\n';

// Grow until the measured cost reaches the target. The expansion ratio is not
// fixed, so it is measured rather than assumed.
function tourFileOfCost(path: string, targetCost: number): TourFile {
  let content = "";
  while (renderedTabCost({ path, content }) < targetCost) content += CODE_LINE;
  return { path, content };
}

// Four files that always pack into exactly two parts under the default budget.
export function splittingTourFiles(): TourFile[] {
  return Array.from({ length: ITEMS_PER_FIXTURE }, (_, i) =>
    tourFileOfCost(`src/mod${i}.rs`, ITEM_TARGET_COST),
  );
}

// Cost the markdown packer charges a section, mirroring SECTION_OVERHEAD in
// cards/doc.ts. Measured through the real parser so marked's own expansion
// (paragraph tags, entity escaping) is included.
function markdownSectionCost(body: string): number {
  const doc = parseMarkdownDocument(`## Probe\n\n${body}\n`);
  const section = doc.sections.find((s) => s.heading === "Probe");
  return (section?.html.length ?? 0) + 200;
}

const PROSE_LINE = "Borrowing & ownership keep <T> alive without a garbage collector. ";

function sectionBodyOfCost(targetCost: number): string {
  let body = "";
  while (markdownSectionCost(body) < targetCost) body += PROSE_LINE;
  return body;
}

export const SPLIT_MARKDOWN_HEADINGS = ["One", "Two", "Three", "Four"];

// A document that always packs into exactly two parts under the default
// budget. Split happens at H2 boundaries, so the headings are the unit.
export function splittingMarkdown(): string {
  const body = sectionBodyOfCost(ITEM_TARGET_COST);
  return (
    "# Big Guide\n\nIntro.\n\n" +
    SPLIT_MARKDOWN_HEADINGS.map((heading) => `## ${heading}\n\n${body}\n`).join("")
  );
}
