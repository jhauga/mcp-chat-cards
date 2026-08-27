// Convert model-generated markdown documents (guides, walkthroughs, notes)
// into card-ready HTML: parse with marked, sanitize, then restyle so the
// result matches the card system - tables become card tables, fenced code
// gets copy buttons, and the document is broken into H2 sections that can
// fold into show/hide reveals and be packed into multi-part cards.
import { Marked, type RendererObject } from "marked";
import { parse, HTMLElement } from "node-html-parser";
import { escapeHtml, renderCodeBlock, sanitizeHtml, textToParagraphs } from "./html.js";
import { renderFileView } from "./file-view.js";

// marked's default text renderer leaves a well-formed character reference
// alone, so an author who writes "&amp;amp;" to document escaping gets a bare
// "&" back, and the same string renders differently in a markdown card than in
// a table or tab card. Raw HTML is passed through live by default too, which
// makes a <div> in prose terminate the enclosing paragraph and puts markdown
// under a looser policy than every other card. Both fields are plain text
// here: escaped exactly once, never decoded, never executed. Fenced blocks and
// inline code already escape fully, so they are left to marked.
// A comment carries no reader-facing content, and markdown authors use it for
// tooling directives ("<!-- markdownlint-disable -->"). Escaping one would
// turn an invisible directive into visible prose, so comments are dropped.
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const LITERAL_TEXT_RENDERER: RendererObject = {
  // Block-level HTML and inline tags both land here, and they need different
  // treatment. An inline tag sits inside a paragraph already, so escaping it
  // in place is enough. A block one is a sibling of the paragraphs around it:
  // emitted as a bare text node it inherits no margin or line-height and
  // collides with its neighbours, so it is wrapped in the paragraph markup the
  // markdown structure implies.
  html(token) {
    const text = token.text.replace(HTML_COMMENT, "");
    if (!token.block) return escapeHtml(text);
    return textToParagraphs(text);
  },
  text(token) {
    if ("tokens" in token && token.tokens && token.tokens.length > 0) {
      return this.parser.parseInline(token.tokens);
    }
    // An extension that emits ready-made markup marks it escaped.
    if ("escaped" in token && token.escaped) return token.text;
    return escapeHtml(token.text);
  },
  // Link titles and image alt text are caller text too - the alt is what a
  // reader sees when the image does not load - so they follow the same rule
  // as the prose around them. URLs are left to sanitizeHtml, which drops an
  // unsafe scheme from any url-bearing attribute a moment later.
  link({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<a href="${escapeHtml(href)}"${titleAttr}>${label}</a>`;
  },
  image({ href, title, text }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
  },
};

// A private instance, so the renderer policy cannot leak into any other use
// of marked in the process.
const cardMarkdown = new Marked({ gfm: true, async: false }).use({
  renderer: LITERAL_TEXT_RENDERER,
});

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
  const rawHtml = cardMarkdown.parse(markdown, { async: false }) as string;
  // Raw HTML is already inert by the time it gets here; sanitizing anyway
  // keeps the markdown card under the same policy as the explicitly-HTML
  // fields if the renderer above ever gains a pass-through case.
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

// A markdown FILE shown the way a code host shows one: the prose rendered as
// a page, with a toggle back to the source. A .md file in a code tour used to
// be a fenced code block like any other source file, which is the one case
// where that is the wrong default - nobody reads a README as source unless
// they mean to. Both views ship in the panel and the toggle is client-side,
// so switching costs no round trip.
//
// Rendered uses the same document styling as the markdown card (one flowing
// page, never folded into reveals - a file view is a page, not an outline).
// Raw is the ordinary card code block: monospace, whitespace preserved, and
// the copy button that gives back exactly what was passed in.
export function renderMarkdownFileView(markdown: string, label?: string): string {
  const doc = parseMarkdownDocument(markdown);
  // parseMarkdownDocument lifts the first H1 out to become a CARD title. A
  // file view is not a card title - the heading belongs to the page, the way
  // it does when the same file is viewed anywhere else - so it goes back.
  const heading = doc.title ? `<h1>${escapeHtml(doc.title)}</h1>` : "";
  const body = renderSections(doc.sections, { folded: false });
  const rendered = (heading + body).trim().length > 0
    ? heading + body
    : '<p class="mcc-help">This file is empty.</p>';
  // Rendered markdown is a different document from its source, so unlike the
  // code file view this one really does carry two panes.
  return renderFileView({
    viewOptions: [
      { name: "raw", label: "Raw" },
      { name: "rendered", label: "Rendered" },
    ],
    active: "rendered",
    label,
    extraClass: "mcc-mdfile",
    body:
      `<div class="mcc-fileview-pane mcc-doc" data-mcc-pane="rendered">${rendered}</div>\n` +
      `<div class="mcc-fileview-pane" data-mcc-pane="raw" hidden>${renderCodeBlock(markdown, "markdown")}</div>`,
  });
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
