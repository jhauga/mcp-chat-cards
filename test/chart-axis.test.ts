// Axis regressions: integer data must produce integer ticks, and a long
// category label must stay readable instead of being hard-truncated with no
// way to see the rest.
import { describe, expect, it } from "vitest";
import { buildChartCard, niceScale, wrapLabel } from "../src/cards/chart.js";

describe("niceScale", () => {
  it("gives integer data integer ticks", () => {
    // The reported case: a 1-5 rating scale rendered 0, 1.3, 2.5, 3.8, 5.
    expect(niceScale(5, 6, true).ticks).toEqual([0, 1, 2, 3, 4, 5]);
    expect(niceScale(3, 6, true).ticks).toEqual([0, 1, 2, 3]);
    expect(niceScale(7, 6, true).ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it("keeps steps readable at larger magnitudes", () => {
    expect(niceScale(42, 6, true)).toMatchObject({ step: 10, max: 50 });
    expect(niceScale(100, 6, true)).toMatchObject({ step: 20, max: 100 });
    expect(niceScale(1234, 6, true).step).toBe(250);
  });

  it("handles fractional data without forcing integers", () => {
    const scale = niceScale(0.45, 6, false);
    expect(scale.step).toBe(0.1);
    expect(scale.max).toBeCloseTo(0.5, 6);
  });

  it("never exceeds the requested number of intervals", () => {
    for (const max of [1, 5, 9, 13, 47, 99, 501, 6789]) {
      expect(niceScale(max, 6, true).ticks.length).toBeLessThanOrEqual(7);
    }
  });

  it("degrades safely on empty or invalid data", () => {
    expect(niceScale(0).ticks).toEqual([0, 1]);
    expect(niceScale(-4).ticks).toEqual([0, 1]);
    expect(niceScale(Number.NaN).ticks).toEqual([0, 1]);
  });
});

describe("wrapLabel", () => {
  it("breaks on word boundaries", () => {
    expect(wrapLabel("Runtime speed", 10, 2)).toEqual(["Runtime", "speed"]);
    expect(wrapLabel("Ecosystem breadth today", 14, 2)).toEqual(["Ecosystem", "breadth today"]);
  });

  it("keeps a word that cannot fit rather than splitting it", () => {
    expect(wrapLabel("Concurrency", 6, 2)).toEqual(["Concurrency"]);
  });

  it("elides only what runs past the last line", () => {
    expect(wrapLabel("one two three four five", 4, 2)).toEqual(["one", "two…"]);
  });
});

describe("chart card axis rendering", () => {
  const card = buildChartCard({
    title: "Language scorecard",
    type: "bar",
    labels: ["Runtime speed", "Concurrency", "Ecosystem breadth", "Tooling", "Learning curve"],
    series: [{ name: "Rust", values: [5, 5, 4, 4, 2] }],
  });

  it("labels the y axis with integers only", () => {
    const ticks = [...card.articleHtml.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );
    expect(ticks).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("wraps long category labels and keeps the full text in a title", () => {
    expect(card.articleHtml).toContain("<title>Ecosystem breadth</title>");
    expect(card.articleHtml).toContain("<tspan");
    // Nothing is silently clipped to "Ecosystem b…" any more.
    expect(card.articleHtml).not.toContain("Ecosystem b…");
  });

  it("puts plain text in bar tooltips, never markup", () => {
    const withTerms = buildChartCard({
      title: "Language scorecard",
      type: "bar",
      labels: ["Memory safety"],
      series: [{ name: "Rust", values: [5] }],
      tutorTerms: [{ term: "Memory safety", tip: "No data races at compile time" }],
    });
    for (const [, text] of withTerms.articleHtml.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      expect(text).not.toContain("<");
    }
    expect(withTerms.articleHtml).toContain("<title>Rust · Memory safety: 5</title>");
  });
});
