import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildTabCard } from "./cards/tabs.js";
import { buildTableCard } from "./cards/table.js";
import { buildFormCard, type FieldSpec } from "./cards/form.js";
import { buildChartCard } from "./cards/chart.js";
import { buildVideoCard } from "./cards/video.js";
import { buildRevealCard } from "./cards/reveal.js";
import { buildListCard, type ListItem } from "./cards/list.js";
import type { RenderedCard } from "./cards/shell.js";
import {
  buildCardTemplateHtml,
  CARD_TEMPLATE_URI,
  MCP_APP_MIME_TYPE,
} from "./cards/app-template.js";
import { buildMarkdownCard } from "./cards/doc.js";
import { buildCodeTourCard, type TourFile } from "./cards/code-tour.js";
import { safeFetch, FetchError } from "./fetcher/fetch.js";
import { extractPage } from "./fetcher/extract.js";
import { readLocalTextFile } from "./util/files.js";
import { readArchive } from "./util/archive.js";

export const SERVER_VERSION = "0.0.0-alpha";

const SERVER_INSTRUCTIONS = `mcp-chat-cards renders interactive HTML cards inside the chat.
Use these tools whenever the conversation involves research, education, professional or
hobbyist skills (programming, woodworking, arts, and similar), professional topics, history,
or news - or related subjects - and a table, tab box, chart, form, video, collapsible
outline, or mirrored website form would communicate better than plain text.

Card tools are linked to an MCP Apps UI template (ui://mcp-chat-cards/card.html), so hosts
that support the MCP Apps extension render each card inline in the conversation as a
sandboxed iframe. The same results also carry the full card as an embedded HTML resource
for hosts without Apps support. Interactive elements talk back to the host (form
submissions arrive as the next user prompt), so card forms are also useful to collect
context that directs the rest of the conversation.

Files you generated earlier in the conversation plug straight into cards: pass a markdown
file path (or content) to create_markdown_card to render a guide as one interactive card,
and pass a project zip path to create_code_tour_card to render its source as file tabs.
Use unpack_archive or read_local_file first when you need to inspect the contents before
deciding which cards to build.

Large content is split automatically into multi-part cards so results stay small enough
for hosts to render. When a card result says more parts remain, immediately call the same
tool again with the indicated part number (keeping the other arguments identical) until
every part has rendered as its own card.`;

// Shared zod fragments -------------------------------------------------

const tutorTermsSchema = z
  .array(z.object({ term: z.string().min(1), tip: z.string().optional() }))
  .optional()
  .describe(
    "Educational tutor terms. Occurrences in the card are underlined; hovering ~1.2s shows the tip " +
      "and notifies the host so the model can follow up.",
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

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "mcp-chat-cards", version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

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
    const appsHost = clientSupportsApps();
    const content: CallToolResult["content"] = [
      {
        type: "text",
        text:
          `${card.summary}\n` +
          (appsHost
            ? "The card renders inline via the MCP Apps template."
            : "The card renders inline via the MCP Apps template on supporting hosts; " +
              "it is also attached as an embedded HTML resource " +
              `(ui://mcp-chat-cards/${card.id}) as a fallback.`),
      },
    ];
    if (!appsHost) {
      content.push({
        type: "resource",
        resource: {
          uri: `ui://mcp-chat-cards/${card.id}`,
          mimeType: "text/html",
          text: card.html,
        },
      });
    }
    return {
      content,
      // Consumed by the MCP Apps card template (see app-template.ts).
      structuredContent: {
        card: { articleHtml: card.articleHtml, config: card.config },
      },
    };
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
        "Render a card with an HTML video player for a short clip. src must be a direct http(s) " +
        "URL to a video file (mp4/webm), not a streaming platform page.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        src: z.string().url(),
        poster: z.string().url().optional(),
        description: z.string().optional(),
        loop: z.boolean().optional(),
        muted: z.boolean().optional(),
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
        "(for example a walkthrough or guide) to plug it into the chat in one call.",
      inputSchema: {
        markdown: z.string().optional().describe("Markdown content to render"),
        path: z.string().optional().describe("Path to a local markdown file to render instead"),
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
        "earlier in the conversation for a one-call plug-n-play tour, or pass files explicitly.",
      inputSchema: {
        title: z.string().min(1),
        subtitle: z.string().optional(),
        intro: z.string().optional().describe("Guidance shown in a leading 'Start here' tab"),
        archivePath: z.string().optional().describe("Path to a local zip; its text files become tabs"),
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
    "read_local_file",
    {
      title: "Read a local file",
      description:
        "Read a local text file (typically one generated earlier in the conversation) so its " +
        "content can be reviewed and plugged into cards. Size-capped; binary files are refused. " +
        "Set MCP_CHAT_CARDS_FS_ROOT to confine reads to one directory.",
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
        "List a local zip archive's entries and return the contents of its text files, so a " +
        "project generated earlier in the conversation can be inspected and turned into cards " +
        "(code tours, tables, walkthroughs). Build caches and binary entries are skipped.",
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
