import { describe, expect, it } from "vitest";
import { renderCardBody } from "../src/cards/shell.js";
import { buildTabCard } from "../src/cards/tabs.js";
import { buildTableCard } from "../src/cards/table.js";
import { buildFormCard } from "../src/cards/form.js";
import { buildChartCard } from "../src/cards/chart.js";
import { buildVideoCard, MAX_INLINE_MEDIA_CHARS } from "../src/cards/video.js";
import { buildRevealCard } from "../src/cards/reveal.js";
import { buildMotionCard } from "../src/cards/motion.js";
import { buildListCard } from "../src/cards/list.js";

describe("card shell header toggles", () => {
  it("leaves toggle creation to the runtime and does not opt out by default", () => {
    const { articleHtml } = renderCardBody({ title: "T", kind: "tabs", body: "<p>x</p>" });
    // The runtime creates the buttons at init so older cards get them too.
    expect(articleHtml).not.toContain("mcc-toggle-code");
    expect(articleHtml).not.toContain("mcc-toggle-card");
    expect(articleHtml).not.toContain("data-mcc-no-code");
    expect(articleHtml).not.toContain("data-mcc-no-collapse");
  });

  it("marks the article when either toggle is disabled", () => {
    const { articleHtml } = renderCardBody({
      title: "T",
      kind: "tabs",
      body: "<p>x</p>",
      codeToggle: false,
      collapsible: false,
    });
    expect(articleHtml).toContain('data-mcc-no-code="1"');
    expect(articleHtml).toContain('data-mcc-no-collapse="1"');
  });
});

