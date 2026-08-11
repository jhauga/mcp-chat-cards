// Card size budgeting. Hosts truncate oversized tool results instead of
// rendering them, so bulk card tools (documents, code tours) split content
// into parts that each stay under a budget of article-HTML characters. The
// model renders part 1, then calls the tool again for the remaining parts,
// giving each part its own card in the conversation.

export const DEFAULT_CARD_BUDGET = 32_000;

export function cardSizeBudget(): number {
  const fromEnv = Number(process.env.MCP_CHAT_CARDS_CARD_BUDGET ?? "");
  return Number.isFinite(fromEnv) && fromEnv >= 2000 ? fromEnv : DEFAULT_CARD_BUDGET;
}

// A host that receives a tool result over its own ceiling does not render a
// truncated card - it discards the result and writes it to a file, so the
// card never appears at all. Every result is measured against this limit
// before it leaves the server, so an oversized card is split or reported
// rather than emitted unrenderably. Budgets are in characters of serialized
// JSON, which is the unit hosts report in their own error messages.
export const DEFAULT_RESULT_LIMIT = 40_000;

export function resultCharLimit(): number {
  const fromEnv = Number(process.env.MCP_CHAT_CARDS_RESULT_LIMIT ?? "");
  return Number.isFinite(fromEnv) && fromEnv >= 4000 ? fromEnv : DEFAULT_RESULT_LIMIT;
}

// Actionable message for a card that cannot be shrunk automatically, so the
// caller knows which lever to pull instead of seeing a host-level failure.
export function oversizedCardError(kind: string, size: number, limit: number): Error {
  return new Error(
    `This ${kind} card renders to ${size} characters, over the ${limit} character limit a host ` +
      "will accept. Split the content across several cards: pass fewer rows, files, or sections " +
      "per call, or use a tool that takes a part number and render one part at a time.",
  );
}

// Greedy packing that preserves item order. A single oversized item still
// gets its own part rather than being dropped.
export function packByBudget<T>(
  items: T[],
  sizeOf: (item: T) => number,
  budget: number,
  maxItemsPerPart = Infinity,
): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    const itemSize = sizeOf(item);
    if (current.length > 0 && (size + itemSize > budget || current.length >= maxItemsPerPart)) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += itemSize;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export interface PartInfo {
  part: number;
  totalParts: number;
}

export function partTitle(baseTitle: string, info: PartInfo): string {
  return info.totalParts > 1 ? `${baseTitle} (part ${info.part} of ${info.totalParts})` : baseTitle;
}

// Standard continuation sentence appended to multi-part card summaries so
// the model knows to keep calling until every part is rendered.
export function continuationNote(toolName: string, info: PartInfo): string {
  if (info.part >= info.totalParts) return "";
  const remaining = info.totalParts - info.part;
  return (
    ` ${remaining} more part(s) remain: call ${toolName} again with part: ${info.part + 1} ` +
    "(keeping the other arguments identical) so the rest renders as its own card."
  );
}

export function assertValidPart(part: number, totalParts: number): void {
  if (part < 1 || part > totalParts) {
    throw new Error(`part must be between 1 and ${totalParts} for this content, got ${part}.`);
  }
}
