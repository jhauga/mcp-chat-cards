import { escapeHtml, looksLikeUrl, type TutorTerm } from "../util/html.js";
import { normalizeRows, textToTable, type TableData } from "../util/text-to-table.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface TableCardOptions {
  title: string;
  subtitle?: string;
  caption?: string;
  headers?: string[];
  // Explicit row data takes precedence over raw text conversion.
  rows?: string[][];
  // Raw text converted with delimiter detection and column balancing.
  text?: string;
  columns?: number;
  cellDelimiter?: string;
  // Zero-based column indexes whose cell values render as links.
  linkColumns?: number[];
  // Automatically render URL-shaped cell values as links (default true).
  autoLinkUrls?: boolean;
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

function renderCell(value: string, columnIndex: number, options: TableCardOptions): string {
  const autoLink = options.autoLinkUrls !== false;
  const isLinkColumn = options.linkColumns?.includes(columnIndex) ?? false;
  if ((isLinkColumn || autoLink) && looksLikeUrl(value)) {
    const href = escapeHtml(value.trim());
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>`;
  }
  return escapeHtml(value);
}

export function tableDataToHtml(data: TableData, options: TableCardOptions): string {
  const caption = options.caption ? `<caption>${escapeHtml(options.caption)}</caption>` : "";
  const thead =
    data.headers.length > 0
      ? `<thead><tr>${data.headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead>`
      : "";
  const tbody = data.rows
    .map(
      (row) =>
        `<tr>${row.map((cell, index) => `<td>${renderCell(cell, index, options)}</td>`).join("")}</tr>`,
    )
    .join("\n");
  return `<div class="mcc-table-scroll"><table class="mcc-table">${caption}${thead}<tbody>
${tbody}
</tbody></table></div>`;
}

export function buildTableCard(options: TableCardOptions): RenderedCard {
  const data: TableData =
    options.rows && options.rows.length > 0
      ? normalizeRows(options.rows, options.headers ?? [])
      : textToTable(options.text ?? "", {
          columns: options.columns,
          headers: options.headers,
          cellDelimiter: options.cellDelimiter,
        });

  const body = `<section class="mcc-block">
${tableDataToHtml(data, options)}
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "table",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  return {
    ...doc,
    summary:
      `Created table card "${options.title}" with ${data.rows.length} row(s)` +
      ` and ${Math.max(data.headers.length, data.rows[0]?.length ?? 0)} column(s).`,
  };
}
