// Animation card: a short model-composed "clip" for when no direct video URL
// exists but the conversation calls for motion. Scenes play sequentially like
// slides inside a 16:9 stage with video-style controls (play/pause, replay,
// progress). Everything is text, inline SVG, and CSS transitions - no external
// assets, so it renders under the cards' strict CSP.
//
// A scene mixes any of: heading, body text, staggered bullet builds, simple
// SVG shapes (rect/circle/line/arrow, drawn on a 100x100 percent grid), and a
// compact single-series bar/line chart that can zoom into a label range
// mid-scene (the runtime animates the SVG viewBox in and back out). Transition
// presets (fade/slide/zoom/draw) per scene keep variations cheap: the same
// schema composes title reveals, bullet builds, diagram walk-throughs, and
// chart fly-ins in any order.
import { escapeHtml, uid, type TutorTerm } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export type MotionTransition = "fade" | "slide" | "zoom" | "draw";

export interface MotionShape {
  type: "rect" | "circle" | "line" | "arrow";
  // Percent coordinates on the stage: x 0-100 (left-right), y 0-100 (top-bottom).
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  x2?: number;
  y2?: number;
  label?: string;
  color?: string;
}

export interface MotionChart {
  type: "bar" | "line";
  labels: string[];
  values: number[];
  // Label index range (inclusive) the runtime zooms into mid-scene.
  zoom?: { from: number; to: number };
}

export interface MotionScene {
  heading?: string;
  text?: string;
  bullets?: string[];
  shapes?: MotionShape[];
  chart?: MotionChart;
  transition?: MotionTransition;
  durationMs?: number;
}

export interface MotionCardOptions {
  title: string;
  subtitle?: string;
  scenes: MotionScene[];
  autoplay?: boolean;
  loop?: boolean;
  // Default per-scene duration when a scene does not set its own.
  sceneDurationMs?: number;
  tutorTerms?: TutorTerm[];
  contextActions?: ContextAction[];
}

const MAX_SCENES = 12;
const MAX_BULLETS = 6;
const DEFAULT_SCENE_MS = 3500;
const MIN_SCENE_MS = 1200;
const MAX_SCENE_MS = 20000;

const PALETTE = ["#2b6cb0", "#2f855a", "#0e7490", "#b45309", "#1d4e89", "#38a169"];

// Stage geometry shared with the runtime's zoom animation: shapes and charts
// draw into a 160x90 viewBox (16:9).
const STAGE_W = 160;
const STAGE_H = 90;

