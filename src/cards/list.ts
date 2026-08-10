// Sequentially numbered nested outline (1., 1.1., 1.1.1.) rendered with CSS
// counters. Replaces the legacy sequentialSectionOrderedListItems reference
// function with a purely declarative implementation.
import { escapeHtml, textToParagraphs, type TutorTerm } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface ListItem {
  text: string;
  children?: ListItem[];
}

export interface ListCardOptions {
  title: string;
  subtitle?: string;
  intro?: string;
  items: ListItem[];
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

function countItems(items: ListItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(item.children ?? []), 0);
}

function renderItems(items: ListItem[]): string {
  const lis = items
    .map((item) => {
      const children = item.children?.length ? renderItems(item.children) : "";
      return `<li>${escapeHtml(item.text)}${children}</li>`;
    })
    .join("\n");
  return `<ol class="mcc-seq">\n${lis}\n</ol>`;
}

export function buildListCard(options: ListCardOptions): RenderedCard {
  const intro = options.intro ? textToParagraphs(options.intro) : "";
  const body = `<section class="mcc-block">
${intro}
${renderItems(options.items)}
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "list",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  return {
    ...doc,
    summary: `Created sequential list card "${options.title}" with ${countItems(options.items)} item(s).`,
  };
}
