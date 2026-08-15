// Hosts validate tool schemas against the MCP spec's default JSON Schema
// dialect, 2020-12. The SDK serializes this server's zod schemas through a
// vendored zod-to-json-schema that stamps every schema with
// "$schema": "http://json-schema.org/draft-07/schema#", and offers no way to
// change that from registerTool. A strict host whose validator supports only
// 2020-12 (GitHub Copilot is one) rejects every tool declaring another
// dialect before any call is dispatched - which in practice is exactly the
// card tools, because only they carry an outputSchema. Every construct the
// SDK emits for these schemas (type/properties/required/items/enum/anyOf/
// definitions/$ref) means the same thing in both dialects, so removing the
// stamp leaves a schema each host validates under its own default dialect
// and accepts.
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const DRAFT_07_DIALECT = "http://json-schema.org/draft-07/schema#";

// Only the known-equivalent draft-07 stamp is removed. A schema declaring
// any other dialect is left alone rather than silently misrepresented.
export function stripDraft07Dialect(schema: unknown): void {
  if (
    schema !== null &&
    typeof schema === "object" &&
    (schema as Record<string, unknown>)["$schema"] === DRAFT_07_DIALECT
  ) {
    delete (schema as Record<string, unknown>)["$schema"];
  }
}

interface ToolListLike {
  result?: { tools?: { inputSchema?: unknown; outputSchema?: unknown }[] };
}

// tools/list results are the only outgoing messages that carry schemas. The
// schema objects are freshly serialized per request, so editing them in
// place cannot bleed into the registered tool definitions.
export function normalizeToolListMessage<T>(message: T): T {
  const tools = (message as ToolListLike)?.result?.tools;
  if (Array.isArray(tools)) {
    for (const tool of tools) {
      stripDraft07Dialect(tool?.inputSchema);
      stripDraft07Dialect(tool?.outputSchema);
    }
  }
  return message;
}

// Wrap a transport so its outgoing tool listings carry dialect-neutral
// schemas. The send method is replaced on the transport itself, so the
// protocol layer's later onclose/onmessage wiring is untouched.
export function withInteroperableToolSchemas(transport: Transport): Transport {
  const send = transport.send.bind(transport);
  transport.send = (message, options) => send(normalizeToolListMessage(message), options);
  return transport;
}
