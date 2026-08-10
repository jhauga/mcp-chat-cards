// Convert model-generated markdown documents (guides, walkthroughs, notes)
// into card-ready HTML: parse with marked, sanitize, then restyle so the
// result matches the card system - tables become card tables, fenced code
// gets copy buttons, and the document is broken into H2 sections that can
// fold into show/hide reveals and be packed into multi-part cards.
import { marked } from "marked";
import { parse, HTMLElement } from "node-html-parser";
import { escapeHtml, sanitizeHtml } from "./html.js";

export interface MarkdownSection {
  // null for content before the first H2 (the intro).
  heading: string | null;
  html: string;
}

export interface MarkdownDocument {
  // Text of the first H1, if the document has one (used as the card title).
  title?: string;
  sections: MarkdownSection[];
}

function restyleTables(root: HTMLElement): void {
  for (const table of root.querySelectorAll("table")) {
    table.setAttribute("class", "mcc-table");
    const wrapper = parse('<div class="mcc-table-scroll"></div>').firstChild as HTMLElement;
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  }
}

function restyleCodeBlocks(root: HTMLElement): void {
  for (const pre of root.querySelectorAll("pre")) {
    const wrapper = parse(
      '<div class="mcc-codewrap"><button type="button" class="mcc-btn mcc-copy-code">Copy</button></div>',
    ).firstChild as HTMLElement;
    pre.replaceWith(wrapper);
    wrapper.appendChild(pre);
  }
}

// Parse markdown into card-styled HTML sections split on H2 headings.
export function parseMarkdownDocument(markdown: string): MarkdownDocument {
  const rawHtml = marked.parse(markdown, { async: false, gfm: true }) as string;
  const root = parse(sanitizeHtml(rawHtml), { comment: false });

  let title: string | undefined;
  const h1 = root.querySelector("h1");
  if (h1) {
    title = h1.text.trim();
    h1.remove();
  }

  restyleTables(root);
  restyleCodeBlocks(root);

  const sections: MarkdownSection[] = [];
  let current: MarkdownSection = { heading: null, html: "" };
  for (const node of root.childNodes) {
    const el = node as HTMLElement;
    if (el.rawTagName?.toLowerCase() === "h2") {
      if (current.html.trim().length > 0) sections.push(current);
      current = { heading: el.text.trim(), html: "" };
      continue;
    }
    current.html += node.toString();
  }
  if (current.html.trim().length > 0 || current.heading !== null) sections.push(current);

  return { title, sections };
}

export interface RenderSectionsOptions {
  // Fold H2 sections into collapsible reveals (default true).
  folded?: boolean;
  // With folding, open the first section initially (default true).
  openFirst?: boolean;
}

export function renderSections(
  sections: MarkdownSection[],
  options: RenderSectionsOptions = {},
): string {
  const folded = options.folded !== false;
  const headed = sections.filter((section) => section.heading !== null);
  const parts: string[] = [];

  if (!folded || headed.length === 0) {
    for (const section of sections) {
      if (section.heading !== null) {
        parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
      }
      parts.push(section.html);
    }
    return parts.join("");
  }

  let firstOpenUsed = false;
  let controlsAdded = false;
  for (const section of sections) {
    if (section.heading === null) {
      parts.push(section.html);
      continue;
    }
    if (!controlsAdded) {
      controlsAdded = true;
      parts.push(`<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:8px">
<button type="button" class="mcc-btn" data-mcc-expand="all">Show all</button>
<button type="button" class="mcc-btn" data-mcc-expand="none">Hide all</button>
</div>`);
    }
    const open = !firstOpenUsed && options.openFirst !== false ? " open" : "";
    firstOpenUsed = true;
    parts.push(`<details class="mcc-reveal"${open}>
<summary>${escapeHtml(section.heading)}</summary>
<div class="mcc-reveal-body">${section.html}</div>
</details>`);
  }
  return parts.join("\n");
}

export interface MarkdownToCardResult {
  title?: string;
  bodyHtml: string;
  sectionCount: number;
}

export interface MarkdownToCardOptions {
  splitSections?: boolean;
  openFirst?: boolean;
}

// Single-card convenience wrapper (no part packing).
export function markdownToCardHtml(
  markdown: string,
  options: MarkdownToCardOptions = {},
): MarkdownToCardResult {
  const doc = parseMarkdownDocument(markdown);
  const bodyHtml = renderSections(doc.sections, {
    folded: options.splitSections,
    openFirst: options.openFirst,
  });
  return {
    title: doc.title,
    bodyHtml,
    sectionCount:
      options.splitSections === false
        ? 0
        : doc.sections.filter((section) => section.heading !== null).length,
  };
}
