// One file, shown more than one way, with a toggle between the views - the
// arrangement a repository browser uses. Two kinds exist:
//
//   code      Code (highlighted, with a line-number gutter) | Raw (plain)
//   markdown  Rendered (as a page)                          | Raw (source)
//
// They differ in how the second view is produced, and that difference is
// worth keeping. Rendered markdown is a different document from its source,
// so both have to ship. Highlighted code is the SAME text as its raw form -
// only the colors and the gutter differ - so the raw view is the code view
// with its styling switched off, and the card carries one copy instead of
// two. Both are driven by the same data attributes, so the runtime has one
// toggle to implement:
//
//   data-mcc-view      on the wrapper: which view is showing (CSS hook)
//   data-mcc-view-set  on a toggle button: the view it selects
//   data-mcc-pane      on a pane: the view it belongs to, when panes differ
import { escapeHtml } from "./html.js";
import { highlightCode, isHighlightable } from "./highlight.js";

export interface ViewOption {
  // Value written to data-mcc-view when this option is chosen.
  name: string;
  label: string;
}

// The toggle bar. Options render in the order given; `active` is the view the
// card arrives in, which is not necessarily the first button - "Raw | Code"
// reads in that order but opens on Code, the way a repository browser does.
export function renderViewBar(options: ViewOption[], active: string, label?: string): string {
  const group = label ? ` aria-label="View mode for ${escapeHtml(label)}"` : "";
  const buttons = options
    .map((option) => {
      const on = option.name === active;
      return (
        `<button type="button" class="mcc-btn mcc-fileview-btn${on ? " mcc-active" : ""}" ` +
        `data-mcc-view-set="${escapeHtml(option.name)}" aria-pressed="${on ? "true" : "false"}">` +
        `${escapeHtml(option.label)}</button>`
      );
    })
    .join("\n");
  return `<div class="mcc-fileview-bar" role="group"${group}>\n${buttons}\n</div>`;
}

export function renderFileView(options: {
  viewOptions: ViewOption[];
  active: string;
  label?: string;
  extraClass?: string;
  body: string;
}): string {
  const extra = options.extraClass ? ` ${options.extraClass}` : "";
  return `<div class="mcc-fileview${extra}" data-mcc-view="${escapeHtml(options.active)}">
${renderViewBar(options.viewOptions, options.active, options.label)}
${options.body}
</div>`;
}

// Line numbers live in their own gutter rather than wrapping every line in a
// span: a span per line costs about seven times as much markup, and the card
// size budget is the scarce resource here. The gutter is aria-hidden and
// unselectable, and it is a sibling of the code, so the copy button still
// hands back the file and nothing else.
function lineGutter(lineCount: number): string {
  const numbers: string[] = [];
  for (let line = 1; line <= lineCount; line++) numbers.push(String(line));
  return `<pre class="mcc-gutter" aria-hidden="true">${numbers.join("\n")}</pre>`;
}

export function renderCodeFileView(code: string, language: string | undefined, label?: string): string {
  const languageClass = escapeHtml(language ?? "text");
  const lineCount = code.split("\n").length;
  const body = `<div class="mcc-fileview-pane" data-mcc-pane="code">
<div class="mcc-codewrap">
<button type="button" class="mcc-btn mcc-copy-code">Copy</button>
<div class="mcc-code-scroll">
${lineGutter(lineCount)}
<pre class="mcc-code"><code class="language-${languageClass}">${highlightCode(code, language)}</code></pre>
</div>
</div>
</div>`;

  return renderFileView({
    // "Raw | Code" reads left to right; Code is what the file opens in.
    viewOptions: [
      { name: "raw", label: "Raw" },
      { name: "code", label: "Code" },
    ],
    active: "code",
    label,
    extraClass: "mcc-codefile",
    body,
  });
}

// Whether a file is worth offering the toggle for at all. Without a grammar
// the two views would be identical, and a toggle that does nothing is worse
// than no toggle.
export function canRenderCodeFileView(language: string | undefined): boolean {
  return isHighlightable(language);
}
