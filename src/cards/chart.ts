// Server-side SVG chart generation: bar, line, pie, and donut. Cool-color
// palette per the style guide; every chart includes a collapsible data table
// for accessibility.
import { escapeHtml, type TutorTerm } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export type ChartType = "bar" | "line" | "pie" | "donut";

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface PieSlice {
  label: string;
  value: number;
}

export interface ChartCardOptions {
  title: string;
  subtitle?: string;
  type: ChartType;
  // bar/line data
  labels?: string[];
  series?: ChartSeries[];
  // pie/donut data
  values?: PieSlice[];
  yLabel?: string;
  description?: string;
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

const PALETTE = ["#2b6cb0", "#2f855a", "#0e7490", "#5b6b7b", "#1d4e89", "#38a169", "#4c7ba8"];

const WIDTH = 640;
const HEIGHT = 340;
const MARGIN = { top: 20, right: 20, bottom: 56, left: 52 };

export interface AxisScale {
  max: number;
  step: number;
  ticks: number[];
}

// Steps a reader can do arithmetic on, in ascending order within each decade.
const STEP_MANTISSAS = [1, 2, 2.5, 5];

// Choose an axis top and tick step covering [0, maxValue] in at most maxTicks
// intervals, picking the SMALLEST readable step that fits rather than
// slicing the range into a fixed number of equal parts. Slicing is what
// produced ticks like 0, 1.3, 2.5, 3.8, 5 for data that only ever took
// integer values; here integer data is additionally held to an integer step,
// so a 1-5 rating scale reads 0, 1, 2, 3, 4, 5.
export function niceScale(maxValue: number, maxTicks = 6, integerData = false): AxisScale {
  if (!(maxValue > 0) || !Number.isFinite(maxValue)) return { max: 1, step: 1, ticks: [0, 1] };

  let step = 0;
  const startExponent = Math.floor(Math.log10(maxValue)) - 2;
  for (let exponent = startExponent; exponent <= startExponent + 9 && step === 0; exponent++) {
    for (const mantissa of STEP_MANTISSAS) {
      const candidate = mantissa * 10 ** exponent;
      if (candidate <= 0) continue;
      if (integerData && !Number.isInteger(candidate)) continue;
      // The epsilon keeps a max that is an exact multiple of the candidate
      // from being counted as one interval too many.
      if (Math.ceil(maxValue / candidate - 1e-9) <= maxTicks) {
        step = candidate;
        break;
      }
    }
  }
  if (step === 0) step = maxValue / maxTicks;

  const max = Number((Math.ceil(maxValue / step - 1e-9) * step).toFixed(6));
  const ticks: number[] = [];
  // Half a step of slack absorbs the float drift that would otherwise drop
  // the top tick when max is an exact multiple of step.
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { max, step, ticks };
}

// Data made only of integers gets an integer axis. A 1-5 rating scale is the
// common case, and fractional ticks on it are noise.
function seriesScale(series: ChartSeries[]): AxisScale {
  const values = series.flatMap((s) => s.values).filter((value) => Number.isFinite(value));
  return niceScale(Math.max(...values, 0), 6, values.every((value) => Number.isInteger(value)));
}

// Only the decimals the step actually needs, so a 0.25 step reads "0.25" and
// a whole-number step never prints "3.0".
function decimalsForStep(step: number): number {
  if (Number.isInteger(step)) return 0;
  const text = step.toPrecision(12).replace(/0+$/, "");
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : Math.min(6, text.length - dot - 1);
}

function formatTick(value: number, step: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(decimalsForStep(step));
}

function axisAndGrid(scale: AxisScale, plotWidth: number, plotHeight: number): string {
  let out = "";
  for (const value of scale.ticks) {
    const y = MARGIN.top + plotHeight - (plotHeight * value) / scale.max;
    out += `<line x1="${MARGIN.left}" y1="${y.toFixed(1)}" x2="${MARGIN.left + plotWidth}" y2="${y.toFixed(1)}" stroke="#d8e2ec" stroke-width="1"/>`;
    out += `<text x="${MARGIN.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5b6b7b">${escapeHtml(
      formatTick(value, scale.step),
    )}</text>`;
  }
  return out;
}

// Break a label across at most maxLines lines without splitting words. A word
// too long to fit on its own line is left alone rather than hyphenated - the
// full text is always reachable from the <title> either way.
export function wrapLabel(label: string, maxChars: number, maxLines: number): string[] {
  const words = label.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [label];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length <= maxLines) return lines;
  // Everything past the last line collapses into it, elided; the <title>
  // still carries the whole label.
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

// Category labels wrap onto up to two lines and carry the full text in a
// <title>, so a long label is readable instead of hard-truncated to
// "Runtime spe…" with no way to see the rest.
function xLabels(labels: string[], plotWidth: number, plotHeight: number): string {
  const step = plotWidth / Math.max(1, labels.length);
  const maxChars = Math.max(6, Math.floor(step / 6));
  return labels
    .map((label, i) => {
      const x = MARGIN.left + step * i + step / 2;
      const y = MARGIN.top + plotHeight + 16;
      const lines = wrapLabel(label, maxChars, 2);
      const tspans = lines
        .map(
          (line, index) =>
            `<tspan x="${x.toFixed(1)}" dy="${index === 0 ? 0 : 12}">${escapeHtml(line)}</tspan>`,
        )
        .join("");
      return (
        `<text x="${x.toFixed(1)}" y="${y}" text-anchor="middle" font-size="11" fill="#1f2328">` +
        `<title>${escapeHtml(label)}</title>${tspans}</text>`
      );
    })
    .join("");
}

function barChartSvg(labels: string[], series: ChartSeries[]): string {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const scale = seriesScale(series);
  const maxValue = scale.max;
  const groupStep = plotWidth / Math.max(1, labels.length);
  const barWidth = Math.max(4, (groupStep * 0.7) / Math.max(1, series.length));

  let bars = "";
  series.forEach((s, si) => {
    s.values.slice(0, labels.length).forEach((value, li) => {
      const height = Math.max(0, (value / maxValue) * plotHeight);
      const x = MARGIN.left + groupStep * li + groupStep * 0.15 + barWidth * si;
      const y = MARGIN.top + plotHeight - height;
      bars +=
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" ` +
        `fill="${PALETTE[si % PALETTE.length]}" rx="2"><title>${escapeHtml(`${s.name} · ${labels[li]}: ${value}`)}</title></rect>`;
    });
  });

  return (
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" xmlns="http://www.w3.org/2000/svg">` +
    axisAndGrid(scale, plotWidth, plotHeight) +
    bars +
    xLabels(labels, plotWidth, plotHeight) +
    "</svg>"
  );
}

function lineChartSvg(labels: string[], series: ChartSeries[]): string {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const scale = seriesScale(series);
  const maxValue = scale.max;
  const step = plotWidth / Math.max(1, labels.length);

  let lines = "";
  series.forEach((s, si) => {
    const color = PALETTE[si % PALETTE.length];
    const points = s.values
      .slice(0, labels.length)
      .map((value, li) => {
        const x = MARGIN.left + step * li + step / 2;
        const y = MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    lines += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`;
    s.values.slice(0, labels.length).forEach((value, li) => {
      const x = MARGIN.left + step * li + step / 2;
      const y = MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
      lines +=
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}">` +
        `<title>${escapeHtml(`${s.name} · ${labels[li]}: ${value}`)}</title></circle>`;
    });
  });

  return (
    `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" xmlns="http://www.w3.org/2000/svg">` +
    axisAndGrid(scale, plotWidth, plotHeight) +
    lines +
    xLabels(labels, plotWidth, plotHeight) +
    "</svg>"
  );
}

function pieChartSvg(slices: PieSlice[], donut: boolean): string {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 10;
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;

  let angle = -Math.PI / 2;
  let paths = "";
  slices.forEach((slice, i) => {
    const share = Math.max(0, slice.value) / total;
    const sweep = share * Math.PI * 2;
    const x1 = cx + radius * Math.cos(angle);
    const y1 = cy + radius * Math.sin(angle);
    const end = angle + sweep;
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const percent = (share * 100).toFixed(1);
    if (share >= 0.999) {
      paths += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${PALETTE[i % PALETTE.length]}"><title>${escapeHtml(
        `${slice.label}: ${slice.value} (${percent}%)`,
      )}</title></circle>`;
    } else if (share > 0) {
      paths +=
        `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" ` +
        `fill="${PALETTE[i % PALETTE.length]}" stroke="#ffffff" stroke-width="1">` +
        `<title>${escapeHtml(`${slice.label}: ${slice.value} (${percent}%)`)}</title></path>`;
    }
    angle = end;
  });
  if (donut) {
    paths += `<circle cx="${cx}" cy="${cy}" r="${radius * 0.55}" fill="#ffffff"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" role="img" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function legend(entries: { label: string; color: string }[]): string {
  const items = entries
    .map(
      (entry) =>
        `<li><span class="mcc-swatch" style="background:${entry.color}"></span>${escapeHtml(entry.label)}</li>`,
    )
    .join("");
  return `<ul class="mcc-legend">${items}</ul>`;
}

function dataTable(options: ChartCardOptions): string {
  let head = "";
  let rows = "";
  if (options.type === "pie" || options.type === "donut") {
    head = "<tr><th scope=\"col\">Label</th><th scope=\"col\">Value</th></tr>";
    rows = (options.values ?? [])
      .map((slice) => `<tr><td>${escapeHtml(slice.label)}</td><td>${escapeHtml(String(slice.value))}</td></tr>`)
      .join("");
  } else {
    const labels = options.labels ?? [];
    head =
      "<tr><th scope=\"col\">Series</th>" +
      labels.map((label) => `<th scope="col">${escapeHtml(label)}</th>`).join("") +
      "</tr>";
    rows = (options.series ?? [])
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.name)}</td>` +
          labels.map((_, i) => `<td>${escapeHtml(String(s.values[i] ?? ""))}</td>`).join("") +
          "</tr>",
      )
      .join("");
  }
  return `<details class="mcc-reveal"><summary>View data</summary><div class="mcc-reveal-body">
<div class="mcc-table-scroll"><table class="mcc-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
</div></details>`;
}

