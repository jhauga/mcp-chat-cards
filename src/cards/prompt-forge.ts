// Prompt forge: turns a short gist into one token-efficient prompt through
// at most three cheap card round trips instead of an open-ended chat.
//
//   stage 1  gist    a 350-character textarea; submitting hands the model the
//                    gist plus the rules that govern the rest of the flow
//   stage 2  refine  multiple-choice questions (radio or checkbox, each with a
//                    free-text "Other") that close the gaps the gist left; at
//                    most MAX_REFINE_ROUNDS of these
//   stage 3  final   the finished prompt, editable in place, sent only after
//                    an in-card confirmation, and copyable when the host has
//                    no channel back to the conversation
//
// The saving comes from the shape of the exchange: the model reads a bounded
// gist and a bounded set of answers rather than a rambling thread, and it
// answers with cards rather than prose, so the only long text in the whole
// flow is the prompt the user actually wanted.
import { escapeHtml, uid } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

// The gist is deliberately short: a paragraph the user can write in one
// breath is also a paragraph the model can read for almost nothing.
export const GIST_MAX_CHARS = 350;

// Three rounds is enough to pin down scope, depth, and output shape. A
// fourth would cost more tokens than the prompt it is sharpening.
export const MAX_REFINE_ROUNDS = 3;

// The right-click menu item that opens the flow, and the prompt that item
// emits on hosts where the menu cannot build a card by itself.
export const FORGE_MENU_LABEL = "Generate Efficient Verbose Prompt";
export const FORGE_BOOTSTRAP_PROMPT =
  "[efficient-prompt] Call create_prompt_gist_card with no arguments. Reply with nothing else.";

// Every stage tags its prompt with this marker so the model can tell a forge
// round trip from an ordinary form submission at a glance.
const TAG = "[efficient-prompt]";

// Sent once, when the gist is submitted: everything the model needs to run
// the remaining rounds without being told again.
const FLOW_RULES = [
  "Build one token-efficient prompt for that gist.",
  "- Treat this conversation as context; never ask for something already said.",
  "- Gist already clear enough? Skip straight to the last rule.",
  `- Otherwise call create_prompt_refine_card with the fewest multiple-choice questions that close the gap. Hard limit: ${MAX_REFINE_ROUNDS} refine rounds.`,
  "- Finish with create_efficient_prompt_card: a single prompt, verbose only where verbosity buys a complete first-pass answer, with no restated context, no filler, and an explicit output shape.",
  "- Keep chat replies to one line; the cards carry the rest.",
].join("\n");

export interface PromptGistCardOptions {
  title?: string;
  subtitle?: string;
  // Replaces the default question above the textarea when the model already
  // knows what the user is circling.
  question?: string;
  placeholder?: string;
  contextActions?: ContextAction[];
}

export interface RefineOption {
  label: string;
  value?: string;
}

export interface RefineQuestion {
  // Token name the answer lands under in the submitted prompt.
  name: string;
  question: string;
  options: (string | RefineOption)[];
  // Checkboxes when several answers can be true at once, radios otherwise.
  multiple?: boolean;
  help?: string;
}

export interface PromptRefineCardOptions {
  title?: string;
  subtitle?: string;
  round?: number;
  questions: RefineQuestion[];
  contextActions?: ContextAction[];
}

export interface EfficientPromptCardOptions {
  title?: string;
  subtitle?: string;
  prompt: string;
  // One line on what was traded away, shown under the prompt.
  notes?: string;
  contextActions?: ContextAction[];
}

// Rough enough to be useful and cheap enough to run on every keystroke.
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : Math.max(1, Math.ceil(trimmed.length / 4));
}

function normalizeOptions(options: (string | RefineOption)[]): RefineOption[] {
  return options.map((option) =>
    typeof option === "string"
      ? { label: option, value: option }
      : { label: option.label, value: option.value ?? option.label },
  );
}

const FALLBACK_HINT =
  "If the chat client did not pick this up automatically, copy the text below and send it as your next message.";

