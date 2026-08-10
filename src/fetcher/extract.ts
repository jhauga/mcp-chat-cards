// Structured extraction from fetched HTML: title, description, headings,
// readable text, tables, images, links, and form specifications suitable
// for mirroring in a form card.
import { parse, HTMLElement } from "node-html-parser";
import type { TableData } from "../util/text-to-table.js";

export interface ExtractedHeading {
  level: number;
  text: string;
}

export interface ExtractedImage {
  src: string;
  alt: string;
}

export interface ExtractedLink {
  href: string;
  text: string;
}

export interface WebFormField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  value: string;
  options: string[];
}

export interface WebFormSpec {
  index: number;
  action: string;
  method: string;
  fields: WebFormField[];
}

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  headings: ExtractedHeading[];
  text: string;
  tables: TableData[];
  images: ExtractedImage[];
  links: ExtractedLink[];
  forms: WebFormSpec[];
}

const LIMITS = {
  headings: 30,
  tables: 5,
  tableRows: 60,
  images: 20,
  links: 40,
  forms: 5,
  textChars: 4000,
};

function resolveUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTables(root: HTMLElement): TableData[] {
  return root
    .querySelectorAll("table")
    .slice(0, LIMITS.tables)
    .map((table) => {
      const headers = table.querySelectorAll("th").map((th) => cleanText(th.text));
      const rows: string[][] = [];
      for (const tr of table.querySelectorAll("tr").slice(0, LIMITS.tableRows)) {
        const cells = tr.querySelectorAll("td").map((td) => cleanText(td.text));
        if (cells.length > 0) rows.push(cells);
      }
      return { headers, rows };
    });
}

function fieldLabel(root: HTMLElement, input: HTMLElement): string {
  const id = input.getAttribute("id");
  if (id) {
    const label = root.querySelector(`label[for="${id}"]`);
    if (label) return cleanText(label.text);
  }
  const parentLabel = input.closest("label");
  if (parentLabel) return cleanText(parentLabel.text);
  return input.getAttribute("placeholder") ?? input.getAttribute("name") ?? "";
}

const SKIPPED_INPUT_TYPES = new Set(["submit", "button", "image", "reset", "file"]);

function extractForms(root: HTMLElement, baseUrl: string): WebFormSpec[] {
  return root
    .querySelectorAll("form")
    .slice(0, LIMITS.forms)
    .map((form, index) => {
      const fields: WebFormField[] = [];
      const seenRadioGroups = new Map<string, WebFormField>();

      for (const el of form.querySelectorAll("input, select, textarea")) {
        const name = el.getAttribute("name");
        if (!name) continue;
        const tag = el.rawTagName.toLowerCase();
        const type = tag === "input" ? (el.getAttribute("type") ?? "text").toLowerCase() : tag;
        if (SKIPPED_INPUT_TYPES.has(type)) continue;

        if (type === "radio") {
          const existing = seenRadioGroups.get(name);
          const optionValue = el.getAttribute("value") ?? "";
          if (existing) {
            if (optionValue) existing.options.push(optionValue);
            continue;
          }
          const field: WebFormField = {
            name,
            type: "radio",
            label: fieldLabel(root, el),
            required: el.hasAttribute("required"),
            value: "",
            options: optionValue ? [optionValue] : [],
          };
          seenRadioGroups.set(name, field);
          fields.push(field);
          continue;
        }

        const options =
          tag === "select"
            ? el.querySelectorAll("option").map((o) => cleanText(o.getAttribute("value") ?? o.text))
            : [];
        fields.push({
          name,
          type,
          label: fieldLabel(root, el),
          required: el.hasAttribute("required"),
          value: el.getAttribute("value") ?? "",
          options,
        });
      }

      return {
        index,
        action: resolveUrl(form.getAttribute("action") ?? "", baseUrl),
        method: (form.getAttribute("method") ?? "GET").toUpperCase(),
        fields,
      };
    });
}

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const root = parse(html, { comment: false });
  for (const tag of ["script", "style", "noscript", "svg"]) {
    for (const el of root.querySelectorAll(tag)) el.remove();
  }

  const title = cleanText(root.querySelector("title")?.text ?? "");
  const description =
    root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";

  const headings: ExtractedHeading[] = [];
  for (const level of [1, 2, 3]) {
    for (const el of root.querySelectorAll(`h${level}`)) {
      headings.push({ level, text: cleanText(el.text) });
    }
  }
  headings.splice(LIMITS.headings);

  const bodyEl = root.querySelector("body") ?? root;
  const text = cleanText(bodyEl.structuredText ?? bodyEl.text).slice(0, LIMITS.textChars);

  const images: ExtractedImage[] = [];
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) continue;
    images.push({ src: resolveUrl(src, baseUrl), alt: img.getAttribute("alt") ?? "" });
    if (images.length >= LIMITS.images) break;
  }

  const links: ExtractedLink[] = [];
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href");
    const linkText = cleanText(a.text);
    if (!href || !linkText || href.startsWith("#") || href.startsWith("javascript:")) continue;
    links.push({ href: resolveUrl(href, baseUrl), text: linkText });
    if (links.length >= LIMITS.links) break;
  }

  return {
    url: baseUrl,
    title,
    description,
    headings,
    text,
    tables: extractTables(root),
    images,
    links,
    forms: extractForms(root, baseUrl),
  };
}
