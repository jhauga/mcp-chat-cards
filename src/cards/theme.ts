// Shared card stylesheet. Palette follows the project style guide:
// 60% light cool primary surfaces, 30% secondary cool tones, 10% accent,
// dark neutral text on light backgrounds, subtle same-family gradients.
export const CARD_THEME_CSS = `
:root {
  --mcc-bg-a: #f5f8fb;
  --mcc-bg-b: #eef3f8;
  --mcc-surface: #ffffff;
  --mcc-text: #1f2328;
  --mcc-muted: #5b6b7b;
  --mcc-border: #d8e2ec;
  --mcc-primary: #2b6cb0;
  --mcc-primary-dark: #1a4f86;
  --mcc-primary-soft: #e7f0f9;
  --mcc-green: #2f855a;
  --mcc-accent: #b45309;
  --mcc-head-a: #f2f7fc;
  --mcc-head-b: #eaf1f8;
  --mcc-soft-bg: #f7fafc;
  --mcc-code-bg: #f3f6fa;
  --mcc-reveal-bg: #fbfdfe;
  --mcc-radius: 10px;
}
/* Applied by the MCP Apps template when the host reports a dark theme. */
:root[data-theme="dark"] {
  --mcc-bg-a: #161a20;
  --mcc-bg-b: #12161b;
  --mcc-surface: #1d232b;
  --mcc-text: #e8edf2;
  --mcc-muted: #9aa7b4;
  --mcc-border: #313c48;
  --mcc-primary: #5b9bd5;
  --mcc-primary-dark: #93bfe8;
  --mcc-primary-soft: #253444;
  --mcc-green: #5cbd8f;
  --mcc-accent: #d9a05f;
  --mcc-head-a: #222933;
  --mcc-head-b: #1c232c;
  --mcc-soft-bg: #191f26;
  --mcc-code-bg: #171d24;
  --mcc-reveal-bg: #1a2129;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--mcc-text);
  background: linear-gradient(180deg, var(--mcc-bg-a), var(--mcc-bg-b));
  padding: 10px;
}
.mcc-card {
  background: var(--mcc-surface);
  border: 1px solid var(--mcc-border);
  border-radius: var(--mcc-radius);
  box-shadow: 0 1px 3px rgba(31, 35, 40, 0.08);
  overflow: hidden;
}
.mcc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--mcc-head-a), var(--mcc-head-b));
  border-bottom: 1px solid var(--mcc-border);
}
.mcc-head h1 { font-size: 16px; margin: 0; font-weight: 600; }
.mcc-subtitle { margin: 2px 0 0; font-size: 12px; color: var(--mcc-muted); }
.mcc-tools { display: flex; gap: 6px; flex-shrink: 0; }
.mcc-body { padding: 14px; }
.mcc-foot {
  padding: 6px 14px;
  font-size: 11px;
  color: var(--mcc-muted);
  border-top: 1px solid var(--mcc-border);
  background: var(--mcc-soft-bg);
}
.mcc-btn {
  font: inherit;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--mcc-border);
  background: var(--mcc-surface);
  color: var(--mcc-primary-dark);
  cursor: pointer;
}
.mcc-btn:hover { background: var(--mcc-primary-soft); }
.mcc-btn:focus-visible { outline: 2px solid var(--mcc-primary); outline-offset: 1px; }
.mcc-btn-primary { background: var(--mcc-primary); border-color: var(--mcc-primary-dark); color: #ffffff; }
.mcc-btn-primary:hover { background: var(--mcc-primary-dark); }
/* The header toggle buttons (card code, collapse) are created and styled by
   the card runtime (see RUNTIME_CSS in runtime.ts), so cards from older tool
   results pick them up too. */

/* Draggable blocks */
.mcc-block { position: relative; margin: 0 0 12px; padding-left: 18px; }
.mcc-block:last-child { margin-bottom: 0; }
.mcc-drag {
  position: absolute;
  left: 0;
  top: 2px;
  width: 14px;
  color: var(--mcc-muted);
  cursor: grab;
  user-select: none;
  font-size: 12px;
  line-height: 1;
  opacity: 0.35;
}
.mcc-block:hover > .mcc-drag { opacity: 1; }
.mcc-block.mcc-dragging { opacity: 0.5; }
.mcc-block.mcc-drop-target { outline: 2px dashed var(--mcc-primary); outline-offset: 2px; }

/* Tabs */
.mcc-tabs [role="tablist"] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 2px solid var(--mcc-border);
  margin-bottom: 10px;
}
.mcc-tab {
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: var(--mcc-muted);
  cursor: pointer;
  margin-bottom: -2px;
}
.mcc-tab:hover { color: var(--mcc-primary-dark); background: var(--mcc-primary-soft); }
.mcc-tab[aria-selected="true"] {
  color: var(--mcc-primary-dark);
  font-weight: 600;
  background: var(--mcc-surface);
  border-color: var(--mcc-border) var(--mcc-border) var(--mcc-surface);
  border-bottom: 2px solid var(--mcc-surface);
}
.mcc-panel[hidden] { display: none; }

/* Tables */
table.mcc-table { border-collapse: collapse; width: 100%; font-size: 13px; }
.mcc-table caption { caption-side: top; text-align: left; color: var(--mcc-muted); font-size: 12px; padding-bottom: 6px; }
.mcc-table th, .mcc-table td { border: 1px solid var(--mcc-border); padding: 6px 10px; text-align: left; vertical-align: top; }
.mcc-table thead th { background: var(--mcc-primary-soft); color: var(--mcc-primary-dark); }
.mcc-table tbody tr:nth-child(even) { background: var(--mcc-soft-bg); }
.mcc-table a { color: var(--mcc-primary); }
.mcc-table-scroll { overflow-x: auto; }

/* Forms */
.mcc-form { display: grid; gap: 10px; }
.mcc-field { display: grid; gap: 3px; }
.mcc-field label { font-size: 13px; font-weight: 600; }
.mcc-required { color: var(--mcc-accent); margin-left: 2px; }
.mcc-help { font-size: 12px; color: var(--mcc-muted); }
.mcc-field input[type="text"], .mcc-field input[type="email"], .mcc-field input[type="number"],
.mcc-field input[type="url"], .mcc-field input[type="date"], .mcc-field input[type="password"],
.mcc-field select, .mcc-field textarea {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  background: var(--mcc-surface);
  color: var(--mcc-text);
  width: 100%;
}
.mcc-field textarea { min-height: 70px; resize: vertical; }
.mcc-field input:focus-visible, .mcc-field select:focus-visible, .mcc-field textarea:focus-visible {
  outline: 2px solid var(--mcc-primary);
  outline-offset: 0;
}
.mcc-choice { display: flex; align-items: center; gap: 6px; font-weight: 400; }
.mcc-form-status { font-size: 12px; color: var(--mcc-green); min-height: 16px; }
.mcc-form-fallback { display: none; }
.mcc-form-fallback.mcc-visible { display: block; }
.mcc-form-fallback textarea { width: 100%; min-height: 90px; font-family: Consolas, monospace; font-size: 12px; }

/* File view: one file, more than one way to read it, with a toggle bar.
   Raw | Code for source, Raw | Rendered for markdown. */
.mcc-fileview-bar {
  display: flex;
  gap: 0;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.mcc-fileview-btn { border-radius: 0; }
.mcc-fileview-btn:first-child { border-radius: 6px 0 0 6px; }
.mcc-fileview-btn:last-child { border-radius: 0 6px 6px 0; margin-left: -1px; }
.mcc-fileview-btn.mcc-active {
  background: var(--mcc-primary);
  border-color: var(--mcc-primary-dark);
  color: #ffffff;
  position: relative;
  z-index: 1;
}
.mcc-fileview-pane[hidden] { display: none; }
.mcc-fileview-pane > :first-child { margin-top: 0; }

/* Code file view: line-number gutter beside the source. The gutter is a
   sibling of the code and is never selected, so a copy or a drag through the
   file picks up the file and not its numbering. */
.mcc-code-scroll { display: flex; align-items: stretch; }
.mcc-codefile .mcc-gutter {
  flex: 0 0 auto;
  margin: 0;
  padding: 10px 8px 10px 12px;
  border: none;
  border-right: 1px solid var(--mcc-border);
  background: transparent;
  color: var(--mcc-muted);
  text-align: right;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
  line-height: 1.5;
}
.mcc-codefile .mcc-code {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 10px 12px;
  border: none;
  background: transparent;
  line-height: 1.5;
}
.mcc-codefile .mcc-codewrap {
  padding: 0;
  background: var(--mcc-code-bg);
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  overflow: hidden;
}

/* Syntax tokens. Chosen to stay legible on both card backgrounds rather than
   to match any one editor theme. */
.mcc-t-c { color: var(--mcc-muted); font-style: italic; }
.mcc-t-s { color: var(--mcc-green); }
.mcc-t-n { color: var(--mcc-accent); }
.mcc-t-k { color: var(--mcc-primary-dark); font-weight: 600; }
.mcc-t-y { color: var(--mcc-primary); }

/* Raw view: the same text with the styling switched off, which is what a
   repository browser shows for a raw file. Nothing is re-rendered, so the
   card carries one copy of the source rather than two. */
.mcc-fileview[data-mcc-view="raw"] .mcc-gutter { display: none; }
.mcc-fileview[data-mcc-view="raw"] .mcc-t-c,
.mcc-fileview[data-mcc-view="raw"] .mcc-t-s,
.mcc-fileview[data-mcc-view="raw"] .mcc-t-n,
.mcc-fileview[data-mcc-view="raw"] .mcc-t-k,
.mcc-fileview[data-mcc-view="raw"] .mcc-t-y {
  color: var(--mcc-text);
  font-style: normal;
  font-weight: normal;
}

/* Prompt outbox: what happened to a prompt the card handed to the host */
#mcc-outbox {
  margin-top: 12px;
  padding: 8px 10px;
  border: 1px solid var(--mcc-border);
  border-left: 3px solid var(--mcc-primary);
  border-radius: 6px;
  background: var(--mcc-soft-bg);
}
#mcc-outbox[hidden] { display: none; }
.mcc-outbox-status { margin: 0; font-size: 12px; color: var(--mcc-muted); }
.mcc-outbox-body[hidden] { display: none; }
.mcc-outbox-body textarea {
  width: 100%;
  min-height: 72px;
  margin-top: 6px;
  padding: 6px 8px;
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  background: var(--mcc-surface);
  color: var(--mcc-text);
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  resize: vertical;
}
.mcc-outbox-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

/* Prompt forge: gist, refine, and finished-prompt cards */
.mcc-forge-meta { display: block; margin-top: 2px; }
.mcc-forge-q { margin-bottom: 4px; }
.mcc-other { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.mcc-field .mcc-other input[type="text"] { flex: 1 1 auto; width: auto; min-width: 0; }
.mcc-field textarea.mcc-forge-prompt {
  min-height: 150px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
}
.mcc-forge-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.mcc-forge-notes { margin: 8px 0 0; }
.mcc-confirm {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--mcc-accent);
  border-radius: 6px;
  background: var(--mcc-soft-bg);
}
.mcc-confirm[hidden] { display: none; }
.mcc-confirm p { margin: 0; font-size: 13px; font-weight: 600; }
.mcc-confirm .mcc-forge-actions { margin-top: 8px; }

/* Code */
.mcc-codewrap { position: relative; }
.mcc-codewrap pre {
  margin: 0;
  padding: 10px 12px;
  background: var(--mcc-code-bg);
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  overflow-x: auto;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
}
.mcc-copy-code { position: absolute; top: 6px; right: 6px; }

/* Show/hide sections */
details.mcc-reveal {
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  margin-bottom: 8px;
  background: var(--mcc-reveal-bg);
}
details.mcc-reveal > summary {
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 600;
  color: var(--mcc-primary-dark);
  list-style: none;
}
details.mcc-reveal > summary::before { content: "\\25B8"; display: inline-block; margin-right: 6px; transition: transform 0.15s; }
details.mcc-reveal[open] > summary::before { transform: rotate(90deg); }
details.mcc-reveal > .mcc-reveal-body { padding: 0 12px 10px; }

/* Sequential nested lists: 1., 1.1., 1.1.1. via CSS counters */
ol.mcc-seq { counter-reset: mccseq; list-style: none; padding-left: 6px; margin: 0; }
ol.mcc-seq li { counter-increment: mccseq; margin: 4px 0; }
ol.mcc-seq li::before {
  content: counters(mccseq, ".") ". ";
  font-weight: 600;
  color: var(--mcc-primary-dark);
}
ol.mcc-seq ol.mcc-seq { padding-left: 22px; }

/* Charts */
.mcc-chart svg { max-width: 100%; height: auto; display: block; }
ul.mcc-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0; margin: 8px 0 0; font-size: 12px; }
ul.mcc-legend .mcc-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; }

/* Video. The frame reserves a 16:9 box before metadata arrives, and the
   player fills it, so a clip that is still buffering (or blocked outright)
   never collapses the card to an invisible zero-height element. */
.mcc-video-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 360px;
  min-height: 160px;
  border-radius: 6px;
  overflow: hidden;
  background: #1f2328;
}
.mcc-video video, .mcc-video-frame video {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 160px;
  max-height: 360px;
  border-radius: 6px;
  background: #1f2328;
  object-fit: contain;
}
.mcc-video-fallback { margin: 6px 0 0; font-size: 12px; }
.mcc-video-note {
  margin: 6px 0 0;
  padding: 8px 10px;
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  color: var(--mcc-muted);
  font-size: 12px;
}

/* Animation cards: 16:9 stage of stacked scenes played by the runtime */
.mcc-motion .mcc-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--mcc-border);
  border-radius: 6px;
  background: linear-gradient(180deg, var(--mcc-surface), var(--mcc-soft-bg));
}
.mcc-scene {
  position: absolute;
  inset: 0;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s, transform 0.5s, visibility 0.5s;
}
.mcc-scene.mcc-active { opacity: 1; visibility: visible; }
.mcc-scene-slide { transform: translateX(28px); }
.mcc-scene-slide.mcc-active { transform: none; }
.mcc-scene-zoom { transform: scale(0.85); }
.mcc-scene-zoom.mcc-active { transform: scale(1); }
/* "draw": shapes and chart lines trace themselves in as the scene enters. */
.mcc-scene-draw .mcc-draw { stroke-dasharray: 600; stroke-dashoffset: 600; }
.mcc-scene-draw.mcc-active .mcc-draw { animation: mcc-draw-in 1.2s ease forwards; }
@keyframes mcc-draw-in { to { stroke-dashoffset: 0; } }
.mcc-motion-heading { margin: 0; font-size: 20px; color: var(--mcc-primary-dark); }
.mcc-motion-text { margin: 0; font-size: 14px; }
.mcc-motion-bullets { margin: 0; padding-left: 20px; }
.mcc-motion-bullet {
  margin: 3px 0;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.4s, transform 0.4s;
}
.mcc-scene.mcc-active .mcc-motion-bullet { opacity: 1; transform: none; }
.mcc-motion-shapes, .mcc-motion-chart { flex: 1 1 auto; min-height: 0; width: 100%; }
.mcc-motion-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.mcc-motion-step { font-size: 12px; color: var(--mcc-muted); white-space: nowrap; }
.mcc-motion-progress {
  flex: 1 1 auto;
  height: 4px;
  border-radius: 2px;
  background: var(--mcc-primary-soft);
  overflow: hidden;
}
.mcc-motion-progress-fill { width: 0%; height: 100%; background: var(--mcc-primary); }

/* Tutor terms and tooltip */
.mcc-term { border-bottom: 1px dotted var(--mcc-primary); cursor: help; }
#mcc-tooltip {
  position: fixed;
  z-index: 40;
  max-width: 280px;
  background: #24384c;
  color: #f0f4f8;
  font-size: 12px;
  padding: 6px 9px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(31, 35, 40, 0.25);
  pointer-events: none;
  display: none;
}

/* Context menu */
#mcc-menu {
  position: fixed;
  z-index: 50;
  min-width: 180px;
  background: var(--mcc-surface);
  border: 1px solid var(--mcc-border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(31, 35, 40, 0.18);
  padding: 4px;
  display: none;
}
#mcc-menu button {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--mcc-text);
  cursor: pointer;
}
#mcc-menu button:hover { background: var(--mcc-primary-soft); color: var(--mcc-primary-dark); }
#mcc-menu .mcc-menu-sep { border-top: 1px solid var(--mcc-border); margin: 4px 2px; }

p { margin: 0 0 8px; }
img { max-width: 100%; height: auto; }

/* Document card typography (rendered markdown) */
.mcc-doc h2, .mcc-doc h3, .mcc-doc h4 { color: var(--mcc-primary-dark); margin: 14px 0 6px; }
.mcc-doc h2 { font-size: 15px; }
.mcc-doc h3 { font-size: 14px; }
.mcc-doc ul, .mcc-doc ol { margin: 0 0 8px; padding-left: 22px; }
.mcc-doc li { margin: 2px 0; }
.mcc-doc blockquote {
  margin: 0 0 8px;
  padding: 6px 12px;
  border-left: 3px solid var(--mcc-primary);
  background: var(--mcc-primary-soft);
  border-radius: 0 6px 6px 0;
}
.mcc-doc hr { border: none; border-top: 1px solid var(--mcc-border); margin: 12px 0; }
.mcc-doc a { color: var(--mcc-primary); }
.mcc-body code {
  background: var(--mcc-code-bg);
  border: 1px solid var(--mcc-border);
  border-radius: 4px;
  padding: 0 4px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
}
.mcc-codewrap pre code { background: transparent; border: none; padding: 0; }
`;
