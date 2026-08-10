// Convert loosely structured text into table data. This is the modern
// replacement for the legacy changeToTable reference function: delimiter
// detection, column balancing, and header padding in a few pure functions.

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface TextToTableOptions {
  // Desired column count. When no cell delimiter is present, consecutive
  // lines are chunked into rows of this width (newlines mark cells).
  columns?: number;
  // Column titles. Padded with "Column N" when fewer than the column count.
  headers?: string[];
  // Explicit cell delimiter. When omitted, one is auto-detected.
  cellDelimiter?: string;
  // Row delimiter, newline by default.
  rowDelimiter?: string;
}

const CANDIDATE_DELIMITERS = ["\t", "|", ";", ","];

// Pick the first candidate delimiter that appears on most non-empty lines.
export function detectCellDelimiter(lines: string[]): string | null {
  if (lines.length === 0) return null;
  const threshold = Math.max(1, Math.ceil(lines.length * 0.6));
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const linesWithDelimiter = lines.filter((line) => line.includes(delimiter)).length;
    if (linesWithDelimiter >= threshold) return delimiter;
  }
  return null;
}

// Pad or trim header titles to exactly `count` columns.
export function balanceHeaders(headers: string[], count: number): string[] {
  const out = headers.slice(0, count).map((h) => h.trim());
  while (out.length < count) out.push(`Column ${out.length + 1}`);
  return out;
}

export function textToTable(text: string, options: TextToTableOptions = {}): TableData {
  const rowDelimiter = options.rowDelimiter ?? "\n";
  const lines = text
    .split(rowDelimiter)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    const width = options.columns ?? options.headers?.length ?? 1;
    return { headers: options.headers ? balanceHeaders(options.headers, width) : [], rows: [] };
  }

  const delimiter = options.cellDelimiter ?? detectCellDelimiter(lines);
  let rows: string[][];
  if (delimiter) {
    rows = lines.map((line) =>
      line
        .split(delimiter)
        .map((cell) => cell.trim())
        // Drop empty edge cells produced by markdown-style "| a | b |" rows.
        .filter((cell, index, cells) => cell.length > 0 || (index > 0 && index < cells.length - 1)),
    );
  } else {
    const columns = Math.max(1, options.columns ?? options.headers?.length ?? 2);
    rows = [];
    for (let i = 0; i < lines.length; i += columns) {
      rows.push(lines.slice(i, i + columns));
    }
  }

  const width = Math.max(
    1,
    options.columns ?? Math.max(options.headers?.length ?? 0, ...rows.map((row) => row.length)),
  );
  rows = rows.map((row) => {
    const cells = row.slice(0, width);
    while (cells.length < width) cells.push("");
    return cells;
  });

  return {
    headers: options.headers ? balanceHeaders(options.headers, width) : [],
    rows,
  };
}

// Ensure explicit row data is rectangular, padding short rows with blanks.
export function normalizeRows(rows: string[][], headers: string[] = []): TableData {
  const width = Math.max(1, headers.length, ...rows.map((row) => row.length));
  const balanced = rows.map((row) => {
    const cells = row.slice(0, width).map((cell) => String(cell ?? ""));
    while (cells.length < width) cells.push("");
    return cells;
  });
  return {
    headers: headers.length > 0 ? balanceHeaders(headers, width) : [],
    rows: balanced,
  };
}
