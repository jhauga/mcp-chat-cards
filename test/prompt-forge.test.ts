// The efficient-prompt flow, from the right-click menu item that opens it to
// the confirmation gate on the card that sends the finished prompt. The DOM
// halves run the real card runtime in jsdom, because the parts most likely to
// break quietly - a choice group sharing a name with its "Other" box, a send
// button that must not send on the first click - only exist at runtime.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildEfficientPromptCard,
  buildPromptGistCard,
  buildPromptRefineCard,
  estimateTokens,
  FORGE_BOOTSTRAP_PROMPT,
  FORGE_MENU_LABEL,
  GIST_MAX_CHARS,
  MAX_REFINE_ROUNDS,
} from "../src/cards/prompt-forge.js";
import { CARD_RUNTIME_JS } from "../src/cards/runtime.js";

interface PostedMessage {
  type?: string;
  payload?: { prompt?: string; message?: string };
}

// Renders a card's standalone document and returns the window plus every
// message the runtime posted to its host.
function mountCard(html: string): { window: JSDOM["window"]; posted: PostedMessage[] } {
  const posted: PostedMessage[] = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://cards.invalid/",
    pretendToBeVisual: true,
  });
  // In a top-level JSDOM window, window.parent === window, so the host
  // listener sees everything the runtime posts.
  dom.window.addEventListener("message", (event: MessageEvent) => {
    posted.push(event.data as PostedMessage);
  });
  return { window: dom.window, posted };
}

function prompts(posted: PostedMessage[]): string[] {
  return posted.filter((msg) => msg.type === "prompt").map((msg) => msg.payload?.prompt ?? "");
}

function flush(window: JSDOM["window"]): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("buildPromptGistCard", () => {
  it("asks for the gist within the character cap and counts what is typed", () => {
    const card = buildPromptGistCard();
    expect(card.config.kind).toBe("prompt-gist");
    expect(card.articleHtml).toContain(
      `In no more than ${GIST_MAX_CHARS} characters, describe the gist of where you want to go:`,
    );
    expect(card.articleHtml).toContain(`maxlength="${GIST_MAX_CHARS}"`);
    expect(card.articleHtml).toContain("data-mcc-counter");
    expect(card.articleHtml).toContain('<span class="mcc-count">0</span>');
  });

  it("carries the whole flow in its prompt template, so no rules are sent twice", () => {
    const card = buildPromptGistCard();
    const template = /data-prompt-template="([^"]*)"/.exec(card.articleHtml)?.[1] ?? "";
    expect(template).toContain("[efficient-prompt] round 0. Gist: {{gist}}");
    expect(template).toContain("create_prompt_refine_card");
    expect(template).toContain("create_efficient_prompt_card");
    expect(template).toContain(`Hard limit: ${MAX_REFINE_ROUNDS} refine rounds`);
  });

  it("takes a replacement question when the model already knows the topic", () => {
    const card = buildPromptGistCard({ question: "Which part of the migration?" });
    expect(card.articleHtml).toContain("Which part of the migration?");
  });
});

describe("buildPromptRefineCard", () => {
  it("renders radios by default and checkboxes for multi-answer questions", () => {
    const card = buildPromptRefineCard({
      questions: [
        { name: "depth", question: "How deep?", options: ["Overview", "Line by line"] },
        { name: "langs", question: "Which languages?", options: ["Python", "Go"], multiple: true },
      ],
    });
    expect(card.config.kind).toBe("prompt-refine");
    expect(card.articleHtml).toContain('type="radio" id');
    expect(card.articleHtml).toContain('type="checkbox" id');
    // Every question gets a free-text escape hatch under the group's own name.
    expect(card.articleHtml).toContain('type="text" id');
    expect((card.articleHtml.match(/class="mcc-other"/g) ?? []).length).toBe(2);
  });

  it("clamps the round number and says how many rounds are left", () => {
    const last = buildPromptRefineCard({
      round: 9,
      questions: [{ name: "scope", question: "How wide?", options: ["Narrow", "Wide"] }],
    });
    expect(last.articleHtml).toContain(
      `<h1>Efficient prompt - refine ${MAX_REFINE_ROUNDS} of ${MAX_REFINE_ROUNDS}</h1>`,
    );
    expect(last.articleHtml).toContain("That was the last refine round.");

    const first = buildPromptRefineCard({
      round: 1,
      questions: [{ name: "scope", question: "How wide?", options: ["Narrow", "Wide"] }],
    });
    expect(first.articleHtml).toContain(`(${MAX_REFINE_ROUNDS - 1} left)`);
  });

  it("rejects a question with no options rather than rendering an empty group", () => {
    expect(() =>
      buildPromptRefineCard({ questions: [{ name: "scope", question: "How wide?", options: [] }] }),
    ).toThrow(/at least one option/);
  });
});

describe("buildEfficientPromptCard", () => {
  it("shows the prompt with its size and gates sending behind a confirmation", () => {
    const prompt = "Rewrite the parser to stream input. Output: the diff, then a one-line rationale.";
    const card = buildEfficientPromptCard({ prompt, notes: "Assumes the current test suite stays." });
    expect(card.config.kind).toBe("prompt-final");
    expect(card.articleHtml).toContain(`<span class="mcc-count">${prompt.length}</span>`);
    expect(card.articleHtml).toContain(`<span class="mcc-tokens">${estimateTokens(prompt)}</span>`);
    expect(card.articleHtml).toContain('class="mcc-confirm" hidden');
    expect(card.articleHtml).toContain("mcc-forge-send");
    expect(card.articleHtml).toContain("mcc-forge-copy");
    expect(card.articleHtml).toContain("Assumes the current test suite stays.");
  });

  it("refuses an empty prompt", () => {
    expect(() => buildEfficientPromptCard({ prompt: "   " })).toThrow(/empty/);
  });
});

