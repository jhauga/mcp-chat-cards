import { describe, expect, it } from "vitest";
import { buildTabCard } from "../src/cards/tabs.js";
import { buildTableCard } from "../src/cards/table.js";
import { buildFormCard } from "../src/cards/form.js";
import { buildChartCard } from "../src/cards/chart.js";
import { buildVideoCard } from "../src/cards/video.js";
import { buildRevealCard } from "../src/cards/reveal.js";
import { buildListCard } from "../src/cards/list.js";

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
  it("renders a video tag with controls", () => {
    const card = buildVideoCard({
      title: "Clip",
      src: "https://example.com/clip.mp4",
      poster: "https://example.com/poster.jpg",
    });
    expect(card.html).toContain("<video controls");
    expect(card.html).toContain('poster="https://example.com/poster.jpg"');
  });

  it("rejects non-http sources", () => {
    expect(() => buildVideoCard({ title: "Bad", src: "file:///c:/x.mp4" })).toThrow();
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