export function buildChartCard(options: ChartCardOptions): RenderedCard {
  let svg: string;
  let legendHtml: string;
  if (options.type === "pie" || options.type === "donut") {
    const slices = options.values ?? [];
    svg = pieChartSvg(slices, options.type === "donut");
    const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;
    legendHtml = legend(
      slices.map((slice, i) => ({
        label: `${slice.label} (${((Math.max(0, slice.value) / total) * 100).toFixed(1)}%)`,
        color: PALETTE[i % PALETTE.length],
      })),
    );
  } else {
    const labels = options.labels ?? [];
    const series = options.series ?? [];
    svg = options.type === "line" ? lineChartSvg(labels, series) : barChartSvg(labels, series);
    legendHtml =
      series.length > 1
        ? legend(series.map((s, i) => ({ label: s.name, color: PALETTE[i % PALETTE.length] })))
        : "";
  }

  const description = options.description
    ? `<p class="mcc-help">${escapeHtml(options.description)}</p>`
    : "";
  const yLabel = options.yLabel ? `<p class="mcc-help">${escapeHtml(options.yLabel)}</p>` : "";

  const body = `<section class="mcc-block mcc-chart">
${description}${yLabel}
${svg}
${legendHtml}
${dataTable(options)}
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: `chart-${options.type}`,
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  const points =
    options.type === "pie" || options.type === "donut"
      ? `${options.values?.length ?? 0} slice(s)`
      : `${options.series?.length ?? 0} series over ${options.labels?.length ?? 0} label(s)`;
  return {
    ...doc,
    summary: `Created ${options.type} chart card "${options.title}" (${points}) as an SVG with a collapsible data table.`,
  };
}
