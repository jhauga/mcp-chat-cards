// Convert model-generated markdown documents (guides, walkthroughs, notes)
// into card-ready HTML: parse with marked, sanitize, then restyle so the
// result matches the card system - tables become card tables, fenced code
// gets copy buttons, and H2 sections can fold into show/hide reveals.
import { marked } from "marked";
import { parse, HTMLElement } from "node-html-parser";
import { escapeHtml, sanitizeHtml } from "./html.js";

export interface MarkdownToCardResult {
  // Text of the first H1, if the document has one (used as the card title).
  title?: string;
  bodyHtml: string;
  sectionCount: number;
}

export interface MarkdownToCardOptions {
  // Fold H2 sections into collapsible reveals (default true).
  splitSections?: boolean;
  // With splitSections, open the first section initially (default true).
  openFirst?: boolean;
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

// Group the document into an intro plus one reveal per H2 heading.
function sectionize(root: HTMLElement, openFirst: boolean): { html: string; sections: number } {
  const intro: string[] = [];
  const sections: { heading: string; parts: string[] }[] = [];
  for (const node of root.childNodes) {
    const el = node as HTMLElement;
    if (el.rawTagName?.toLowerCase() === "h2") {
      sections.push({ heading: el.text.trim(), parts: [] });
      continue;
    }
    if (sections.length === 0) intro.push(node.toString());
    else sections[sections.length - 1].parts.push(node.toString());
  }
  if (sections.length === 0) {
    return { html: intro.join(""), sections: 0 };
  }
  const controls = `<div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:8px">
<button type="button" class="mcc-btn" data-mcc-expand="all">Show all</button>
<button type="button" class="mcc-btn" data-mcc-expand="none">Hide all</button>
</div>`;
  const folded = sections
    .map((section, index) => {
      const open = openFirst && index === 0 ? " open" : "";
      return `<details class="mcc-reveal"${open}>
<summary>${escapeHtml(section.heading)}</summary>
<div class="mcc-reveal-body">${section.parts.join("")}</div>
</details>`;
    })
    .join("\n");
  return { html: intro.join("") + controls + folded, sections: sections.length };
}

export function markdownToCardHtml(
  markdown: string,
  options: MarkdownToCardOptions = {},
): MarkdownToCardResult {
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

  if (options.splitSections === false) {
    return { title, bodyHtml: root.toString(), sectionCount: 0 };
  }
  const { html, sections } = sectionize(root, options.openFirst !== false);
  return { title, bodyHtml: html, sectionCount: sections };
}
