// Document card: renders a model-generated markdown document (guide,
// walkthrough, notes) as one interactive card with collapsible sections.
import type { TutorTerm } from "../util/html.js";
import { markdownToCardHtml } from "../util/markdown.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface MarkdownCardOptions {
  markdown: string;
  // Card title; defaults to the document's first H1, then this fallback.
  title?: string;
  subtitle?: string;
  splitSections?: boolean;
  openFirst?: boolean;
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

export function buildMarkdownCard(options: MarkdownCardOptions): RenderedCard {
  const converted = markdownToCardHtml(options.markdown, {
    splitSections: options.splitSections,
    openFirst: options.openFirst,
  });
  const title = options.title ?? converted.title ?? "Document";

  const body = `<section class="mcc-block mcc-doc">
${converted.bodyHtml}
</section>`;

  const doc = renderCardDocument({
    title,
    subtitle: options.subtitle,
    kind: "document",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  const sections =
    converted.sectionCount > 0
      ? `${converted.sectionCount} collapsible section(s)`
      : "a single flowing section";
  return {
    ...doc,
    summary: `Created document card "${title}" from markdown with ${sections}.`,
  };
}
