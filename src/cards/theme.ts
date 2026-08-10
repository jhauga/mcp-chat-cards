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
  --mcc-radius: 10px;
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
  background: linear-gradient(180deg, #f2f7fc, #eaf1f8);
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
  background: #f7fafc;
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
.mcc-table tbody tr:nth-child(even) { background: #f7fafc; }
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
  background: #ffffff;
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

/* Code */
.mcc-codewrap { position: relative; }
.mcc-codewrap pre {
  margin: 0;
  padding: 10px 12px;
  background: #f3f6fa;
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
  background: #fbfdfe;
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

/* Video */
.mcc-video video { width: 100%; max-height: 360px; border-radius: 6px; background: #1f2328; }

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
  background: #f3f6fa;
  border: 1px solid var(--mcc-border);
  border-radius: 4px;
  padding: 0 4px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
}
.mcc-codewrap pre code { background: transparent; border: none; padding: 0; }
`;
