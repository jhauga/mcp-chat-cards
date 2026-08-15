// Code tour card: presents a model-generated project as one tab per source
// file with copy buttons, so an archive the model produced earlier in the
// conversation becomes a browsable tutorial. Projects larger than the card
// size budget are split into multiple parts (in reading order); each part
// renders as its own card, and oversized single files are truncated.
import { escapeHtml, textToParagraphs, type TutorTerm } from "../util/html.js";
import { hoistProjectAnchors, languageForFile } from "../util/files.js";
import {
  assertValidPart,
  cardSizeBudget,
  continuationNote,
  packByBudget,
  partTitle,
} from "../util/budget.js";
import { buildTabCard, type TabSpec } from "./tabs.js";
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
  tutorTerms?: TutorTerm[];
  tutorTermsInCode?: boolean;
  contextActions?: ContextAction[];
}

const DEFAULT_MAX_TABS = 12;
const TAB_OVERHEAD = 400;
// A single file never fills a whole card by itself; beyond this the reader
// should ask for the specific file. Measured after escaping, like the budget
// itself, so a file dense in angle brackets and quotes cannot slip through.
const TAB_CONTENT_CAP = 16_000;

function tabLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  return segments.length <= 2 ? normalized : segments.slice(-2).join("/");
}

// What a file actually costs in the card, not what it costs on disk. Source
// is HTML-escaped into the tab panel, and a single "<" becomes four
// characters, so raw length under-counts markup-dense files badly enough to
// push a "small" tour past the host's result ceiling.
export function renderedTabCost(file: TourFile): number {
  return escapeHtml(file.content).length + TAB_OVERHEAD;
}

function capContent(file: TourFile): TourFile {
  if (escapeHtml(file.content).length <= TAB_CONTENT_CAP) return file;
  // Escaping is not a fixed ratio, so converge on a raw length whose escaped
  // form fits instead of assuming one.
  let keep = TAB_CONTENT_CAP;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (escapeHtml(file.content.slice(0, keep)).length <= TAB_CONTENT_CAP) break;
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
    cardSizeBudget(),
    options.maxTabs ?? DEFAULT_MAX_TABS,
  );
  const totalParts = parts.length;
  const part = options.part ?? 1;
  assertValidPart(part, totalParts);
  const partFiles = parts[part - 1];
  const info = { part, totalParts };

  const tabs: TabSpec[] = partFiles.map((file) => ({
    label: tabLabel(file.path),
    code: file.content,
    language: file.language ?? languageForFile(file.path),
  }));
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
    summary:
      `Created code tour card "${partTitle(options.title, info)}" with file tab(s): ` +
      partFiles.map((file) => file.path).join(", ") +
      "." +
      continuationNote("create_code_tour_card", info),
  };
}