describe("efficient-prompt flow in a live card", () => {
  it("offers the flow from every card's right-click menu", async () => {
    const { window, posted } = mountCard(buildPromptGistCard().html);
    await flush(window);
    const items = Array.from(window.document.querySelectorAll("#mcc-menu button")) as HTMLElement[];
    const forge = items.find((item) => item.textContent === FORGE_MENU_LABEL);
    expect(forge).toBeDefined();

    forge?.click();
    await flush(window);
    expect(prompts(posted)).toContain(FORGE_BOOTSTRAP_PROMPT);
  });

  it("submits the gist inside the flow rules", async () => {
    const { window, posted } = mountCard(buildPromptGistCard().html);
    await flush(window);
    const area = window.document.querySelector("textarea[name=gist]") as HTMLTextAreaElement;
    area.value = "Cut our CI time without losing coverage.";
    area.dispatchEvent(new window.Event("input", { bubbles: true }));
    // The counter tracks what was typed, so an over-long gist is visible
    // before it is submitted rather than after.
    expect(window.document.querySelector(".mcc-count")?.textContent).toBe(String(area.value.length));

    (window.document.querySelector("form.mcc-form") as HTMLFormElement).dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush(window);
    const sent = prompts(posted).find((prompt) => prompt.startsWith("[efficient-prompt] round 0."));
    expect(sent).toContain("Cut our CI time without losing coverage.");
    expect(sent).toContain("create_efficient_prompt_card");
  });

  it("joins checked options and the free-text Other under one answer", async () => {
    const card = buildPromptRefineCard({
      round: 1,
      questions: [
        { name: "targets", question: "What should get faster?", options: ["Unit", "E2E"], multiple: true },
        { name: "budget", question: "How much rework?", options: ["None", "Some"] },
      ],
    });
    const { window, posted } = mountCard(card.html);
    await flush(window);
    const doc = window.document;
    (doc.querySelector('input[type=checkbox][value=Unit]') as HTMLInputElement).checked = true;
    (doc.querySelector('input[name=targets][type=text]') as HTMLInputElement).value = "Lint";
    // "budget" is left untouched: an unanswered question has to come through
    // as an empty answer, not as a literal {{budget}} token.
    (doc.querySelector("form.mcc-form") as HTMLFormElement).dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush(window);

    const sent = prompts(posted).find((prompt) => prompt.startsWith("[efficient-prompt] round 1"));
    expect(sent).toContain("- What should get faster?: Unit, Lint");
    expect(sent).toContain("- How much rework?: \n");
    expect(sent).not.toContain("{{");
  });

  it("sends the finished prompt only after the confirmation is accepted", async () => {
    const prompt = "Profile the test suite, then list the three slowest files with fixes.";
    const { window, posted } = mountCard(buildEfficientPromptCard({ prompt }).html);
    await flush(window);
    const doc = window.document;
    const box = doc.querySelector(".mcc-confirm") as HTMLElement;

    (doc.querySelector(".mcc-forge-send") as HTMLElement).click();
    await flush(window);
    // The first click only opens the confirmation.
    expect(box.hidden).toBe(false);
    expect(prompts(posted)).toHaveLength(0);

    (doc.querySelector(".mcc-confirm-no") as HTMLElement).click();
    await flush(window);
    expect(box.hidden).toBe(true);
    expect(prompts(posted)).toHaveLength(0);

    (doc.querySelector(".mcc-forge-send") as HTMLElement).click();
    (doc.querySelector(".mcc-confirm-yes") as HTMLElement).click();
    await flush(window);
    expect(prompts(posted)).toEqual([prompt]);
    expect(box.hidden).toBe(true);
  });

  it("sends the user's edits rather than the prompt as generated", async () => {
    const { window, posted } = mountCard(
      buildEfficientPromptCard({ prompt: "Summarize the release." }).html,
    );
    await flush(window);
    const doc = window.document;
    const area = doc.querySelector(".mcc-forge-prompt") as HTMLTextAreaElement;
    area.value = "Summarize the release in five bullets.";
    area.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(doc.querySelector(".mcc-tokens")?.textContent).toBe(String(estimateTokens(area.value)));

    (doc.querySelector(".mcc-forge-send") as HTMLElement).click();
    (doc.querySelector(".mcc-confirm-yes") as HTMLElement).click();
    await flush(window);
    expect(prompts(posted)).toEqual(["Summarize the release in five bullets."]);
  });

  it("will not send an empty prompt", async () => {
    const { window, posted } = mountCard(buildEfficientPromptCard({ prompt: "Anything." }).html);
    await flush(window);
    const doc = window.document;
    (doc.querySelector(".mcc-forge-prompt") as HTMLTextAreaElement).value = "   ";
    (doc.querySelector(".mcc-forge-send") as HTMLElement).click();
    await flush(window);
    expect((doc.querySelector(".mcc-confirm") as HTMLElement).hidden).toBe(true);
    expect(doc.querySelector(".mcc-form-status")?.textContent).toContain("empty");
    expect(prompts(posted)).toHaveLength(0);
  });
});

describe("runtime and builder stay in step", () => {
  // The runtime cannot import prompt-forge.ts without a cycle through
  // cards/shell.ts, so the menu label and bootstrap prompt are duplicated
  // there. This is the check that the copies have not drifted.
  it("uses the same menu label and bootstrap prompt in both places", () => {
    expect(CARD_RUNTIME_JS).toContain(`"${FORGE_MENU_LABEL}"`);
    expect(CARD_RUNTIME_JS).toContain(`"${FORGE_BOOTSTRAP_PROMPT}"`);
  });
});
