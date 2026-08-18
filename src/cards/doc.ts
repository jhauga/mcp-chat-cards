// Document card: renders a model-generated markdown document (guide,
// walkthrough, notes) as interactive cards with collapsible sections.
// Documents larger than the card size budget are split at H2 boundaries
// into multiple parts; each part renders as its own card.
import type { TutorTerm } from "../util/html.js";
import {
  parseMarkdownDocument,
  renderSections,
  type MarkdownSection,
} from "../util/markdown.js";
import {
  assertValidPart,
  cardParts,
  cardSizeBudget,
  continuationNote,
  packByBudget,
  partTitle,
} from "../util/budget.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface MarkdownCardOptions {
  markdown: string;
  // Card title; defaults to the document's first H1, then this fallback.
  title?: string;
  subtitle?: string;
  splitSections?: boolean;
  openFirst?: boolean;
  // Which part of a multi-part document to render (1-based, default 1).
  part?: number;
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

const SECTION_OVERHEAD = 200;

export function buildMarkdownCard(options: MarkdownCardOptions): RenderedCard {
  const doc = parseMarkdownDocument(options.markdown);
  const baseTitle = options.title ?? doc.title ?? "Document";

  const parts = packByBudget(
    doc.sections,
    (section: MarkdownSection) => section.html.length + SECTION_OVERHEAD,
    cardSizeBudget(),
  );
  const totalParts = Math.max(1, parts.length);
  const part = options.part ?? 1;
  assertValidPart(part, totalParts);
  const sections = parts[part - 1] ?? [];

  const bodyHtml = renderSections(sections, {
    folded: options.splitSections,
    openFirst: options.openFirst,
  });
  const body = `<section class="mcc-block mcc-doc">
${bodyHtml}
</section>`;

  const info = { part, totalParts };
  const rendered = renderCardDocument({
    title: partTitle(baseTitle, info),
    subtitle: options.subtitle,
    kind: "document",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });

  const headings = sections
    .filter((section) => section.heading !== null)
    .map((section) => section.heading);
  const described =
    headings.length > 0
      ? `${headings.length} collapsible section(s): ${headings.join(", ")}`
      : "a single flowing section";
  return {
    ...rendered,
    parts: cardParts(info),
    summary:
      `Created document card "${partTitle(baseTitle, info)}" from markdown with ${described}.` +
      continuationNote("create_markdown_card", info),
  };
}