describe("buildMotionCard", () => {
  it("renders sequential scenes with player controls", () => {
    const card = buildMotionCard({
      title: "How sorting works",
      scenes: [
        { heading: "Sorting a list", text: "Three steps.", transition: "fade" },
        { bullets: ["Compare", "Swap", "Repeat"], transition: "slide" },
        {
          heading: "Comparisons by size",
          chart: {
            type: "bar",
            labels: ["10", "100", "1000"],
            values: [4, 60, 900],
            zoom: { from: 2, to: 2 },
          },
        },
      ],
    });
    expect(card.html).toContain("mcc-motion");
    expect((card.html.match(/class="mcc-scene /g) ?? []).length).toBe(3);
    expect(card.html).toContain("mcc-scene-fade");
    expect(card.html).toContain("mcc-scene-slide");
    expect(card.html).toContain("mcc-motion-play");
    expect(card.html).toContain("mcc-motion-replay");
    expect(card.html).toContain("mcc-motion-progress");
    // The chart zoom range becomes a viewBox target for the runtime.
    expect(card.html).toContain("data-mcc-zoom=");
    expect(card.summary).toContain("3 scene(s)");
  });

  it("staggers bullet builds and draws shapes", () => {
    const card = buildMotionCard({
      title: "Pipeline",
      scenes: [
        {
          bullets: ["First", "Second"],
          shapes: [
            { type: "rect", x: 10, y: 30, w: 20, h: 20, label: "Input" },
            { type: "arrow", x: 32, y: 40, x2: 55, y2: 40 },
          ],
          transition: "draw",
        },
      ],
    });
    expect(card.html).toContain('style="transition-delay:0ms"');
    expect(card.html).toContain('style="transition-delay:350ms"');
    expect(card.html).toContain("mcc-scene-draw");
    expect(card.html).toContain("<polygon"); // arrowhead
    expect(card.html).toContain("Input");
  });

  it("escapes hostile content and validates input", () => {
    const card = buildMotionCard({
      title: "T",
      scenes: [{ heading: '<img onerror="x">', text: "<script>bad()</script>" }],
    });
    expect(card.html).not.toContain("<img onerror");
    expect(card.html).not.toContain("<script>bad()");

    expect(() => buildMotionCard({ title: "T", scenes: [] })).toThrow(/at least one scene/);
    expect(() =>
      buildMotionCard({
        title: "T",
        scenes: [{ chart: { type: "bar", labels: ["a"], values: [1, 2] } }],
      }),
    ).toThrow(/same number of labels and values/);
  });
});

describe("buildTabCard", () => {
  it("renders tabs, panels, and code with copy button", () => {
    const card = buildTabCard({
      title: "Sorting a list",
      tabs: [
        { label: "Python", code: "sorted(items)", language: "python" },
        { label: "JavaScript", code: "items.toSorted()", language: "javascript" },
        { label: "Notes", text: "Both return a new list." },
      ],
    });
    expect(card.html).toContain('role="tablist"');
    expect(card.html).toContain("mcc-copy-code");
    expect(card.html).toContain("sorted(items)");
    expect(card.summary).toContain("3 tab(s)");
  });

  it("escapes hostile titles and sanitizes html tabs", () => {
    const card = buildTabCard({
      title: '<script>alert("x")</script>',
      tabs: [{ label: "A", html: '<p onclick="alert(1)">hello</p>' }],
    });
    expect(card.html).not.toContain('<script>alert("x")</script>');
    expect(card.html).not.toContain("onclick");
    expect(card.html).toContain("hello");
  });
});

describe("buildTableCard", () => {
  it("renders explicit rows with headers", () => {
    const card = buildTableCard({
      title: "JavaScript array methods",
      headers: ["Method", "Purpose"],
      rows: [
        ["map", "transform"],
        ["filter", "select"],
      ],
    });
    expect(card.html).toContain("<th scope=\"col\">Method</th>");
    expect(card.html).toContain("<td>filter</td>");
  });

  it("converts raw text and auto-links urls", () => {
    const card = buildTableCard({
      title: "Links",
      text: "Docs | https://example.com/docs",
      headers: ["Name", "Link"],
    });
    expect(card.html).toContain('<a href="https://example.com/docs"');
    expect(card.html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("escapes cell content", () => {
    const card = buildTableCard({ title: "T", rows: [["<img onerror=x>"]] });
    expect(card.html).not.toContain("<img onerror");
    expect(card.html).toContain("&lt;img onerror=x&gt;");
  });
});

describe("buildFormCard", () => {
  it("renders fields, required markers, and prompt template", () => {
    const card = buildFormCard({
      title: "Project intake",
      promptTemplate: "Focus on {{topic}} at a {{level}} level.",
      fields: [
        { name: "topic", label: "Topic", required: true },
        { name: "level", type: "select", options: ["beginner", "advanced"] },
        { name: "notes", type: "textarea" },
      ],
    });
    expect(card.html).toContain("data-prompt-template");
    expect(card.html).toContain("mcc-required");
    expect(card.html).toContain("<select");
    expect(card.html).toContain("<textarea");
  });

  it("embeds a webform target payload for mirrored forms", () => {
    const card = buildFormCard({
      title: "Newsletter signup",
      fields: [{ name: "email", type: "email", required: true }],
      webForm: { sourceUrl: "https://example.com", action: "https://example.com/subscribe", method: "POST" },
    });
    expect(card.html).toContain("data-webform");
    expect(card.html).toContain("example.com/subscribe");
    expect(card.summary).toContain("mirrored web form");
  });
});

describe("buildChartCard", () => {
  it("renders a bar chart with bars per data point", () => {
    const card = buildChartCard({
      title: "Sales",
      type: "bar",
      labels: ["Q1", "Q2"],
      series: [{ name: "Widgets", values: [10, 20] }],
    });
    expect(card.html).toContain("<svg");
    expect((card.html.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(card.html).toContain("View data");
  });

  it("renders pie slices with legend percentages", () => {
    const card = buildChartCard({
      title: "Share",
      type: "pie",
      values: [
        { label: "A", value: 3 },
        { label: "B", value: 1 },
      ],
    });
    expect(card.html).toContain("mcc-legend");
    expect(card.html).toContain("75.0%");
  });

  it("renders a full circle for a single slice", () => {
    const card = buildChartCard({
      title: "All",
      type: "pie",
      values: [{ label: "Only", value: 5 }],
    });
    expect(card.html).toContain("<circle");
  });
});

describe("buildVideoCard", () => {
  const TINY_MP4 = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28y";

  it("renders a video tag with controls", () => {
    const card = buildVideoCard({
      title: "Clip",
      src: "https://example.com/clip.mp4",
      poster: "https://example.com/poster.jpg",
    });
    expect(card.html).toContain("<video class=\"mcc-video-player\" controls");
    expect(card.html).toContain('poster="https://example.com/poster.jpg"');
  });

  it("carries the source as both an attribute and a <source> child", () => {
    const card = buildVideoCard({ title: "Clip", src: "https://example.com/clip.mp4" });
    expect(card.articleHtml).toContain('src="https://example.com/clip.mp4"');
    expect(card.articleHtml).toContain('<source src="https://example.com/clip.mp4" type="video/mp4">');
  });

  it("reserves layout with a frame and offers a direct link", () => {
    const card = buildVideoCard({ title: "Clip", src: "https://example.com/clip.webm" });
    expect(card.articleHtml).toContain('<div class="mcc-video-frame">');
    expect(card.articleHtml).toContain('type="video/webm"');
    expect(card.articleHtml).toContain('class="mcc-video-fallback"');
  });

  it("accepts a data:video source and does not repeat it in a link", () => {
    const card = buildVideoCard({ title: "Inline", src: TINY_MP4 });
    expect(card.articleHtml).toContain(`src="${TINY_MP4}"`);
    expect(card.articleHtml).toContain('type="video/mp4"');
    expect(card.articleHtml).not.toContain("mcc-video-fallback");
    expect(card.summary).toContain("an inline clip");
  });

  it("accepts a blob: source and a data:image poster", () => {
    const card = buildVideoCard({
      title: "Blob",
      src: "blob:https://example.com/8f1c-4a2b",
      poster: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(card.articleHtml).toContain('src="blob:https://example.com/8f1c-4a2b"');
    expect(card.articleHtml).toContain('poster="data:image/png;base64,iVBORw0KGgo="');
  });

  it("autoplay implies muted, since clients ignore unmuted autoplay", () => {
    const card = buildVideoCard({ title: "Loop", src: "https://example.com/clip.mp4", autoplay: true });
    expect(card.articleHtml).toContain(" muted");
    expect(card.articleHtml).toContain(" autoplay");
  });

  it("rejects sources no client could play", () => {
    expect(() => buildVideoCard({ title: "Bad", src: "file:///c:/x.mp4" })).toThrow(
      /data:video/,
    );
    expect(() => buildVideoCard({ title: "Bad", src: "data:text/html;base64,PHNjcmlwdD4=" })).toThrow();
    expect(() => buildVideoCard({ title: "Bad", src: "javascript:alert(1)" })).toThrow();
  });

  it("rejects inline media past the payload cap", () => {
    const huge = `data:video/mp4;base64,${"A".repeat(MAX_INLINE_MEDIA_CHARS)}`;
    expect(() => buildVideoCard({ title: "Huge", src: huge })).toThrow(/character limit/);
  });

  it("drops a poster that is neither an image nor a URL the CSP allows", () => {
    const card = buildVideoCard({
      title: "Clip",
      src: "https://example.com/clip.mp4",
      poster: "javascript:alert(1)",
    });
    expect(card.articleHtml).not.toContain("poster=");
  });
});

describe("buildRevealCard", () => {
  it("renders collapsible sections and expand controls", () => {
    const card = buildRevealCard({
      title: "FAQ",
      sections: [
        { heading: "What is this?", text: "A card.", open: true },
        { heading: "How?", text: "Like so." },
      ],
    });
    expect(card.html).toContain("details");
    expect(card.html).toContain('data-mcc-expand="all"');
    expect(card.html).toContain("<details class=\"mcc-reveal\" open>");
  });
});

describe("buildListCard", () => {
  it("renders nested sequential lists and counts items", () => {
    const card = buildListCard({
      title: "Course outline",
      items: [
        { text: "Basics", children: [{ text: "Setup" }, { text: "First steps" }] },
        { text: "Advanced" },
      ],
    });
    expect(card.html).toContain('ol class="mcc-seq"');
    expect(card.summary).toContain("4 item(s)");
  });
});

describe("card shell", () => {
  it("includes runtime, config, csp, and tutor terms", () => {
    const card = buildTabCard({
      title: "Lesson",
      tabs: [{ label: "Intro", text: "kerning matters in typography" }],
      tutorTerms: [{ term: "kerning", tip: "Adjusting space between letters" }],
      contextActions: [{ label: "Explain more", prompt: "Explain {{selection}} in depth" }],
    });
    expect(card.html).toContain("Content-Security-Policy");
    expect(card.html).toContain('id="mcc-config"');
    expect(card.html).toContain("mcc-term");
    expect(card.html).toContain("Explain more");
    expect(card.html).toContain("mcc-copy-card");
  });
});
