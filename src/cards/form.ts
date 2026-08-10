import { escapeHtml, uid } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "number"
  | "email"
  | "url"
  | "date"
  | "hidden";

export interface FieldOption {
  label: string;
  value?: string;
}

export interface FieldSpec {
  name: string;
  label?: string;
  type?: FieldType;
  options?: (string | FieldOption)[];
  required?: boolean;
  placeholder?: string;
  value?: string;
  help?: string;
}

// Identifies a real website form that a mirrored card stands in for. On
// submit the runtime emits a submit_web_form payload instead of free text.
export interface WebFormTarget {
  sourceUrl: string;
  action: string;
  method: string;
}

export interface FormCardOptions {
  title: string;
  subtitle?: string;
  description?: string;
  fields: FieldSpec[];
  submitLabel?: string;
  // Prompt sent to the conversation on submit; {{fieldName}} tokens are
  // replaced with submitted values. Defaults to a labeled value list.
  promptTemplate?: string;
  webForm?: WebFormTarget;
  contextActions?: ContextAction[];
}

function normalizeOptions(options: (string | FieldOption)[] = []): FieldOption[] {
  return options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : { ...option, value: option.value ?? option.label },
  );
}

function renderField(field: FieldSpec, formId: string): string {
  const type = field.type ?? "text";
  const fieldId = `${formId}-${field.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const name = escapeHtml(field.name);
  const required = field.required ? " required" : "";
  const requiredMark = field.required ? '<span class="mcc-required" title="Required">*</span>' : "";
  const label = escapeHtml(field.label ?? field.name);
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const value = field.value !== undefined ? escapeHtml(field.value) : "";
  const help = field.help ? `<span class="mcc-help">${escapeHtml(field.help)}</span>` : "";

  if (type === "hidden") {
    return `<input type="hidden" name="${name}" value="${value}">`;
  }
  if (type === "textarea") {
    return `<div class="mcc-field"><label for="${fieldId}">${label}${requiredMark}</label>
<textarea id="${fieldId}" name="${name}"${placeholder}${required}>${value}</textarea>${help}</div>`;
  }
  if (type === "select") {
    const optionTags = normalizeOptions(field.options)
      .map((option) => {
        const selected = option.value === field.value ? " selected" : "";
        return `<option value="${escapeHtml(option.value ?? option.label)}"${selected}>${escapeHtml(option.label)}</option>`;
      })
      .join("");
    return `<div class="mcc-field"><label for="${fieldId}">${label}${requiredMark}</label>
<select id="${fieldId}" name="${name}"${required}>${optionTags}</select>${help}</div>`;
  }
  if (type === "checkbox" || type === "radio") {
    const choices = normalizeOptions(field.options ?? [{ label: field.label ?? field.name, value: "yes" }])
      .map((option, index) => {
        const choiceId = `${fieldId}-${index}`;
        const checked = option.value === field.value ? " checked" : "";
        return `<label class="mcc-choice" for="${choiceId}">
<input type="${type}" id="${choiceId}" name="${name}" value="${escapeHtml(option.value ?? option.label)}"${checked}>
${escapeHtml(option.label)}</label>`;
      })
      .join("\n");
    return `<fieldset class="mcc-field" style="border:none;padding:0;margin:0">
<label>${label}${requiredMark}</label>
${choices}${help}</fieldset>`;
  }
  return `<div class="mcc-field"><label for="${fieldId}">${label}${requiredMark}</label>
<input type="${escapeHtml(type)}" id="${fieldId}" name="${name}" value="${value}"${placeholder}${required}>${help}</div>`;
}

export function buildFormCard(options: FormCardOptions): RenderedCard {
  const formId = uid("form");
  const fields = options.fields.map((field) => renderField(field, formId)).join("\n");
  const description = options.description
    ? `<p class="mcc-help">${escapeHtml(options.description)}</p>`
    : "";
  const templateAttr = options.promptTemplate
    ? ` data-prompt-template="${escapeHtml(options.promptTemplate)}"`
    : "";
  const webFormAttr = options.webForm
    ? ` data-webform="${escapeHtml(JSON.stringify(options.webForm))}"`
    : "";

  const body = `<section class="mcc-block">
${description}
<form class="mcc-form" data-card-title="${escapeHtml(options.title)}"${templateAttr}${webFormAttr}>
${fields}
<div>
<button type="submit" class="mcc-btn mcc-btn-primary">${escapeHtml(options.submitLabel ?? "Submit")}</button>
</div>
<p class="mcc-form-status" role="status" aria-live="polite"></p>
<div class="mcc-form-fallback">
<p class="mcc-help">If the chat client did not pick this up automatically, copy the text below and send it as your next message.</p>
<textarea readonly></textarea>
<button type="button" class="mcc-btn mcc-copy-prompt">Copy prompt</button>
</div>
</form>
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: options.webForm ? "web-form" : "form",
    body,
    contextActions: options.contextActions,
    // Reordering fields inside a form would break its meaning.
    draggable: false,
  });
  const target = options.webForm ? ` mirroring ${options.webForm.action}` : "";
  return {
    ...doc,
    summary:
      `Created ${options.webForm ? "mirrored web form" : "form"} card "${options.title}"` +
      ` with ${options.fields.length} field(s)${target}. Submitting it sends the values back to the conversation as the next prompt.`,
  };
}
