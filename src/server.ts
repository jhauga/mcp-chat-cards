import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildTabCard } from "./cards/tabs.js";
import { buildTableCard } from "./cards/table.js";
import { buildFormCard, type FieldSpec } from "./cards/form.js";
import { buildChartCard } from "./cards/chart.js";
import { buildVideoCard } from "./cards/video.js";
import { buildMotionCard, type MotionScene } from "./cards/motion.js";
import { buildRevealCard } from "./cards/reveal.js";
import { buildListCard, type ListItem } from "./cards/list.js";
import type { RenderedCard } from "./cards/shell.js";
import {
  buildCardTemplateHtml,
  CARD_TEMPLATE_URI,
  MCP_APP_MIME_TYPE,
} from "./cards/app-template.js";
import { buildInsertBookmarklet } from "./cards/insert-bookmarklet.js";
import { buildMarkdownCard } from "./cards/doc.js";
import { buildCodeTourCard, type TourFile } from "./cards/code-tour.js";
import { safeFetch, FetchError } from "./fetcher/fetch.js";
import { extractPage } from "./fetcher/extract.js";
import { readLocalTextFile } from "./util/files.js";
import { readArchive } from "./util/archive.js";
import { oversizedCardError, resultCharLimit } from "./util/budget.js";

export const SERVER_VERSION = "0.1.0-alpha";

const SERVER_INSTRUCTIONS = `mcp-chat-cards renders interactive HTML cards inside the chat.
Use these tools whenever the conversation involves research, education, professional or
hobbyist skills (programming, woodworking, arts, and similar), professional topics, history,
or news - or related subjects - and a table, tab box, chart, form, video, collapsible
outline, or mirrored website form would communicate better than plain text.

Card tools are linked to an MCP Apps UI template (ui://mcp-chat-cards/card.html), so hosts
that support the MCP Apps extension render each card inline in the conversation as a
sandboxed iframe. Interactive elements talk back to the host (form submissions arrive as
the next user prompt), so card forms are also useful to collect context that directs the
rest of the conversation.

Every card tool returns the same shape: a short text summary plus structuredContent
{"card":{"articleHtml","config"}}, which is what the template paints. Hosts without Apps
support also get a link to ui://mcp-chat-cards/html/<card-id>; read that resource for the
same card as a standalone HTML document. The document is NOT inlined in the result,
because its theme and runtime are identical in every card and repeating them crowds out
the conversation.

Rendering surface: cards render inline in the Claude desktop sidebar. Other surfaces
(mobile and web) show the text summary instead, so keep each summary meaningful on its
own and state any conclusion the card is making in the conversation as well.

TEXT FIELDS TAKE PLAIN TEXT. Titles, labels, cell values, and tips are escaped by this
server. Do not pre-escape them: pass "Predict, Spot & Fix", not "Predict, Spot &amp; Fix".

Paths resolve on the machine running THIS server, not in your own sandbox. If the file
you want lives only in your environment, pass its content inline (markdown/files) rather
than a path; read_local_file and unpack_archive read the server's filesystem and are
useful only for files that are already there.

Large content is split automatically into multi-part cards so results stay small enough
for hosts to render (the ceiling is about 40,000 characters of serialized result). When a
card result says more parts remain, immediately call the same tool again with the
indicated part number (keeping the other arguments identical) until every part has
rendered as its own card. A card that cannot be split reports how far over the limit it
is; split the input across several cards rather than retrying.`;

// Shared zod fragments -------------------------------------------------

const tutorTermsSchema = z
  .array(z.object({ term: z.string().min(1), tip: z.string().optional() }))
  .optional()
  .describe(
    "Educational tutor terms. The first occurrence of each term in the card's visible prose is " +
      "underlined; hovering ~1.2s shows the tip and notifies the host so the model can follow up. " +
      "Terms are matched once per card, longest first, and never inside code samples, tooltips, " +
      "or another term's tip. Term and tip are PLAIN text.",
  );

const contextActionsSchema = z
  .array(z.object({ label: z.string().min(1), prompt: z.string().min(1) }))
  .optional()
  .describe(
    "Right-click menu actions the model anticipates being useful. Choosing one sends its prompt " +
      "to the conversation; use {{selection}} to include the user's selected text.",
  );

const listItemSchema: z.ZodType<ListItem> = z.lazy(() =>
  z.object({
    text: z.string().min(1),
    children: z.array(listItemSchema).optional(),
  }),
);

