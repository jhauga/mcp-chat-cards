// Code tour card: presents a model-generated project as one tab per source
// file with copy buttons, so an archive the model produced earlier in the
// conversation becomes a browsable tutorial. Projects larger than the card
// size budget are split into multiple parts (in reading order); each part
// renders as its own card, and oversized single files are truncated.
import { escapeHtml, textToParagraphs, type TutorTerm } from "../util/html.js";
import { hoistProjectAnchors, languageForFile } from "../util/files.js";
import {
  assertValidPart,
  cardParts,
  cardSizeBudget,
  continuationNote,
  packByBudget,
  partTitle,
} from "../util/budget.js";
import { canRenderCodeFileView } from "../util/file-view.js";
import { buildTabCard, renderTabPanel, type TabSpec } from "./tabs.js";
import type { ContextAction, RenderedCard } from "./shell.js";

export interface TourFile {
  path: string;
  content: string;
  language?: string;
}

export interface CodeTourCardOptions {
  title: string;
  subtitle?: string;
  // Shown before the tabs; good for "start with src/main.rs" guidance.
  intro?: string;
  files: TourFile[];
  maxTabs?: number;
  // Which part of a multi-part tour to render (1-based, default 1).
  part?: number;
  // Rendered characters per part; defaults to cardSizeBudget().
  budget?: number;
  tutorTerms?: TutorTerm[];
  tutorTermsInCode?: boolean;
  contextActions?: ContextAction[];
}

const DEFAULT_MAX_TABS = 12;
const TAB_OVERHEAD = 400;
// A single file never fills a whole card by itself; beyond this the reader
// should ask for the specific file. Measured after rendering, like the budget
// itself, so neither a file dense in angle brackets nor a markdown file
// carrying two views of itself can slip through.
const TAB_CONTENT_CAP = 16_000;

function tabLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  return segments.length <= 2 ? normalized : segments.slice(-2).join("/");
}

// A markdown file is the one kind of source nobody wants to read as source by
// default: a README in a tour is documentation, not code. These files render
// as a page with a toggle back to the raw text; every other extension keeps
// the plain code block.
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd", "mdx"]);

export function isMarkdownFile(filePath: string): boolean {
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  return MARKDOWN_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
}

export function tabForFile(file: TourFile): TabSpec {
  const label = tabLabel(file.path);
  if (isMarkdownFile(file.path)) return { label, markdown: file.content };
  return {
    label,
    code: file.content,
    language: file.language ?? languageForFile(file.path),
    fileView: true,
  };
}

// What a file actually costs in the card, not what it costs on disk. Source
// is HTML-escaped into the tab panel, and a single "<" becomes four
// characters, so raw length under-counts markup-dense files badly enough to
// push a "small" tour past the host's result ceiling.
//
// A markdown file cannot be measured that way at all: its panel carries the
// rendered page AND the raw source, so its source length under-counts it by
// more than half. Those are measured on the panel that will actually be
// emitted, which is the only way the packer and the renderer cannot disagree.
function panelContentCost(file: TourFile): number {
  const tab = tabForFile(file);
  // A plain code block costs its escaped source. A markdown panel carries a
  // rendered page as well, and a highlighted panel carries a span per token
  // and a line-number gutter, so both are measured on the markup that will
  // actually be emitted.
  if (isMarkdownFile(file.path) || (tab.fileView && canRenderCodeFileView(tab.language))) {
    return renderTabPanel(tab).length;
  }
  return escapeHtml(file.content).length;
}

export function renderedTabCost(file: TourFile): number {
  return panelContentCost(file) + TAB_OVERHEAD;
}

function capContent(file: TourFile): TourFile {
  if (panelContentCost(file) <= TAB_CONTENT_CAP) return file;
  // Neither escaping nor markdown rendering is a fixed ratio, so converge on
  // a raw length whose rendered form fits instead of assuming one.
  let keep = TAB_CONTENT_CAP;
  for (let attempt = 0; attempt < 12 && keep > 200; attempt++) {
    if (panelContentCost({ ...file, content: file.content.slice(0, keep) }) <= TAB_CONTENT_CAP) break;
    keep = Math.floor(keep * 0.75);
  }
  const omitted = file.content.length - keep;
  return {
    ...file,
    content:
      file.content.slice(0, keep) +
      `\n... (truncated: ${omitted} more character(s); ask to see the rest of this file)`,
  };
}

// Deterministic packing shared by every part call with the same inputs, so
// the part numbers in a continuation note still mean the same thing when the
// model calls back for part 2. Files keep the caller's order (README and
// manifests hoisted first): an explicit list often encodes a teaching order,
// and archive-sourced files arrive already in reading order.
export function planTourParts(
  files: TourFile[],
  budget = cardSizeBudget(),
  maxTabs = DEFAULT_MAX_TABS,
): TourFile[][] {
  const ordered = hoistProjectAnchors(files.map((file) => file.path));
  const byPath = new Map(files.map((file) => [file.path, file]));
  const capped = ordered.map((path) => capContent(byPath.get(path) as TourFile));
  return packByBudget(capped, renderedTabCost, budget, maxTabs);
}

export function buildCodeTourCard(options: CodeTourCardOptions): RenderedCard {
  if (options.files.length === 0) {
    throw new Error("A code tour needs at least one file.");
  }
  const parts = planTourParts(
    options.files,
    options.budget ?? cardSizeBudget(),
    options.maxTabs ?? DEFAULT_MAX_TABS,
  );
  const totalParts = parts.length;
  const part = options.part ?? 1;
  assertValidPart(part, totalParts);
  const partFiles = parts[part - 1];
  const info = { part, totalParts };

  const tabs: TabSpec[] = partFiles.map(tabForFile);
  if (options.intro && part === 1) {
    tabs.unshift({ label: "Start here", html: textToParagraphs(options.intro) });
  }

  const card = buildTabCard({
    title: partTitle(options.title, info),
    subtitle:
      options.subtitle ??
      (totalParts > 1
        ? `Part ${part} of ${totalParts} · ${partFiles.length} of ${options.files.length} files`
        : undefined),
    tabs,
    tutorTerms: options.tutorTerms,
    tutorTermsInCode: options.tutorTermsInCode,
    contextActions: options.contextActions,
  });
  return {
    ...card,
    parts: cardParts(info),
    summary:
      `Created code tour card "${partTitle(options.title, info)}" with file tab(s): ` +
      partFiles.map((file) => file.path).join(", ") +
      "." +
      continuationNote("create_code_tour_card", info),
  };
}
