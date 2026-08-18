import {
  escapeHtml,
  renderCodeBlock,
  sanitizeHtml,
  textToBlocks,
  type TutorTerm,
} from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface RevealSection {
  heading: string;
  html?: string;
  text?: string;
  // Code sample shown in a monospace block with a copy button, exactly as the
  // tab card renders its own code field. Indented source pasted into text
  // would otherwise lose its leading whitespace and its copy button.
  code?: string;
  language?: string;
  open?: boolean;
}

export interface RevealCardOptions {
  title: string;
  subtitle?: string;
  sections: RevealSection[];
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

// A section may carry prose, a code sample, or both, in that reading order.
// html is the explicitly-HTML field and replaces the pair when given.
function sectionContent(section: RevealSection): string {
  if (section.html) return sanitizeHtml(section.html);
  const parts: string[] = [];
  if (section.text) parts.push(textToBlocks(section.text));
  if (section.code !== undefined) parts.push(renderCodeBlock(section.code, section.language));
  return parts.join("\n");
}

export function buildRevealCard(options: RevealCardOptions): RenderedCard {
  const sections = options.sections
    .map((section) => {
      const open = section.open ? " open" : "";
      return `<div class="mcc-block"><details class="mcc-reveal"${open}>
<summary>${escapeHtml(section.heading)}</summary>
<div class="mcc-reveal-body">${sectionContent(section)}</div>
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