// Marks a tool as rendering through the MCP Apps card template so
// supporting hosts display the result inline in the conversation.
const CARD_UI_META = { ui: { resourceUri: CARD_TEMPLATE_URI } };

// Declared on every card tool. Without an output schema hosts treat the
// result as text-only and drop structuredContent - and structuredContent is
// the only thing the Apps template can paint from.
const CARD_OUTPUT_SCHEMA = {
  card: z.object({
    articleHtml: z.string().describe("Card markup rendered inline by the Apps template"),
    config: z.object({
      id: z.string(),
      kind: z.string(),
      dwellMs: z.number(),
      contextActions: z.array(z.object({ label: z.string(), prompt: z.string() })),
      draggable: z.boolean(),
    }),
  }),
};

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// Where a rendered card's standalone HTML document can be read back. Kept off
// the ui://mcp-chat-cards/<id> shape the template itself uses so the two
// never collide in a host's resource table.
export const CARD_HTML_URI_PREFIX = "ui://mcp-chat-cards/html/";

export function cardHtmlUri(cardId: string): string {
  return `${CARD_HTML_URI_PREFIX}${cardId}`;
}

// Opt-in escape hatch for a host that cannot follow a resource link and needs
// the whole standalone document inlined in the tool result.
export function embedStandaloneHtml(): boolean {
  const value = (process.env.MCP_CHAT_CARDS_EMBED_HTML ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "always";
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "mcp-chat-cards", version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  // Standalone documents for recently rendered cards, readable at
  // ui://mcp-chat-cards/html/<id>. Bounded, because a long conversation would
  // otherwise pin every card it ever rendered in memory.
  const RECENT_CARD_LIMIT = 24;
  const recentCards = new Map<string, string>();

  const rememberCard = (card: RenderedCard): void => {
    recentCards.set(card.id, card.html);
    for (const id of recentCards.keys()) {
      if (recentCards.size <= RECENT_CARD_LIMIT) break;
      recentCards.delete(id);
    }
  };

  // Hosts that declared the MCP Apps extension render cards from
  // structuredContent via the template, so the bulky embedded-resource
  // fallback would only double the payload for them.
  const clientSupportsApps = (): boolean => {
    const capabilities = server.server.getClientCapabilities() as
      | { extensions?: Record<string, unknown> }
      | undefined;
    return Boolean(capabilities?.extensions?.["io.modelcontextprotocol/ui"]);
  };

  const cardResult = (card: RenderedCard): CallToolResult => {
    rememberCard(card);
    const appsHost = clientSupportsApps();
    // The standalone document repeats the same ~16KB of theme and runtime in
    // every card on top of markup that structuredContent already carries.
    // Echoing it inline floods the caller's context and is what pushes a
    // normal card past the host's result ceiling, so it is offered as a link
    // to a readable resource instead. A host that cannot follow a link can
    // ask for the inline copy with MCP_CHAT_CARDS_EMBED_HTML=1.
    const uri = cardHtmlUri(card.id);
    const content: CallToolResult["content"] = [
      {
        type: "text",
        text:
          `${card.summary}\n` +
          (appsHost
            ? "The card renders inline via the MCP Apps template."
            : "The card renders inline via the MCP Apps template on supporting hosts. " +
              `Read ${uri} for the same card as a standalone HTML document.`),
      },
    ];
    if (!appsHost) {
      if (embedStandaloneHtml()) {
        content.push({
          type: "resource",
          resource: { uri, mimeType: "text/html", text: card.html },
        });
      } else {
        content.push({
          type: "resource_link",
          uri,
          name: `${card.config.kind} card (standalone HTML)`,
          mimeType: "text/html",
        });
      }
    }
    const result: CallToolResult = {
      content,
      // Consumed by the MCP Apps card template (see app-template.ts).
      structuredContent: {
        card: { articleHtml: card.articleHtml, config: card.config },
      },
    };
    // Measured last, so the check covers exactly what goes over the wire. A
    // host discards an oversized result rather than truncating it, so an
    // actionable error is strictly better than emitting one.
    const limit = resultCharLimit();
    const size = JSON.stringify(result).length;
    if (size > limit) throw oversizedCardError(card.config.kind, size, limit);
    return result;
  };

  // Pre-declared MCP Apps UI template (SEP-1865). Hosts supporting the Apps
  // extension read this once and render it inline for every linked tool call.
  server.registerResource(
    "card-template",
    CARD_TEMPLATE_URI,
    {
      title: "Chat card template",
      description:
        "MCP Apps template that renders mcp-chat-cards tool results inline in the conversation.",
      mimeType: MCP_APP_MIME_TYPE,
      _meta: { ui: { prefersBorder: true } },
    },
    async () => ({
      contents: [
        {
          uri: CARD_TEMPLATE_URI,
          mimeType: MCP_APP_MIME_TYPE,
          text: buildCardTemplateHtml(SERVER_VERSION),
        },
      ],
    }),
  );

  // Standalone HTML for a card the server rendered earlier. Hosts without
  // MCP Apps support get a link to this instead of ~16KB of theme and runtime
  // repeated inline in every single tool result.
  server.registerResource(
    "card-html",
    new ResourceTemplate(`${CARD_HTML_URI_PREFIX}{cardId}`, { list: undefined }),
    {
      title: "Rendered card (standalone HTML)",
      description:
        "Self-contained HTML document for a card this server rendered earlier in the " +
        "conversation, for hosts that cannot render the card inline.",
      mimeType: "text/html",
    },
    async (uri, variables) => {
      const cardId = String(variables.cardId ?? "");
      const html = recentCards.get(cardId);
      if (!html) {
        throw new Error(
          `No rendered card with id "${cardId}" is still available. Call the card tool again.`,
        );
      }
      return { contents: [{ uri: uri.href, mimeType: "text/html", text: html }] };
    },
  );

  server.registerTool(
    "create_tab_card",
    {
      title: "Create tab card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render an interactive card with tabs, each showing a different context of the same subject " +
        "(for example one tab per programming language, OS, or skill level). Tab content can be " +
        "plain text, HTML, or code with a copy button.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        tabs: z
          .array(
            z.object({
              label: z.string().min(1),
              html: z.string().optional().describe("HTML content (sanitized)"),
              text: z.string().optional().describe("Plain text content"),
              code: z.string().optional().describe("Code sample shown with a copy button"),
              language: z.string().optional().describe("Language for the code sample"),
            }),
          )
          .min(1),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildTabCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_table_card",
    {
      title: "Create table card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render an HTML table card from explicit rows, or convert loosely delimited text into a " +
        "balanced table (delimiter auto-detected; newlines can mark cells). URL cells become links.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        caption: z.string().optional(),
        headers: z.array(z.string()).optional().describe("Column titles; padded if fewer than columns"),
        rows: z.array(z.array(z.string())).optional().describe("Explicit cell data, row-major"),
        text: z.string().optional().describe("Raw text to convert when rows are not given"),
        columns: z.number().int().min(1).max(12).optional(),
        cellDelimiter: z.string().optional(),
        linkColumns: z.array(z.number().int().min(0)).optional(),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        if ((!args.rows || args.rows.length === 0) && !args.text) {
          throw new Error("Provide either rows or text.");
        }
        return cardResult(buildTableCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_form_card",
    {
      title: "Create form card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a form card the user fills in to give the conversation context and direction. " +
        "Submitting sends the values back to the chat as the next prompt (optionally shaped by " +
        "promptTemplate with {{fieldName}} tokens).",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        submitLabel: z.string().optional(),
        promptTemplate: z
          .string()
          .optional()
          .describe("Prompt sent on submit; {{fieldName}} tokens are replaced with values"),
        fields: z
          .array(
            z.object({
              name: z.string().min(1),
              label: z.string().optional(),
              type: z
                .enum(["text", "textarea", "select", "checkbox", "radio", "number", "email", "url", "date", "hidden"])
                .optional(),
              options: z
                .array(z.union([z.string(), z.object({ label: z.string(), value: z.string().optional() })]))
                .optional(),
              required: z.boolean().optional(),
              placeholder: z.string().optional(),
              value: z.string().optional(),
              help: z.string().optional(),
            }),
          )
          .min(1),
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildFormCard({ ...args, fields: args.fields as FieldSpec[] }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_chart_card",
    {
      title: "Create chart card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a dynamically generated SVG chart card (bar, line, pie, or donut) with a legend and " +
        "a collapsible data table. Use for useful graphics summarizing referenced data.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        type: z.enum(["bar", "line", "pie", "donut"]),
        labels: z.array(z.string()).optional().describe("X-axis labels (bar/line)"),
        series: z
          .array(z.object({ name: z.string(), values: z.array(z.number()) }))
          .optional()
          .describe("Data series (bar/line)"),
        values: z
          .array(z.object({ label: z.string(), value: z.number().min(0) }))
          .optional()
          .describe("Slices (pie/donut)"),
        yLabel: z.string().optional(),
        description: z.string().optional(),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        if ((args.type === "pie" || args.type === "donut") && (!args.values || args.values.length === 0)) {
          throw new Error("Pie and donut charts require values.");
        }
        if ((args.type === "bar" || args.type === "line") && (!args.series?.length || !args.labels?.length)) {
          throw new Error("Bar and line charts require labels and series.");
        }
        return cardResult(buildChartCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_video_card",
    {
      title: "Create video card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a card with an HTML video player for a short clip. src must point straight at a " +
        "video file (mp4/webm), not a streaming platform page: a direct http(s) URL, a small " +
        "data:video/* URI, or a blob: URL. When no direct video source exists, use " +
        "create_animation_card to generate an animated clip instead.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        src: z
          .string()
          .min(1)
          .describe("Direct http(s) URL to a video file, a data:video/* URI, or a blob: URL"),
        poster: z
          .string()
          .min(1)
          .optional()
          .describe("Still image shown before playback: http(s) URL or data:image/* URI"),
        description: z.string().optional(),
        loop: z.boolean().optional(),
        muted: z.boolean().optional(),
        autoplay: z.boolean().optional().describe("Start muted playback on render"),
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildVideoCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_animation_card",
    {
      title: "Create animation card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a short animated clip as a card when no direct video URL exists but motion would " +
        "communicate better than static content - explanations, walkthroughs, and data stories. " +
        "Scenes play sequentially in a 16:9 stage with play/pause, replay, and progress controls; " +
        "everything is generated text, SVG shapes, and CSS animation (no external assets). " +
        "Compose classic clip patterns and vary them per conversation: title reveal into bullet " +
        "build (fade/slide), diagram walk-through with arrows tracing in (draw), a chart that " +
        "zooms into the label range under discussion and back out (chart.zoom), and a closing " +
        "takeaway scene (zoom). Mix scene kinds freely; per-scene transition and duration make " +
        "endless variations from the same schema.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        autoplay: z.boolean().optional().describe("Start playing on render (default true)"),
        loop: z.boolean().optional().describe("Restart from scene 1 after the last scene"),
        sceneDurationMs: z
          .number()
          .int()
          .min(1200)
          .max(20000)
          .optional()
          .describe("Default per-scene duration in ms (default 3500)"),
        scenes: z
          .array(
            z.object({
              heading: z.string().optional(),
              text: z.string().optional(),
              bullets: z
                .array(z.string())
                .max(6)
                .optional()
                .describe("Bullet points that build in one after another"),
              transition: z
                .enum(["fade", "slide", "zoom", "draw"])
                .optional()
                .describe("Scene entry animation; 'draw' traces shapes and chart lines in"),
              durationMs: z.number().int().min(1200).max(20000).optional(),
              shapes: z
                .array(
                  z.object({
                    type: z.enum(["rect", "circle", "line", "arrow"]),
                    x: z.number().min(0).max(100).describe("Percent from left"),
                    y: z.number().min(0).max(100).describe("Percent from top"),
                    w: z.number().min(0).max(100).optional(),
                    h: z.number().min(0).max(100).optional(),
                    r: z.number().min(0).max(100).optional(),
                    x2: z.number().min(0).max(100).optional().describe("Line/arrow end"),
                    y2: z.number().min(0).max(100).optional(),
                    label: z.string().optional(),
                    color: z.string().optional().describe("Hex color, e.g. #2b6cb0"),
                  }),
                )
                .max(12)
                .optional()
                .describe("Simple diagram shapes on a 100x100 percent grid"),
              chart: z
                .object({
                  type: z.enum(["bar", "line"]),
                  labels: z.array(z.string()).min(1).max(24),
                  values: z.array(z.number()).min(1).max(24),
                  zoom: z
                    .object({
                      from: z.number().int().min(0),
                      to: z.number().int().min(0),
                    })
                    .optional()
                    .describe("Label index range the camera zooms into mid-scene, then back out"),
                })
                .optional()
                .describe("Compact single-series chart animated inside the scene"),
            }),
          )
          .min(1)
          .max(12),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildMotionCard({ ...args, scenes: args.scenes as MotionScene[] }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_reveal_card",
    {
      title: "Create show/hide card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a card of collapsible show/hide sections with show-all/hide-all buttons. Good for " +
        "step-by-step guides, FAQs, spoilers, and long reference material.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        sections: z
          .array(
            z.object({
              heading: z.string().min(1),
              html: z.string().optional(),
              text: z.string().optional(),
              open: z.boolean().optional(),
            }),
          )
          .min(1),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildRevealCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_list_card",
    {
      title: "Create sequential list card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a nested ordered list card with hierarchical numbering (1., 1.1., 1.1.1.). Good for " +
        "procedures, outlines, and curricula.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        intro: z.string().optional(),
        items: z.array(listItemSchema).min(1),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        return cardResult(buildListCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_markdown_card",
    {
      title: "Create document card from markdown",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a markdown document as one interactive card: tables become card tables, fenced " +
        "code gets copy buttons, and H2 sections fold into show/hide reveals. Pass either the " +
        "markdown content or the path of a markdown file generated earlier in the conversation " +
        "(for example a walkthrough or guide) to plug it into the chat in one call. Long " +
        "documents split at H2 boundaries into parts of about 32,000 characters each.",
      inputSchema: {
        markdown: z.string().optional().describe("Markdown content to render"),
        path: z
          .string()
          .optional()
          .describe(
            "Path to a markdown file ON THE MACHINE RUNNING THIS SERVER, not in the caller's " +
              "sandbox. Over a remote bridge those are different machines: if the file exists " +
              "only on your side, pass its text as markdown instead.",
          ),
        title: z.string().optional().describe("Card title; defaults to the document's first H1"),
        subtitle: z.string().optional(),
        splitSections: z.boolean().optional().describe("Fold H2 sections into reveals (default true)"),
        openFirst: z.boolean().optional().describe("Open the first section initially (default true)"),
        part: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Part number for large documents (1-based). Long documents split automatically; " +
              "when the result says more parts remain, call again with the next part.",
          ),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        let markdown = args.markdown;
        let truncatedNote = "";
        if (!markdown && args.path) {
          const file = await readLocalTextFile(args.path);
          markdown = file.content;
          if (file.truncated) truncatedNote = " The source file was truncated at the size cap.";
        }
        if (!markdown) {
          throw new Error("Provide either markdown content or a path to a markdown file.");
        }
        const card = buildMarkdownCard({ ...args, markdown });
        const result = cardResult(card);
        if (truncatedNote && result.content[0]?.type === "text") {
          result.content[0].text += truncatedNote;
        }
        return result;
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_code_tour_card",
    {
      title: "Create code tour card",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Render a project's source as an interactive card with one tab per file (code with copy " +
        "buttons, ordered README, manifest, then src). Pass the path of a zip archive generated " +
        "earlier in the conversation for a one-call plug-n-play tour, or pass files explicitly. " +
        "Files are packed into parts of about 32,000 rendered characters each regardless of how " +
        "many there are, so a handful of medium files still splits; when the result says more " +
        "parts remain, call again with the next part.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        intro: z.string().optional().describe("Guidance shown in a leading 'Start here' tab"),
        archivePath: z
          .string()
          .optional()
          .describe(
            "Path to a zip ON THE MACHINE RUNNING THIS SERVER, not in the caller's sandbox. " +
              "Over a remote bridge those are different machines: if the archive exists only on " +
              "your side, pass its text files as files instead.",
          ),
        files: z
          .array(
            z.object({
              path: z.string().min(1),
              content: z.string(),
              language: z.string().optional(),
            }),
          )
          .optional()
          .describe("Explicit files to show when not using archivePath"),
        include: z
          .array(z.string())
          .optional()
          .describe("With archivePath: only include entries whose path contains one of these"),
        maxTabs: z.number().int().min(1).max(24).optional(),
        tutorTermsInCode: z
          .boolean()
          .optional()
          .describe(
            "Also highlight tutorTerms inside the code samples. Off by default, because marking " +
              "up language keywords in source is noise rather than teaching.",
          ),
        part: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Part number for large projects (1-based). Big tours split automatically; " +
              "when the result says more parts remain, call again with the next part.",
          ),
        tutorTerms: tutorTermsSchema,
        contextActions: contextActionsSchema,
      },
    },
    async (args) => {
      try {
        let files: TourFile[] = args.files ?? [];
        let skippedNote = "";
        if (files.length === 0 && args.archivePath) {
          const archive = await readArchive(args.archivePath, { include: args.include });
          files = archive.files.map((file) => ({
            path: file.path,
            content: file.content,
            language: file.language,
          }));
          if (archive.skipped.length > 0) {
            skippedNote = `\nSkipped from the archive: ${archive.skipped.join(", ")}.`;
          }
        }
        if (files.length === 0) {
          throw new Error("Provide either files or an archivePath containing text files.");
        }
        const card = buildCodeTourCard({ ...args, files });
        const result = cardResult(card);
        if (skippedNote && result.content[0]?.type === "text") {
          result.content[0].text += skippedNote;
        }
        return result;
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_insert_bookmarklet",
    {
      title: "Get the Insert Card bookmarklet",
      description:
        "Return the Insert Card bookmarklet and usage instructions. Browsers do not let page " +
        "script extend the native right-click menu, so this bookmarklet is how a copied card gets " +
        "placed visually: after the user copies a card (right-click menu \"Copy card\" or the " +
        "header button), running the bookmarklet on the host page shows an \"Insert Card\" item " +
        "beside every right-click, which injects the copied card at that spot. The insertion is " +
        "cosmetic and page-local (gone on reload, not part of the conversation history). Call " +
        "this when the user asks how to place a card at an arbitrary spot on the page.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text:
            "Insert Card bookmarklet - give these steps and the link to the user:\n" +
            "1. Create a new bookmark in the browser and paste the javascript: link below as its URL " +
            "(works in browser hosts; the desktop app has no bookmarks bar).\n" +
            '2. Right-click a card and choose "Copy card" (or use the header button).\n' +
            "3. Click the bookmark once on the conversation page to activate it.\n" +
            '4. Right-click the spot where the card should appear and click the floating "Insert Card" item.\n' +
            "The inserted card is a page-local preview only - it disappears on reload and is not part " +
            "of the conversation history.\n\n" +
            buildInsertBookmarklet(),
        },
      ],
    }),
  );

  server.registerTool(
    "read_local_file",
    {
      title: "Read a local file",
      description:
        "Read a text file from the filesystem OF THE MACHINE RUNNING THIS SERVER so its content " +
        "can be reviewed and plugged into cards. Over a remote bridge that is not the caller's " +
        "sandbox: a file you generated on your side is not visible here, so pass its text to the " +
        "card tool directly. Size-capped; binary files are refused. Set MCP_CHAT_CARDS_FS_ROOT " +
        "to confine reads to one directory.",
      inputSchema: {
        path: z.string().min(1),
        maxChars: z.number().int().min(100).max(200000).optional(),
      },
    },
    async (args) => {
      try {
        const file = await readLocalTextFile(args.path);
        const content = args.maxChars ? file.content.slice(0, args.maxChars) : file.content;
        const note = file.truncated || content.length < file.content.length ? " (truncated)" : "";
        return {
          content: [
            {
              type: "text",
              text: `Contents of ${file.path} (${file.size} bytes)${note}:\n${content}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "unpack_archive",
    {
      title: "Unpack a zip archive",
      description:
        "List a zip archive's entries and return the contents of its text files, so a project " +
        "can be inspected and turned into cards (code tours, tables, walkthroughs). The path is " +
        "resolved ON THE MACHINE RUNNING THIS SERVER, not in the caller's sandbox. Build caches " +
        "and binary entries are skipped.",
      inputSchema: {
        path: z.string().min(1),
        include: z
          .array(z.string())
          .optional()
          .describe("Only include entries whose path contains one of these substrings"),
        maxFiles: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const archive = await readArchive(args.path, {
          include: args.include,
          maxFiles: args.maxFiles,
        });
        return {
          content: [
            {
              type: "text",
              text:
                `Unpacked ${archive.archivePath}: ${archive.entries.length} entr(ies), ` +
                `${archive.files.length} text file(s) returned.\n` +
                JSON.stringify(
                  { entries: archive.entries, files: archive.files, skipped: archive.skipped },
                  null,
                  2,
                ),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "fetch_reference",
    {
      title: "Fetch reference site",
      description:
        "Fetch a public web page and return structured data: title, description, headings, readable " +
        "text, tables, images, links, and form specifications. Feed the results into the card tools " +
        "(tables into create_table_card, numbers into create_chart_card, and so on).",
      inputSchema: {
        url: z.string().url(),
        maxTextChars: z.number().int().min(100).max(20000).optional(),
      },
    },
    async (args) => {
      try {
        const result = await safeFetch(args.url);
        if (!result.ok) {
          throw new FetchError(`Fetch failed with HTTP status ${result.status}`);
        }
        const page = extractPage(result.body, result.finalUrl);
        if (args.maxTextChars) page.text = page.text.slice(0, args.maxTextChars);
        const note = result.truncated ? "\nNote: the response body was truncated at the size cap." : "";
        return {
          content: [
            {
              type: "text",
              text: `Extracted content from ${result.finalUrl}:${note}\n` + JSON.stringify(page, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "mirror_web_form",
    {
      title: "Mirror a website form",
      _meta: CARD_UI_META,
      outputSchema: CARD_OUTPUT_SCHEMA,
      description:
        "Fetch a public web page, extract one of its forms, and render it as an interactive card in " +
        "the conversation. When the user submits the card, the values return to the chat as a " +
        "structured payload for the submit_web_form tool, so a model-created task can submit the " +
        "actual website form.",
      inputSchema: {
        url: z.string().url(),
        formIndex: z.number().int().min(0).optional().describe("Which form on the page, default 0"),
        title: z.string().optional().describe("Card title override"),
      },
    },
    async (args) => {
      try {
        const result = await safeFetch(args.url);
        if (!result.ok) {
          throw new FetchError(`Fetch failed with HTTP status ${result.status}`);
        }
        const page = extractPage(result.body, result.finalUrl);
        const formSpec = page.forms[args.formIndex ?? 0];
        if (!formSpec) {
          throw new Error(
            `No form found at index ${args.formIndex ?? 0}; the page has ${page.forms.length} form(s).`,
          );
        }
        const fields: FieldSpec[] = formSpec.fields.map((field) => ({
          name: field.name,
          label: field.label || field.name,
          type:
            field.type === "select" || field.type === "textarea" || field.type === "radio"
              ? (field.type as FieldSpec["type"])
              : field.type === "checkbox"
                ? "checkbox"
                : field.type === "email" || field.type === "number" || field.type === "url" || field.type === "date"
                  ? (field.type as FieldSpec["type"])
                  : field.type === "hidden"
                    ? "hidden"
                    : "text",
          options: field.options.length > 0 ? field.options : undefined,
          required: field.required,
          value: field.value || undefined,
        }));
        const card = buildFormCard({
          title: args.title ?? (page.title ? `${page.title} - form` : "Website form"),
          description: `Mirrored from ${result.finalUrl}. Fill it in here; submitting returns the values to the conversation so the real form can be submitted for you.`,
          fields,
          submitLabel: "Submit to conversation",
          webForm: {
            sourceUrl: result.finalUrl,
            action: formSpec.action || result.finalUrl,
            method: formSpec.method,
          },
        });
        return cardResult(card);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "submit_web_form",
    {
      title: "Submit a website form",
      description:
        "Submit values to a real website form (form-encoded GET or POST). Only call this with data " +
        "the user entered in a mirrored form card, or values the user explicitly confirmed. Returns " +
        "the HTTP status and a snippet of the response.",
      inputSchema: {
        action: z.string().url().describe("Form action URL"),
        method: z.enum(["GET", "POST"]).optional(),
        fields: z.record(z.string()).describe("Field name to value map"),
        headers: z.record(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        const method = args.method ?? "POST";
        const params = new URLSearchParams(args.fields);
        let url = args.action;
        let body: string | undefined;
        if (method === "GET") {
          const target = new URL(args.action);
          for (const [key, value] of params) target.searchParams.append(key, value);
          url = target.toString();
        } else {
          body = params.toString();
        }
        const result = await safeFetch(url, {
          method,
          body,
          headers: args.headers,
          maxBytes: 256 * 1024,
        });
        const snippet = result.body.replace(/\s+/g, " ").slice(0, 600);
        return {
          content: [
            {
              type: "text",
              text:
                `Form ${method} to ${args.action} completed with HTTP status ${result.status}` +
                ` (final URL: ${result.finalUrl}).\nResponse snippet: ${snippet}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