function formTail(): string {
  return `<div>
<button type="submit" class="mcc-btn mcc-btn-primary">Continue</button>
</div>
<p class="mcc-form-status" role="status" aria-live="polite"></p>
<div class="mcc-form-fallback">
<p class="mcc-help">${escapeHtml(FALLBACK_HINT)}</p>
<textarea readonly></textarea>
<button type="button" class="mcc-btn mcc-copy-prompt">Copy prompt</button>
</div>`;
}

export function buildPromptGistCard(options: PromptGistCardOptions = {}): RenderedCard {
  const title = options.title?.trim() || "Efficient prompt - gist";
  const question =
    options.question?.trim() ||
    `In no more than ${GIST_MAX_CHARS} characters, describe the gist of where you want to go:`;
  const placeholder =
    options.placeholder?.trim() || "The one thing you want out of the next answer.";
  const formId = uid("forge");
  const fieldId = `${formId}-gist`;

  // The template is what the model actually reads, so it carries the rules
  // for the whole flow: nothing further has to be sent later.
  const promptTemplate = `${TAG} round 0. Gist: {{gist}}\n\n${FLOW_RULES}`;

  const body = `<section class="mcc-block">
<p class="mcc-help">${escapeHtml(question)}</p>
<form class="mcc-form" data-card-title="${escapeHtml(title)}" data-prompt-template="${escapeHtml(promptTemplate)}">
<div class="mcc-field">
<label for="${fieldId}">Gist<span class="mcc-required" title="Required">*</span></label>
<textarea id="${fieldId}" name="gist" maxlength="${GIST_MAX_CHARS}" required placeholder="${escapeHtml(placeholder)}" data-mcc-counter></textarea>
<span class="mcc-help mcc-forge-meta"><span class="mcc-count">0</span>/${GIST_MAX_CHARS} characters</span>
</div>
${formTail()}
</form>
</section>`;

  const doc = renderCardDocument({
    title,
    subtitle: options.subtitle ?? "Step 1 of 3 - the short version",
    kind: "prompt-gist",
    body,
    contextActions: options.contextActions,
    draggable: false,
  });
  return {
    ...doc,
    summary:
      `Opened the efficient-prompt gist card "${title}". The user answers in ${GIST_MAX_CHARS} ` +
      "characters or fewer; that submission carries the rules for the rest of the flow, so wait " +
      "for it instead of asking follow-up questions in chat.",
  };
}

function renderRefineQuestion(question: RefineQuestion, formId: string, index: number): string {
  const name = String(question.name ?? "").trim();
  if (name.length === 0) throw new Error("Every refine question needs a name.");
  const options = normalizeOptions(Array.isArray(question.options) ? question.options : []);
  if (options.length === 0) {
    throw new Error(`Refine question "${name}" needs at least one option.`);
  }
  const type = question.multiple ? "checkbox" : "radio";
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fieldId = `${formId}-${safeName}-${index}`;
  const label = escapeHtml(question.question ?? name);
  const help = question.help ? `<span class="mcc-help">${escapeHtml(question.help)}</span>` : "";

  const choices = options
    .map((option, choiceIndex) => {
      const choiceId = `${fieldId}-${choiceIndex}`;
      return `<label class="mcc-choice" for="${choiceId}">
<input type="${type}" id="${choiceId}" name="${escapeHtml(name)}" value="${escapeHtml(option.value ?? option.label)}">
${escapeHtml(option.label)}</label>`;
    })
    .join("\n");

  // The free-text escape hatch shares the group's name, so a typed answer
  // joins the checked ones under a single token instead of needing its own.
  return `<fieldset class="mcc-field mcc-forge-q" style="border:none;padding:0;margin:0">
<label>${label}</label>
${choices}
<div class="mcc-other">
<label class="mcc-help" for="${fieldId}-other">Other</label>
<input type="text" id="${fieldId}-other" name="${escapeHtml(name)}" placeholder="Something else - leave blank to skip">
</div>${help}</fieldset>`;
}

