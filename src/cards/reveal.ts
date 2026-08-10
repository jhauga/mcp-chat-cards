import { escapeHtml, sanitizeHtml, textToParagraphs, type TutorTerm } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface RevealSection {
  heading: string;
  html?: string;
  text?: string;
  open?: boolean;
}

export interface RevealCardOptions {
  title: string;
  subtitle?: string;
  sections: RevealSection[];
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

export function buildRevealCard(options: RevealCardOptions): RenderedCard {
  const sections = options.sections
    .map((section) => {
      const content = section.html ? sanitizeHtml(section.html) : textToParagraphs(section.text ?? "");
      const open = section.open ? " open" : "";
      return `<div class="mcc-block"><details class="mcc-reveal"${open}>
<summary>${escapeHtml(section.heading)}</summary>
<div class="mcc-reveal-body">${content}</div>
</details></div>`;
    })
    .join("\n");

  const body = `<div class="mcc-block" style="display:flex;gap:6px;justify-content:flex-end">
<button type="button" class="mcc-btn" data-mcc-expand="all">Show all</button>
<button type="button" class="mcc-btn" data-mcc-expand="none">Hide all</button>
</div>
${sections}`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "show-hide",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  return {
    ...doc,
    summary: `Created show/hide card "${options.title}" with ${options.sections.length} collapsible section(s).`,
  };
}
