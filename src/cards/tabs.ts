import { escapeHtml, sanitizeHtml, textToParagraphs, uid, type TutorTerm } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface TabSpec {
  label: string;
  // Exactly one of html/text/code is used, checked in this order.
  html?: string;
  text?: string;
  code?: string;
  language?: string;
}

export interface TabCardOptions {
  title: string;
  subtitle?: string;
  tabs: TabSpec[];
  tutorTerms?: TutorTerm[];
  tutorTermsInCode?: boolean;
  contextActions?: ContextAction[];
}

function tabPanelContent(tab: TabSpec): string {
  if (tab.html) return sanitizeHtml(tab.html);
  if (tab.code !== undefined) {
    return (
      '<div class="mcc-codewrap">' +
      '<button type="button" class="mcc-btn mcc-copy-code">Copy</button>' +
      `<pre><code class="language-${escapeHtml(tab.language ?? "text")}">${escapeHtml(tab.code)}</code></pre>` +
      "</div>"
    );
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
        `aria-labelledby="${groupId}-tab-${index}"${hidden}>${tabPanelContent(tab)}</div>`
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