export function buildPromptRefineCard(options: PromptRefineCardOptions): RenderedCard {
  const questions = Array.isArray(options.questions) ? options.questions : [];
  if (questions.length === 0) throw new Error("Provide at least one refine question.");
  const round = Math.min(Math.max(Math.trunc(options.round ?? 1) || 1, 1), MAX_REFINE_ROUNDS);
  const title = options.title?.trim() || `Efficient prompt - refine ${round} of ${MAX_REFINE_ROUNDS}`;
  const formId = uid("forge");
  const fields = questions
    .map((question, index) => renderRefineQuestion(question, formId, index))
    .join("\n");

  const answerLines = questions
    .map((question) => `- ${String(question.question ?? question.name).replace(/\s+/g, " ")}: {{${question.name}}}`)
    .join("\n");
  const remaining = MAX_REFINE_ROUNDS - round;
  const nextStep =
    remaining > 0
      ? `Enough to write the prompt? Call create_efficient_prompt_card now. If not, one more refine round (${remaining} left).`
      : "That was the last refine round. Call create_efficient_prompt_card now.";
  const promptTemplate =
    `${TAG} round ${round} answers:\n${answerLines}\n\n` +
    `A blank answer means no preference - choose for me. ${nextStep}`;

  const body = `<section class="mcc-block">
<p class="mcc-help">Pick what fits. Anything left blank is a free choice for the model.</p>
<form class="mcc-form" data-card-title="${escapeHtml(title)}" data-prompt-template="${escapeHtml(promptTemplate)}">
${fields}
${formTail()}
</form>
</section>`;

  const doc = renderCardDocument({
    title,
    subtitle: options.subtitle ?? `Step 2 of 3 - round ${round} of ${MAX_REFINE_ROUNDS}`,
    kind: "prompt-refine",
    body,
    contextActions: options.contextActions,
    draggable: false,
  });
  return {
    ...doc,
    summary:
      `Opened refine round ${round} of ${MAX_REFINE_ROUNDS} with ${questions.length} question(s). ` +
      (remaining > 0
        ? `At most ${remaining} more refine round(s) before the prompt has to be written.`
        : "No refine rounds remain: write the prompt from whatever comes back."),
  };
}

export function buildEfficientPromptCard(options: EfficientPromptCardOptions): RenderedCard {
  const prompt = String(options.prompt ?? "").trim();
  if (prompt.length === 0) throw new Error("The generated prompt is empty.");
  const title = options.title?.trim() || "Efficient prompt - ready to send";
  const fieldId = uid("forge-out");
  const notes = options.notes
    ? `<p class="mcc-help mcc-forge-notes">${escapeHtml(options.notes)}</p>`
    : "";

  // Not a <form>: submitting this card sends the prompt itself, and that only
  // happens once the confirmation box below has been answered.
  const body = `<section class="mcc-block mcc-forge-final">
<p class="mcc-help">Edit it if you like. Nothing is sent until you confirm.</p>
<div class="mcc-field">
<label for="${fieldId}">Token-efficient prompt</label>
<textarea id="${fieldId}" class="mcc-forge-prompt" spellcheck="false" data-mcc-counter>${escapeHtml(prompt)}</textarea>
<span class="mcc-help mcc-forge-meta"><span class="mcc-count">${prompt.length}</span> characters, roughly <span class="mcc-tokens">${estimateTokens(prompt)}</span> tokens</span>
</div>
${notes}
<div class="mcc-forge-actions">
<button type="button" class="mcc-btn mcc-btn-primary mcc-forge-send">Send this prompt</button>
<button type="button" class="mcc-btn mcc-forge-copy">Copy prompt</button>
</div>
<div class="mcc-confirm" hidden>
<p>Send this prompt to the conversation as your next message?</p>
<div class="mcc-forge-actions">
<button type="button" class="mcc-btn mcc-btn-primary mcc-confirm-yes">Yes, send it</button>
<button type="button" class="mcc-btn mcc-confirm-no">Cancel</button>
</div>
</div>
<p class="mcc-form-status" role="status" aria-live="polite"></p>
</section>`;

  const doc = renderCardDocument({
    title,
    subtitle: options.subtitle ?? "Step 3 of 3 - review, confirm, send",
    kind: "prompt-final",
    body,
    contextActions: options.contextActions,
    draggable: false,
  });
  return {
    ...doc,
    summary:
      `Rendered the finished prompt (${prompt.length} characters, roughly ${estimateTokens(prompt)} tokens) ` +
      "for review. The user sends it after confirming, or copies it from the card; do not act on it " +
      "until it arrives as a message.",
  };
}
