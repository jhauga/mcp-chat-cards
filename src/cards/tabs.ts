import {
  escapeHtml,
  renderCodeBlock,
  sanitizeHtml,
  textToParagraphs,
  uid,
  type TutorTerm,
} from "../util/html.js";
import { renderMarkdownFileView } from "../util/markdown.js";
import { canRenderCodeFileView, renderCodeFileView } from "../util/file-view.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface TabSpec {
  label: string;
  // Exactly one of markdown/html/text/code is used, checked in this order.
  // markdown renders the document as a page with a Raw/Rendered toggle back
  // to its source; code renders the source alone.
  markdown?: string;
  html?: string;
  text?: string;
  code?: string;
  language?: string;
  // Render code as a repository-style file view: highlighted, line-numbered,
  // with a Raw toggle. Off by default, so an ordinary tab card keeps the
  // plain code block it has always had.
  fileView?: boolean;
}

export interface TabCardOptions {
  title: string;
  subtitle?: string;
  tabs: TabSpec[];
  tutorTerms?: TutorTerm[];
  tutorTermsInCode?: boolean;
  contextActions?: ContextAction[];
}

export function renderTabPanel(tab: TabSpec): string {
  // Rendered markdown is sanitized on the way out of the markdown pipeline,
  // so it is not run through sanitizeHtml a second time: that pass strips
  // the style attributes and would re-serialize markup already known good.
  if (tab.markdown !== undefined) return renderMarkdownFileView(tab.markdown, tab.label);
  if (tab.html) return sanitizeHtml(tab.html);
  if (tab.code !== undefined) {
    // Without a grammar the two views would be identical, so the toggle is
    // only offered when it actually does something.
    if (tab.fileView && canRenderCodeFileView(tab.language)) {
      return renderCodeFileView(tab.code, tab.language, tab.label);
    }
    return renderCodeBlock(tab.code, tab.language);
  }
  return textToParagraphs(tab.text ?? "");
}

export function buildTabCard(options: TabCardOptions): RenderedCard {
  const groupId = uid("tabs");
  const buttons = options.tabs
    .map((tab, index) => {
      const selected = index === 0 ? "true" : "false";
      return (
        `<button type="button" class="mcc-tab" role="tab" id="${groupId}-tab-${index}" ` +
        `aria-selected="${selected}" aria-controls="${groupId}-panel-${index}">` +
        `${escapeHtml(tab.label)}</button>`
      );
    })
    .join("\n");
  const panels = options.tabs
    .map((tab, index) => {
      const hidden = index === 0 ? "" : " hidden";
      return (
        `<div class="mcc-panel" role="tabpanel" id="${groupId}-panel-${index}" ` +
        `aria-labelledby="${groupId}-tab-${index}"${hidden}>${renderTabPanel(tab)}</div>`
      );
    })
    .join("\n");

  const body = `<section class="mcc-block mcc-tabs">
<div role="tablist" aria-label="${escapeHtml(options.title)}">
${buttons}
</div>
${panels}
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "tabs",
    body,
    tutorTerms: options.tutorTerms,
    tutorTermsInCode: options.tutorTermsInCode,
    contextActions: options.contextActions,
  });
  const labels = options.tabs.map((tab) => tab.label).join(", ");
  return {
    ...doc,
    summary: `Created tab card "${options.title}" with ${options.tabs.length} tab(s): ${labels}.`,
  };
}
