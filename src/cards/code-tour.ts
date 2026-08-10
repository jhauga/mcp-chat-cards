// Code tour card: presents a model-generated project as one tab per source
// file with copy buttons, so an archive the model produced earlier in the
// conversation becomes a browsable tutorial in a single tool call.
import { textToParagraphs, type TutorTerm } from "../util/html.js";
import { languageForFile, sortProjectFiles } from "../util/files.js";
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
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

const DEFAULT_MAX_TABS = 12;

function tabLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  return segments.length <= 2 ? normalized : segments.slice(-2).join("/");
}

export function buildCodeTourCard(options: CodeTourCardOptions): RenderedCard {
  if (options.files.length === 0) {
    throw new Error("A code tour needs at least one file.");
  }
  const maxTabs = options.maxTabs ?? DEFAULT_MAX_TABS;
  const ordered = sortProjectFiles(options.files.map((file) => file.path));
  const byPath = new Map(options.files.map((file) => [file.path, file]));
  const shown = ordered.slice(0, maxTabs);
  const omitted = ordered.length - shown.length;

  const tabs: TabSpec[] = shown.map((filePath) => {
    const file = byPath.get(filePath) as TourFile;
    return {
      label: tabLabel(filePath),
      code: file.content,
      language: file.language ?? languageForFile(filePath),
    };
  });
  if (options.intro) {
    tabs.unshift({ label: "Start here", html: textToParagraphs(options.intro) });
  }

  const card = buildTabCard({
    title: options.title,
    subtitle:
      options.subtitle ??
      (omitted > 0 ? `Showing ${shown.length} of ${ordered.length} files.` : undefined),
    tabs,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  return {
    ...card,
    summary:
      `Created code tour card "${options.title}" with ${shown.length} file tab(s)` +
      (omitted > 0 ? ` (${omitted} more file(s) omitted by the tab cap)` : "") +
      ".",
  };
}