function safeColor(color: string | undefined, fallback: string): string {
  return color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// Percent grid to stage units.
function sx(value: number): number {
  return (clampPercent(value) / 100) * STAGE_W;
}
function sy(value: number): number {
  return (clampPercent(value) / 100) * STAGE_H;
}

function shapeSvg(shapes: MotionShape[]): string {
  const parts = shapes.map((shape, i) => {
    const color = safeColor(shape.color, PALETTE[i % PALETTE.length]);
    const label = shape.label
      ? `<text x="${sx(shape.x).toFixed(1)}" y="${(sy(shape.y) - 2).toFixed(1)}" font-size="5" fill="#1f2328">${escapeHtml(shape.label)}</text>`
      : "";
    if (shape.type === "rect") {
      return (
        `<rect class="mcc-draw" x="${sx(shape.x).toFixed(1)}" y="${sy(shape.y).toFixed(1)}" ` +
        `width="${((clampPercent(shape.w ?? 20) / 100) * STAGE_W).toFixed(1)}" ` +
        `height="${((clampPercent(shape.h ?? 15) / 100) * STAGE_H).toFixed(1)}" ` +
        `fill="none" stroke="${color}" stroke-width="1.5" rx="2"/>` + label
      );
    }
    if (shape.type === "circle") {
      return (
        `<circle class="mcc-draw" cx="${sx(shape.x).toFixed(1)}" cy="${sy(shape.y).toFixed(1)}" ` +
        `r="${((clampPercent(shape.r ?? 10) / 100) * STAGE_H).toFixed(1)}" ` +
        `fill="none" stroke="${color}" stroke-width="1.5"/>` + label
      );
    }
    // line and arrow
    const x1 = sx(shape.x);
    const y1 = sy(shape.y);
    const x2 = sx(shape.x2 ?? clampPercent(shape.x + 20));
    const y2 = sy(shape.y2 ?? shape.y);
    let head = "";
    if (shape.type === "arrow") {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const size = 4;
      const hx1 = x2 - size * Math.cos(angle - Math.PI / 6);
      const hy1 = y2 - size * Math.sin(angle - Math.PI / 6);
      const hx2 = x2 - size * Math.cos(angle + Math.PI / 6);
      const hy2 = y2 - size * Math.sin(angle + Math.PI / 6);
      head =
        `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${hx1.toFixed(1)},${hy1.toFixed(1)} ` +
        `${hx2.toFixed(1)},${hy2.toFixed(1)}" fill="${color}"/>`;
    }
    return (
      `<line class="mcc-draw" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" ` +
      `y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>` + head + label
    );
  });
  return (
    `<svg class="mcc-motion-shapes" viewBox="0 0 ${STAGE_W} ${STAGE_H}" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${parts.join("")}</svg>`
  );
}

// Compact single-series chart sized for the stage. The zoom range becomes a
// data attribute holding the target viewBox; the runtime animates to it and
// back during the scene.
function chartSvg(chart: MotionChart): string {
  const ml = 16;
  const mr = 4;
  const mt = 6;
  const mb = 12;
  const plotW = STAGE_W - ml - mr;
  const plotH = STAGE_H - mt - mb;
  const count = Math.max(1, chart.labels.length);
  const maxValue = Math.max(...chart.values, 0) || 1;
  const step = plotW / count;

  let marks = "";
  // Light horizontal grid with min/max hints.
  for (let i = 0; i <= 2; i++) {
    const y = mt + plotH - (plotH * i) / 2;
    const value = (maxValue / 2) * i;
    marks += `<line x1="${ml}" y1="${y.toFixed(1)}" x2="${ml + plotW}" y2="${y.toFixed(1)}" stroke="#d8e2ec" stroke-width="0.5"/>`;
    marks += `<text x="${ml - 2}" y="${(y + 1.8).toFixed(1)}" text-anchor="end" font-size="4.5" fill="#5b6b7b">${escapeHtml(
      Number.isInteger(value) ? String(value) : value.toFixed(1),
    )}</text>`;
  }

  if (chart.type === "bar") {
    chart.values.slice(0, count).forEach((value, i) => {
      const height = Math.max(0, (value / maxValue) * plotH);
      const x = ml + step * i + step * 0.15;
      const y = mt + plotH - height;
      marks +=
        `<rect class="mcc-motion-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(step * 0.7).toFixed(1)}" ` +
        `height="${height.toFixed(1)}" fill="${PALETTE[0]}" rx="0.8"><title>${escapeHtml(
          `${chart.labels[i]}: ${value}`,
        )}</title></rect>`;
    });
  } else {
    const points = chart.values
      .slice(0, count)
      .map((value, i) => {
        const x = ml + step * i + step / 2;
        const y = mt + plotH - (value / maxValue) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    marks += `<polyline class="mcc-draw" points="${points}" fill="none" stroke="${PALETTE[0]}" stroke-width="1.5"/>`;
    chart.values.slice(0, count).forEach((value, i) => {
      const x = ml + step * i + step / 2;
      const y = mt + plotH - (value / maxValue) * plotH;
      marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="${PALETTE[0]}"><title>${escapeHtml(
        `${chart.labels[i]}: ${value}`,
      )}</title></circle>`;
    });
  }

  chart.labels.slice(0, count).forEach((label, i) => {
    const x = ml + step * i + step / 2;
    const short = label.length > 9 ? `${label.slice(0, 8)}…` : label;
    marks += `<text x="${x.toFixed(1)}" y="${(mt + plotH + 6).toFixed(1)}" text-anchor="middle" font-size="4.5" fill="#1f2328">${escapeHtml(short)}</text>`;
  });

  let zoomAttr = "";
  if (chart.zoom) {
    const from = Math.max(0, Math.min(count - 1, Math.floor(chart.zoom.from)));
    const to = Math.max(from, Math.min(count - 1, Math.floor(chart.zoom.to)));
    const values = chart.values.slice(from, to + 1);
    const rangeMax = Math.max(...values, 0) || 1;
    const x0 = Math.max(0, ml + step * from - 2);
    const x1 = Math.min(STAGE_W, ml + step * (to + 1) + 2);
    const yTop = Math.max(0, mt + plotH - (rangeMax / maxValue) * plotH - 6);
    const box = `${x0.toFixed(1)} ${yTop.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(mt + plotH + 8 - yTop).toFixed(1)}`;
    zoomAttr = ` data-mcc-zoom="${box}"`;
  }

  return (
    `<svg class="mcc-motion-chart" viewBox="0 0 ${STAGE_W} ${STAGE_H}"${zoomAttr} ` +
    `xmlns="http://www.w3.org/2000/svg" role="img">${marks}</svg>`
  );
}

function sceneHtml(scene: MotionScene, index: number, defaultMs: number): string {
  const transition = scene.transition ?? "fade";
  const duration = Math.max(MIN_SCENE_MS, Math.min(MAX_SCENE_MS, scene.durationMs ?? defaultMs));
  const heading = scene.heading
    ? `<h2 class="mcc-motion-heading">${escapeHtml(scene.heading)}</h2>`
    : "";
  const text = scene.text ? `<p class="mcc-motion-text">${escapeHtml(scene.text)}</p>` : "";
  const bullets =
    scene.bullets && scene.bullets.length > 0
      ? `<ul class="mcc-motion-bullets">` +
        scene.bullets
          .slice(0, MAX_BULLETS)
          .map(
            (bullet, i) =>
              `<li class="mcc-motion-bullet" style="transition-delay:${(i * 350).toFixed(0)}ms">${escapeHtml(bullet)}</li>`,
          )
          .join("") +
        "</ul>"
      : "";
  const shapes = scene.shapes && scene.shapes.length > 0 ? shapeSvg(scene.shapes) : "";
  const chart = scene.chart ? chartSvg(scene.chart) : "";
  return (
    `<section class="mcc-scene mcc-scene-${transition}" data-duration="${duration}" ` +
    `aria-label="Scene ${index + 1}">${heading}${text}${bullets}${shapes}${chart}</section>`
  );
}

export function buildMotionCard(options: MotionCardOptions): RenderedCard {
  if (options.scenes.length === 0) {
    throw new Error("An animation card needs at least one scene.");
  }
  if (options.scenes.length > MAX_SCENES) {
    throw new Error(`An animation card supports at most ${MAX_SCENES} scenes.`);
  }
  for (const scene of options.scenes) {
    if (scene.chart && scene.chart.labels.length !== scene.chart.values.length) {
      throw new Error("Chart scenes need the same number of labels and values.");
    }
  }

  const defaultMs = Math.max(
    MIN_SCENE_MS,
    Math.min(MAX_SCENE_MS, options.sceneDurationMs ?? DEFAULT_SCENE_MS),
  );
  const groupId = uid("motion");
  const scenes = options.scenes
    .map((scene, index) => sceneHtml(scene, index, defaultMs))
    .join("\n");

  const body = `<section class="mcc-block mcc-motion" id="${groupId}"
 data-autoplay="${options.autoplay === false ? "0" : "1"}" data-loop="${options.loop ? "1" : "0"}">
<div class="mcc-stage">
${scenes}
</div>
<div class="mcc-motion-bar">
<button type="button" class="mcc-btn mcc-motion-play">Pause</button>
<button type="button" class="mcc-btn mcc-motion-replay">Replay</button>
<span class="mcc-motion-step"></span>
<div class="mcc-motion-progress"><div class="mcc-motion-progress-fill"></div></div>
</div>
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "motion",
    body,
    tutorTerms: options.tutorTerms,
    contextActions: options.contextActions,
  });
  return {
    ...doc,
    summary:
      `Created animation card "${options.title}" with ${options.scenes.length} scene(s) ` +
      "playing sequentially with play/pause, replay, and progress controls.",
  };
}
