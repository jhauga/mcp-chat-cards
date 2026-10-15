/* mcp-chat-cards 1.0.0-alpha.1.0.1 visualizer widget runtime. Generated from src/cards/widget.ts by scripts/build-widget.mjs; do not edit by hand. */
(function () {
  "use strict";

  if (window.__mccWidgetLoaded) return;
  window.__mccWidgetLoaded = "1.0.0-alpha.1.0.1";

  var root = document.documentElement;
  root.setAttribute("data-mcc-host", "widget");

  var theme = document.createElement("style");
  theme.id = "mcc-theme";
  theme.textContent = "\n:root {\n  --mcc-bg-a: #f5f8fb;\n  --mcc-bg-b: #eef3f8;\n  --mcc-surface: #ffffff;\n  --mcc-text: #1f2328;\n  --mcc-muted: #5b6b7b;\n  --mcc-border: #d8e2ec;\n  --mcc-primary: #2b6cb0;\n  --mcc-primary-dark: #1a4f86;\n  --mcc-primary-soft: #e7f0f9;\n  --mcc-green: #2f855a;\n  --mcc-accent: #b45309;\n  --mcc-head-a: #f2f7fc;\n  --mcc-head-b: #eaf1f8;\n  --mcc-soft-bg: #f7fafc;\n  --mcc-code-bg: #f3f6fa;\n  --mcc-reveal-bg: #fbfdfe;\n  --mcc-radius: 10px;\n}\n/* Applied by the MCP Apps template when the host reports a dark theme. */\n:root[data-theme=\"dark\"] {\n  --mcc-bg-a: #161a20;\n  --mcc-bg-b: #12161b;\n  --mcc-surface: #1d232b;\n  --mcc-text: #e8edf2;\n  --mcc-muted: #9aa7b4;\n  --mcc-border: #313c48;\n  --mcc-primary: #5b9bd5;\n  --mcc-primary-dark: #93bfe8;\n  --mcc-primary-soft: #253444;\n  --mcc-green: #5cbd8f;\n  --mcc-accent: #d9a05f;\n  --mcc-head-a: #222933;\n  --mcc-head-b: #1c232c;\n  --mcc-soft-bg: #191f26;\n  --mcc-code-bg: #171d24;\n  --mcc-reveal-bg: #1a2129;\n}\n* { box-sizing: border-box; }\nhtml, body { margin: 0; padding: 0; }\nbody {\n  font-family: \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif;\n  font-size: 14px;\n  line-height: 1.5;\n  color: var(--mcc-text);\n  background: linear-gradient(180deg, var(--mcc-bg-a), var(--mcc-bg-b));\n  padding: 10px;\n}\n.mcc-card {\n  background: var(--mcc-surface);\n  border: 1px solid var(--mcc-border);\n  border-radius: var(--mcc-radius);\n  box-shadow: 0 1px 3px rgba(31, 35, 40, 0.08);\n  overflow: hidden;\n}\n.mcc-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 10px 14px;\n  background: linear-gradient(180deg, var(--mcc-head-a), var(--mcc-head-b));\n  border-bottom: 1px solid var(--mcc-border);\n}\n.mcc-head h1 { font-size: 16px; margin: 0; font-weight: 600; }\n.mcc-subtitle { margin: 2px 0 0; font-size: 12px; color: var(--mcc-muted); }\n.mcc-tools { display: flex; gap: 6px; flex-shrink: 0; }\n.mcc-body { padding: 14px; }\n.mcc-foot {\n  padding: 6px 14px;\n  font-size: 11px;\n  color: var(--mcc-muted);\n  border-top: 1px solid var(--mcc-border);\n  background: var(--mcc-soft-bg);\n}\n.mcc-btn {\n  font: inherit;\n  font-size: 12px;\n  padding: 4px 10px;\n  border-radius: 6px;\n  border: 1px solid var(--mcc-border);\n  background: var(--mcc-surface);\n  color: var(--mcc-primary-dark);\n  cursor: pointer;\n}\n.mcc-btn:hover { background: var(--mcc-primary-soft); }\n.mcc-btn:focus-visible { outline: 2px solid var(--mcc-primary); outline-offset: 1px; }\n.mcc-btn-primary { background: var(--mcc-primary); border-color: var(--mcc-primary-dark); color: #ffffff; }\n.mcc-btn-primary:hover { background: var(--mcc-primary-dark); }\n/* The header toggle buttons (card code, collapse) are created and styled by\n   the card runtime (see RUNTIME_CSS in runtime.ts), so cards from older tool\n   results pick them up too. */\n\n/* Draggable blocks */\n.mcc-block { position: relative; margin: 0 0 12px; padding-left: 18px; }\n.mcc-block:last-child { margin-bottom: 0; }\n.mcc-drag {\n  position: absolute;\n  left: 0;\n  top: 2px;\n  width: 14px;\n  color: var(--mcc-muted);\n  cursor: grab;\n  user-select: none;\n  font-size: 12px;\n  line-height: 1;\n  opacity: 0.35;\n}\n.mcc-block:hover > .mcc-drag { opacity: 1; }\n.mcc-block.mcc-dragging { opacity: 0.5; }\n.mcc-block.mcc-drop-target { outline: 2px dashed var(--mcc-primary); outline-offset: 2px; }\n\n/* Tabs */\n.mcc-tabs [role=\"tablist\"] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n  border-bottom: 2px solid var(--mcc-border);\n  margin-bottom: 10px;\n}\n.mcc-tab {\n  font: inherit;\n  font-size: 13px;\n  padding: 6px 12px;\n  border: 1px solid transparent;\n  border-bottom: none;\n  border-radius: 6px 6px 0 0;\n  background: transparent;\n  color: var(--mcc-muted);\n  cursor: pointer;\n  margin-bottom: -2px;\n}\n.mcc-tab:hover { color: var(--mcc-primary-dark); background: var(--mcc-primary-soft); }\n.mcc-tab[aria-selected=\"true\"] {\n  color: var(--mcc-primary-dark);\n  font-weight: 600;\n  background: var(--mcc-surface);\n  border-color: var(--mcc-border) var(--mcc-border) var(--mcc-surface);\n  border-bottom: 2px solid var(--mcc-surface);\n}\n.mcc-panel[hidden] { display: none; }\n\n/* Tables */\ntable.mcc-table { border-collapse: collapse; width: 100%; font-size: 13px; }\n.mcc-table caption { caption-side: top; text-align: left; color: var(--mcc-muted); font-size: 12px; padding-bottom: 6px; }\n.mcc-table th, .mcc-table td { border: 1px solid var(--mcc-border); padding: 6px 10px; text-align: left; vertical-align: top; }\n.mcc-table thead th { background: var(--mcc-primary-soft); color: var(--mcc-primary-dark); }\n.mcc-table tbody tr:nth-child(even) { background: var(--mcc-soft-bg); }\n.mcc-table a { color: var(--mcc-primary); }\n.mcc-table-scroll { overflow-x: auto; }\n\n/* Forms */\n.mcc-form { display: grid; gap: 10px; }\n.mcc-field { display: grid; gap: 3px; }\n.mcc-field label { font-size: 13px; font-weight: 600; }\n.mcc-required { color: var(--mcc-accent); margin-left: 2px; }\n.mcc-help { font-size: 12px; color: var(--mcc-muted); }\n.mcc-field input[type=\"text\"], .mcc-field input[type=\"email\"], .mcc-field input[type=\"number\"],\n.mcc-field input[type=\"url\"], .mcc-field input[type=\"date\"], .mcc-field input[type=\"password\"],\n.mcc-field select, .mcc-field textarea {\n  font: inherit;\n  padding: 6px 8px;\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  background: var(--mcc-surface);\n  color: var(--mcc-text);\n  width: 100%;\n}\n.mcc-field textarea { min-height: 70px; resize: vertical; }\n.mcc-field input:focus-visible, .mcc-field select:focus-visible, .mcc-field textarea:focus-visible {\n  outline: 2px solid var(--mcc-primary);\n  outline-offset: 0;\n}\n.mcc-choice { display: flex; align-items: center; gap: 6px; font-weight: 400; }\n.mcc-form-status { font-size: 12px; color: var(--mcc-green); min-height: 16px; }\n.mcc-form-fallback { display: none; }\n.mcc-form-fallback.mcc-visible { display: block; }\n.mcc-form-fallback textarea { width: 100%; min-height: 90px; font-family: Consolas, monospace; font-size: 12px; }\n\n/* File view: one file, more than one way to read it, with a toggle bar.\n   Raw | Code for source, Raw | Rendered for markdown. */\n.mcc-fileview-bar {\n  display: flex;\n  gap: 0;\n  justify-content: flex-end;\n  margin-bottom: 8px;\n}\n.mcc-fileview-btn { border-radius: 0; }\n.mcc-fileview-btn:first-child { border-radius: 6px 0 0 6px; }\n.mcc-fileview-btn:last-child { border-radius: 0 6px 6px 0; margin-left: -1px; }\n.mcc-fileview-btn.mcc-active {\n  background: var(--mcc-primary);\n  border-color: var(--mcc-primary-dark);\n  color: #ffffff;\n  position: relative;\n  z-index: 1;\n}\n.mcc-fileview-pane[hidden] { display: none; }\n.mcc-fileview-pane > :first-child { margin-top: 0; }\n\n/* Code file view: line-number gutter beside the source. The gutter is a\n   sibling of the code and is never selected, so a copy or a drag through the\n   file picks up the file and not its numbering. */\n.mcc-code-scroll { display: flex; align-items: stretch; }\n.mcc-codefile .mcc-gutter {\n  flex: 0 0 auto;\n  margin: 0;\n  padding: 10px 8px 10px 12px;\n  border: none;\n  border-right: 1px solid var(--mcc-border);\n  background: transparent;\n  color: var(--mcc-muted);\n  text-align: right;\n  overflow: hidden;\n  user-select: none;\n  -webkit-user-select: none;\n  font-family: Consolas, \"Courier New\", monospace;\n  font-size: 12.5px;\n  line-height: 1.5;\n}\n.mcc-codefile .mcc-code {\n  flex: 1 1 auto;\n  min-width: 0;\n  margin: 0;\n  padding: 10px 12px;\n  border: none;\n  background: transparent;\n  line-height: 1.5;\n}\n.mcc-codefile .mcc-codewrap {\n  padding: 0;\n  background: var(--mcc-code-bg);\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  overflow: hidden;\n}\n\n/* Syntax tokens. Chosen to stay legible on both card backgrounds rather than\n   to match any one editor theme. */\n.mcc-t-c { color: var(--mcc-muted); font-style: italic; }\n.mcc-t-s { color: var(--mcc-green); }\n.mcc-t-n { color: var(--mcc-accent); }\n.mcc-t-k { color: var(--mcc-primary-dark); font-weight: 600; }\n.mcc-t-y { color: var(--mcc-primary); }\n\n/* Raw view: the same text with the styling switched off, which is what a\n   repository browser shows for a raw file. Nothing is re-rendered, so the\n   card carries one copy of the source rather than two. */\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-gutter { display: none; }\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-t-c,\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-t-s,\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-t-n,\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-t-k,\n.mcc-fileview[data-mcc-view=\"raw\"] .mcc-t-y {\n  color: var(--mcc-text);\n  font-style: normal;\n  font-weight: normal;\n}\n\n/* Prompt outbox: what happened to a prompt the card handed to the host */\n#mcc-outbox {\n  margin-top: 12px;\n  padding: 8px 10px;\n  border: 1px solid var(--mcc-border);\n  border-left: 3px solid var(--mcc-primary);\n  border-radius: 6px;\n  background: var(--mcc-soft-bg);\n}\n#mcc-outbox[hidden] { display: none; }\n.mcc-outbox-status { margin: 0; font-size: 12px; color: var(--mcc-muted); }\n.mcc-outbox-body[hidden] { display: none; }\n.mcc-outbox-body textarea {\n  width: 100%;\n  min-height: 72px;\n  margin-top: 6px;\n  padding: 6px 8px;\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  background: var(--mcc-surface);\n  color: var(--mcc-text);\n  font-family: Consolas, \"Courier New\", monospace;\n  font-size: 12px;\n  resize: vertical;\n}\n.mcc-outbox-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }\n\n/* Prompt forge: gist, refine, and finished-prompt cards */\n.mcc-forge-meta { display: block; margin-top: 2px; }\n.mcc-forge-q { margin-bottom: 4px; }\n.mcc-other { display: flex; align-items: center; gap: 6px; margin-top: 4px; }\n.mcc-field .mcc-other input[type=\"text\"] { flex: 1 1 auto; width: auto; min-width: 0; }\n.mcc-field textarea.mcc-forge-prompt {\n  min-height: 150px;\n  font-family: Consolas, \"Courier New\", monospace;\n  font-size: 12.5px;\n}\n.mcc-forge-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }\n.mcc-forge-notes { margin: 8px 0 0; }\n.mcc-confirm {\n  margin-top: 10px;\n  padding: 10px 12px;\n  border: 1px solid var(--mcc-accent);\n  border-radius: 6px;\n  background: var(--mcc-soft-bg);\n}\n.mcc-confirm[hidden] { display: none; }\n.mcc-confirm p { margin: 0; font-size: 13px; font-weight: 600; }\n.mcc-confirm .mcc-forge-actions { margin-top: 8px; }\n\n/* Code */\n.mcc-codewrap { position: relative; }\n.mcc-codewrap pre {\n  margin: 0;\n  padding: 10px 12px;\n  background: var(--mcc-code-bg);\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  overflow-x: auto;\n  font-family: Consolas, \"Courier New\", monospace;\n  font-size: 12.5px;\n}\n.mcc-copy-code { position: absolute; top: 6px; right: 6px; }\n\n/* Show/hide sections */\ndetails.mcc-reveal {\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  margin-bottom: 8px;\n  background: var(--mcc-reveal-bg);\n}\ndetails.mcc-reveal > summary {\n  cursor: pointer;\n  padding: 8px 12px;\n  font-weight: 600;\n  color: var(--mcc-primary-dark);\n  list-style: none;\n}\ndetails.mcc-reveal > summary::before { content: \"\\25B8\"; display: inline-block; margin-right: 6px; transition: transform 0.15s; }\ndetails.mcc-reveal[open] > summary::before { transform: rotate(90deg); }\ndetails.mcc-reveal > .mcc-reveal-body { padding: 0 12px 10px; }\n\n/* Sequential nested lists: 1., 1.1., 1.1.1. via CSS counters */\nol.mcc-seq { counter-reset: mccseq; list-style: none; padding-left: 6px; margin: 0; }\nol.mcc-seq li { counter-increment: mccseq; margin: 4px 0; }\nol.mcc-seq li::before {\n  content: counters(mccseq, \".\") \". \";\n  font-weight: 600;\n  color: var(--mcc-primary-dark);\n}\nol.mcc-seq ol.mcc-seq { padding-left: 22px; }\n\n/* Charts */\n.mcc-chart svg { max-width: 100%; height: auto; display: block; }\nul.mcc-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0; margin: 8px 0 0; font-size: 12px; }\nul.mcc-legend .mcc-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; }\n\n/* Video. The frame reserves a 16:9 box before metadata arrives, and the\n   player fills it, so a clip that is still buffering (or blocked outright)\n   never collapses the card to an invisible zero-height element. */\n.mcc-video-frame {\n  position: relative;\n  width: 100%;\n  aspect-ratio: 16 / 9;\n  max-height: 360px;\n  min-height: 160px;\n  border-radius: 6px;\n  overflow: hidden;\n  background: #1f2328;\n}\n.mcc-video video, .mcc-video-frame video {\n  display: block;\n  width: 100%;\n  height: 100%;\n  min-height: 160px;\n  max-height: 360px;\n  border-radius: 6px;\n  background: #1f2328;\n  object-fit: contain;\n}\n.mcc-video-fallback { margin: 6px 0 0; font-size: 12px; }\n.mcc-video-note {\n  margin: 6px 0 0;\n  padding: 8px 10px;\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  color: var(--mcc-muted);\n  font-size: 12px;\n}\n\n/* Animation cards: 16:9 stage of stacked scenes played by the runtime */\n.mcc-motion .mcc-stage {\n  position: relative;\n  aspect-ratio: 16 / 9;\n  overflow: hidden;\n  border: 1px solid var(--mcc-border);\n  border-radius: 6px;\n  background: linear-gradient(180deg, var(--mcc-surface), var(--mcc-soft-bg));\n}\n.mcc-scene {\n  position: absolute;\n  inset: 0;\n  padding: 18px 22px;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  gap: 6px;\n  opacity: 0;\n  visibility: hidden;\n  transition: opacity 0.5s, transform 0.5s, visibility 0.5s;\n}\n.mcc-scene.mcc-active { opacity: 1; visibility: visible; }\n.mcc-scene-slide { transform: translateX(28px); }\n.mcc-scene-slide.mcc-active { transform: none; }\n.mcc-scene-zoom { transform: scale(0.85); }\n.mcc-scene-zoom.mcc-active { transform: scale(1); }\n/* \"draw\": shapes and chart lines trace themselves in as the scene enters. */\n.mcc-scene-draw .mcc-draw { stroke-dasharray: 600; stroke-dashoffset: 600; }\n.mcc-scene-draw.mcc-active .mcc-draw { animation: mcc-draw-in 1.2s ease forwards; }\n@keyframes mcc-draw-in { to { stroke-dashoffset: 0; } }\n.mcc-motion-heading { margin: 0; font-size: 20px; color: var(--mcc-primary-dark); }\n.mcc-motion-text { margin: 0; font-size: 14px; }\n.mcc-motion-bullets { margin: 0; padding-left: 20px; }\n.mcc-motion-bullet {\n  margin: 3px 0;\n  opacity: 0;\n  transform: translateY(6px);\n  transition: opacity 0.4s, transform 0.4s;\n}\n.mcc-scene.mcc-active .mcc-motion-bullet { opacity: 1; transform: none; }\n.mcc-motion-shapes, .mcc-motion-chart { flex: 1 1 auto; min-height: 0; width: 100%; }\n.mcc-motion-bar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 8px;\n}\n.mcc-motion-step { font-size: 12px; color: var(--mcc-muted); white-space: nowrap; }\n.mcc-motion-progress {\n  flex: 1 1 auto;\n  height: 4px;\n  border-radius: 2px;\n  background: var(--mcc-primary-soft);\n  overflow: hidden;\n}\n.mcc-motion-progress-fill { width: 0%; height: 100%; background: var(--mcc-primary); }\n\n/* Tutor terms and tooltip */\n.mcc-term { border-bottom: 1px dotted var(--mcc-primary); cursor: help; }\n#mcc-tooltip {\n  position: fixed;\n  z-index: 40;\n  max-width: 280px;\n  background: #24384c;\n  color: #f0f4f8;\n  font-size: 12px;\n  padding: 6px 9px;\n  border-radius: 6px;\n  box-shadow: 0 2px 8px rgba(31, 35, 40, 0.25);\n  pointer-events: none;\n  display: none;\n}\n\n/* Context menu */\n#mcc-menu {\n  position: fixed;\n  z-index: 50;\n  min-width: 180px;\n  background: var(--mcc-surface);\n  border: 1px solid var(--mcc-border);\n  border-radius: 8px;\n  box-shadow: 0 4px 14px rgba(31, 35, 40, 0.18);\n  padding: 4px;\n  display: none;\n}\n#mcc-menu button {\n  display: block;\n  width: 100%;\n  text-align: left;\n  font: inherit;\n  font-size: 13px;\n  padding: 6px 10px;\n  border: none;\n  border-radius: 5px;\n  background: transparent;\n  color: var(--mcc-text);\n  cursor: pointer;\n}\n#mcc-menu button:hover { background: var(--mcc-primary-soft); color: var(--mcc-primary-dark); }\n#mcc-menu .mcc-menu-sep { border-top: 1px solid var(--mcc-border); margin: 4px 2px; }\n\np { margin: 0 0 8px; }\nimg { max-width: 100%; height: auto; }\n\n/* Document card typography (rendered markdown) */\n.mcc-doc h2, .mcc-doc h3, .mcc-doc h4 { color: var(--mcc-primary-dark); margin: 14px 0 6px; }\n.mcc-doc h2 { font-size: 15px; }\n.mcc-doc h3 { font-size: 14px; }\n.mcc-doc ul, .mcc-doc ol { margin: 0 0 8px; padding-left: 22px; }\n.mcc-doc li { margin: 2px 0; }\n.mcc-doc blockquote {\n  margin: 0 0 8px;\n  padding: 6px 12px;\n  border-left: 3px solid var(--mcc-primary);\n  background: var(--mcc-primary-soft);\n  border-radius: 0 6px 6px 0;\n}\n.mcc-doc hr { border: none; border-top: 1px solid var(--mcc-border); margin: 12px 0; }\n.mcc-doc a { color: var(--mcc-primary); }\n.mcc-body code {\n  background: var(--mcc-code-bg);\n  border: 1px solid var(--mcc-border);\n  border-radius: 4px;\n  padding: 0 4px;\n  font-family: Consolas, \"Courier New\", monospace;\n  font-size: 12.5px;\n}\n.mcc-codewrap pre code { background: transparent; border: none; padding: 0; }\n\n:root[data-mcc-host=\"widget\"][data-mcc-dark=\"1\"] {\n  --mcc-bg-a: #161a20;\n  --mcc-bg-b: #12161b;\n  --mcc-surface: #1d232b;\n  --mcc-text: #e8edf2;\n  --mcc-muted: #9aa7b4;\n  --mcc-border: #313c48;\n  --mcc-primary: #5b9bd5;\n  --mcc-primary-dark: #93bfe8;\n  --mcc-primary-soft: #253444;\n  --mcc-green: #5cbd8f;\n  --mcc-accent: #d9a05f;\n  --mcc-head-a: #222933;\n  --mcc-head-b: #1c232c;\n  --mcc-soft-bg: #191f26;\n  --mcc-code-bg: #171d24;\n  --mcc-reveal-bg: #1a2129;\n}\n:root[data-mcc-host=\"widget\"],\n:root[data-mcc-host=\"widget\"][data-mcc-dark=\"1\"] {\n  --mcc-surface: var(--surface-2, #ffffff);\n  --mcc-text: var(--text-primary, #1f2328);\n  --mcc-muted: var(--text-secondary, #5b6b7b);\n  --mcc-border: var(--border, #d8e2ec);\n  --mcc-head-a: var(--surface-1, #f2f7fc);\n  --mcc-head-b: var(--surface-1, #eaf1f8);\n  --mcc-soft-bg: var(--surface-1, #f7fafc);\n  --mcc-code-bg: var(--surface-1, #f3f6fa);\n  --mcc-reveal-bg: var(--surface-2, #fbfdfe);\n}\n:root[data-mcc-host=\"widget\"] body {\n  background: transparent;\n  padding: 0;\n  font-family: var(--font-sans, \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif);\n}\n:root[data-mcc-host=\"widget\"] .mcc-card { box-shadow: none; border-radius: 12px; }\n:root[data-mcc-host=\"widget\"] .mcc-head h1 { font-weight: 500; }\n";
  (document.head || root).appendChild(theme);
  var critical = document.getElementById("mcc-critical");
  if (critical && critical.parentNode) critical.parentNode.removeChild(critical);

  // Native form submission must never happen in the host frame: a form
  // without an action navigates the frame (in a srcdoc frame, toward the
  // host page itself). The card runtime cancels its own submits; this
  // capture-phase guard covers any form it did not wire. widget_code also
  // marks every form method="dialog", which is inert outside a dialog, for
  // the case where this bundle never loads at all.
  try {
    document.addEventListener("submit", function (event) { event.preventDefault(); }, true);
  } catch (err) { /* optional */ }

  // The visualizer exposes sendPrompt(text) and openLink(url) as globals,
  // which may be lexical bindings rather than window properties, so they are
  // looked up by bare name first. A prompt resolves true once handed over, so
  // the runtime reports it as sent; false makes it offer the prompt to copy.
  function hostFunction(name) {
    try {
      if (name === "sendPrompt" && typeof sendPrompt === "function") return sendPrompt;
      if (name === "openLink" && typeof openLink === "function") return openLink;
    } catch (err) { /* not defined */ }
    return typeof window[name] === "function" ? window[name] : null;
  }
  window.__mccHostBridge = {
    post: function (type, payload) {
      payload = payload || {};
      if (type === "prompt") {
        var send = hostFunction("sendPrompt");
        if (!send) return Promise.resolve(false);
        try {
          send(String(payload.prompt || ""));
          return Promise.resolve(true);
        } catch (err) { return Promise.resolve(false); }
      }
      if (type === "link") {
        var url = String(payload.url || "");
        try {
          var open = hostFunction("openLink");
          if (open) open(url);
          else window.open(url, "_blank", "noopener");
          return Promise.resolve(true);
        } catch (err) { return Promise.resolve(false); }
      }
      // "notify" has no channel in this host; the model learns nothing from
      // hover or ready events here, which is the documented trade-off.
      return undefined;
    }
  };

  // Light or dark, read from what the host paints: the computed text color
  // of the body (the theme maps it to the host's --text-primary), then the
  // raw token, then the media query for a host that defines no token.
  //
  // This must never feed back into the host. Hosts watch the frame's DOM to
  // size it and may touch :root as they do; a sync that mutates the DOM and
  // re-runs on :root style or class changes chases that host forever and
  // hangs the frame (1.0.0-alpha.1.0.0 did exactly that). So the sync reads
  // only, writes one attribute of its own and only when the answer changes,
  // and runs on a throttled timer, never on a microtask.
  function luminance(color) {
    var value = String(color || "").trim();
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
    var rgb = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/i.exec(value);
    if (!rgb && hex) {
      var h = hex[1].length === 3 ? hex[1].replace(/(.)/g, "$1$1") : hex[1];
      rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    if (!rgb) return null;
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  }
  function hostIsDark() {
    var mode = root.getAttribute("data-mode") || root.getAttribute("data-theme");
    if (mode === "dark") return true;
    if (mode === "light") return false;
    var token = getComputedStyle(root).getPropertyValue("--text-primary").trim();
    if (token) {
      var lum = luminance(getComputedStyle(document.body || root).color);
      if (lum === null) lum = luminance(token);
      if (lum !== null) return lum > 0.5;
    }
    return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  var darkState = null;
  function syncTheme() {
    try {
      var dark = hostIsDark();
      if (dark === darkState) return;
      darkState = dark;
      if (dark) root.setAttribute("data-mcc-dark", "1");
      else root.removeAttribute("data-mcc-dark");
    } catch (err) { /* theme sync is cosmetic */ }
  }
  var syncPending = false;
  function scheduleSync() {
    if (syncPending) return;
    syncPending = true;
    setTimeout(function () { syncPending = false; syncTheme(); }, 100);
  }
  syncTheme();
  try {
    new MutationObserver(scheduleSync).observe(root, {
      attributes: true,
      attributeFilter: ["data-mode", "data-theme"]
    });
  } catch (err) { /* optional */ }
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) media.addEventListener("change", scheduleSync);
  } catch (err) { /* optional */ }

  // The runtime initializes itself when #mcc-config exists. widget_code
  // always carries one; rebuild a default from the article if a host
  // stripped it, so the card is still interactive.
  if (!document.getElementById("mcc-config")) {
    var article = document.querySelector("article.mcc-card");
    if (article) {
      var cfg = document.createElement("script");
      cfg.type = "application/json";
      cfg.id = "mcc-config";
      cfg.textContent = JSON.stringify({
        id: article.getAttribute("data-card-id") || "card",
        kind: "card",
        dwellMs: 1200,
        contextActions: [],
        draggable: true
      });
      (document.body || root).appendChild(cfg);
    }
  }

(function () {
  "use strict";

  var msgSeq = 0;

  function readConfig() {
    var cfgEl = document.getElementById("mcc-config");
    if (!cfgEl) return {};
    try { return JSON.parse(cfgEl.textContent || "{}"); } catch (err) { return {}; }
  }

  function post(type, payload) {
    msgSeq += 1;
    var message = { type: type, messageId: "mcc-" + msgSeq, payload: payload };
    var bridge = window.__mccHostBridge;
    if (bridge && typeof bridge.post === "function") {
      try { bridge.post(type, payload); } catch (err) { /* adapter failure */ }
      return message;
    }
    try { window.parent.postMessage(message, "*"); } catch (err) { /* sandboxed host */ }
    return message;
  }

  function cardTag(cfg) {
    return "card:" + (cfg.id || "unknown");
  }

  function sendPrompt(cfg, text) {
    post("prompt", { prompt: text });
    post("notify", { message: cardTag(cfg) + ":prompt-sent" });
  }

  // ---- Prompt handoff with acknowledgement ----------------------------
  // A prompt handed to the host either lands in the conversation or it does
  // not, and the card cannot tell which from the send alone: the MCP Apps
  // bridge answers a ui/message request, but the MCP-UI postMessage fallback
  // has no reply channel at all. So the outcome is always shown. Anything
  // that is not acknowledged inside this window is treated as undelivered and
  // the prompt is put in front of the user to copy, because a menu item that
  // silently does nothing is indistinguishable from a broken one.
  var PROMPT_ACK_MS = 1500;

  function postPrompt(payload) {
    var bridge = window.__mccHostBridge;
    if (bridge && typeof bridge.post === "function") {
      try { return bridge.post("prompt", payload); } catch (err) { return undefined; }
    }
    post("prompt", payload);
    return undefined;
  }

  // surface.setStatus(text) reports progress; surface.showFallback(text)
  // gives the user a way to send the prompt by hand.
  function deliverPrompt(cfg, text, surface) {
    var settled = false;
    surface.setStatus("Sending to the conversation...");
    var ack = postPrompt({ prompt: text });
    post("notify", { message: cardTag(cfg) + ":prompt-sent" });

    function finish(delivered) {
      if (settled) return;
      settled = true;
      if (delivered) {
        surface.setStatus("Sent to the conversation as the next prompt.");
        post("notify", { message: cardTag(cfg) + ":prompt-delivered" });
        return;
      }
      surface.setStatus("The chat client did not confirm this. Copy it and send it yourself.");
      surface.showFallback(text);
      post("notify", { message: cardTag(cfg) + ":prompt-unconfirmed" });
    }

    if (ack && typeof ack.then === "function") {
      ack.then(function (ok) { finish(ok !== false); }, function () { finish(false); });
    }
    setTimeout(function () { finish(false); }, PROMPT_ACK_MS);
  }

  // The card-level outbox: where a prompt that did not come from a form
  // reports its outcome. It is an in-flow block at the end of the card body
  // rather than a floating layer, so the host's size observer grows the
  // frame to fit it instead of clipping it.
  function ensureOutbox() {
    var outbox = document.getElementById("mcc-outbox");
    if (outbox) return outbox;
    var host = document.querySelector(".mcc-card .mcc-body") || document.body;
    outbox = document.createElement("div");
    outbox.id = "mcc-outbox";
    outbox.hidden = true;
    outbox.innerHTML =
      '<p class="mcc-outbox-status" role="status" aria-live="polite"></p>' +
      '<div class="mcc-outbox-body" hidden>' +
      '<textarea readonly aria-label="Prompt to copy"></textarea>' +
      '<div class="mcc-outbox-actions">' +
      '<button type="button" class="mcc-btn mcc-btn-primary mcc-outbox-copy">Copy prompt</button>' +
      '<button type="button" class="mcc-btn mcc-outbox-close">Dismiss</button>' +
      "</div></div>";
    host.appendChild(outbox);
    return outbox;
  }

  function outboxSurface(cfg) {
    return {
      setStatus: function (text) {
        var outbox = ensureOutbox();
        outbox.hidden = false;
        var status = outbox.querySelector(".mcc-outbox-status");
        if (status) status.textContent = text;
      },
      showFallback: function (text) {
        var outbox = ensureOutbox();
        outbox.hidden = false;
        var body = outbox.querySelector(".mcc-outbox-body");
        var area = outbox.querySelector("textarea");
        if (area) area.value = text;
        if (body) body.hidden = false;
        var copyButton = outbox.querySelector(".mcc-outbox-copy");
        if (copyButton && copyButton.getAttribute("data-mcc-wired") !== "1") {
          copyButton.setAttribute("data-mcc-wired", "1");
          copyButton.addEventListener("click", function () {
            var current = outbox.querySelector("textarea");
            if (current) copyText(cfg, current.value, copyButton);
          });
        }
        var closeButton = outbox.querySelector(".mcc-outbox-close");
        if (closeButton && closeButton.getAttribute("data-mcc-wired") !== "1") {
          closeButton.setAttribute("data-mcc-wired", "1");
          closeButton.addEventListener("click", function () {
            outbox.hidden = true;
            if (body) body.hidden = true;
          });
        }
      },
    };
  }

  function flash(button, label) {
    if (!button) return;
    var original = button.textContent;
    button.textContent = label;
    setTimeout(function () { button.textContent = original; }, 1400);
  }

  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch (err) { /* ignore */ }
    document.body.removeChild(area);
  }

  function copyText(cfg, text, button) {
    var done = function () { flash(button, "Copied"); post("notify", { message: cardTag(cfg) + ":copied" }); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
    } else {
      legacyCopy(text);
      done();
    }
  }

  // ---- Tabs -----------------------------------------------------------
  function initTabs() {
    var groups = document.querySelectorAll(".mcc-tabs");
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        if (group.getAttribute("data-mcc-wired") === "1") return;
        group.setAttribute("data-mcc-wired", "1");
        var tabs = group.querySelectorAll(".mcc-tab");
        var panels = group.querySelectorAll(".mcc-panel");
        function activate(index) {
          for (var i = 0; i < tabs.length; i++) {
            var selected = i === index;
            tabs[i].setAttribute("aria-selected", selected ? "true" : "false");
            tabs[i].tabIndex = selected ? 0 : -1;
            if (panels[i]) panels[i].hidden = !selected;
          }
          tabs[index].focus();
        }
        for (var i = 0; i < tabs.length; i++) {
          (function (index) {
            tabs[index].addEventListener("click", function () { activate(index); });
            tabs[index].addEventListener("keydown", function (event) {
              var next = -1;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
              if (next >= 0) { event.preventDefault(); activate(next); }
            });
          })(i);
        }
      })(groups[g]);
    }
  }

  // ---- Drag to reorder blocks ----------------------------------------
  // Blocks can be reordered inside the card. The drag also carries the
  // block HTML as text/html so hosts that accept drops can receive it.
  function initDrag(cfg) {
    if (cfg.draggable === false) return;
    var body = document.querySelector(".mcc-body");
    if (!body) return;
    var blocks = body.querySelectorAll(".mcc-block");
    if (blocks.length < 1) return;

    for (var i = 0; i < blocks.length; i++) {
      (function (block) {
        if (block.getAttribute("data-mcc-wired") === "1") return;
        block.setAttribute("data-mcc-wired", "1");
        var handle = document.createElement("span");
        handle.className = "mcc-drag";
        handle.title = "Drag to reorder (or drag out to copy)";
        handle.textContent = "\u22EE\u22EE";
        handle.addEventListener("mousedown", function () { block.draggable = true; });
        handle.addEventListener("mouseup", function () { block.draggable = false; });
        block.insertBefore(handle, block.firstChild);

        block.addEventListener("dragstart", function (event) {
          window.__mccDragging = block;
          block.classList.add("mcc-dragging");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copyMove";
            var clone = block.cloneNode(true);
            var innerHandle = clone.querySelector(".mcc-drag");
            if (innerHandle) innerHandle.remove();
            event.dataTransfer.setData("text/html", clone.outerHTML);
            event.dataTransfer.setData("text/plain", block.innerText || "");
          }
        });
        block.addEventListener("dragend", function () {
          block.classList.remove("mcc-dragging");
          block.draggable = false;
          var targets = body.querySelectorAll(".mcc-drop-target");
          for (var t = 0; t < targets.length; t++) targets[t].classList.remove("mcc-drop-target");
          window.__mccDragging = null;
        });
        block.addEventListener("dragover", function (event) {
          var dragging = window.__mccDragging;
          if (!dragging || dragging === block) return;
          event.preventDefault();
          block.classList.add("mcc-drop-target");
        });
        block.addEventListener("dragleave", function () {
          block.classList.remove("mcc-drop-target");
        });
        block.addEventListener("drop", function (event) {
          var dragging = window.__mccDragging;
          if (!dragging || dragging === block) return;
          event.preventDefault();
          block.classList.remove("mcc-drop-target");
          var rect = block.getBoundingClientRect();
          var before = event.clientY < rect.top + rect.height / 2;
          block.parentNode.insertBefore(dragging, before ? block : block.nextSibling);
          post("notify", { message: cardTag(cfg) + ":blocks-reordered" });
        });
      })(blocks[i]);
    }
  }

  // ---- Forms ----------------------------------------------------------
  // Values are gathered per name rather than assigned, so a choice group and
  // a free-text "Other" input can share one name and arrive as a single
  // comma-joined answer. Empty values drop out, and every named control
  // still yields a key, so an unanswered group renders as an empty token
  // instead of leaving a literal "{{name}}" in the prompt.
  function serializeForm(form) {
    var order = [];
    var collected = {};
    var elements = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || el.disabled) continue;
      if (!Object.prototype.hasOwnProperty.call(collected, el.name)) {
        collected[el.name] = [];
        order.push(el.name);
      }
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) continue;
      if (el.value !== "") collected[el.name].push(el.value);
    }
    var data = {};
    for (var k = 0; k < order.length; k++) data[order[k]] = collected[order[k]].join(", ");
    return data;
  }

  function buildPrompt(form, data) {
    var template = form.getAttribute("data-prompt-template");
    var webform = form.getAttribute("data-webform");
    if (webform) {
      var spec = {};
      try { spec = JSON.parse(webform); } catch (err) { spec = {}; }
      var payload = { action: spec.action || "", method: spec.method || "POST", sourceUrl: spec.sourceUrl || "", fields: data };
      return "The user filled out the mirrored web form \"" + (form.getAttribute("data-card-title") || "form") + "\". " +
        "Review the values with the user if anything looks off, then call the submit_web_form tool with this payload:\n" +
        JSON.stringify(payload, null, 2);
    }
    if (template) {
      var out = template;
      for (var key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        var token = "{{" + key + "}}";
        while (out.indexOf(token) > -1) out = out.replace(token, data[key]);
      }
      return out;
    }
    var lines = ["Form \"" + (form.getAttribute("data-card-title") || "form") + "\" submitted with:"];
    for (var name in data) {
      if (Object.prototype.hasOwnProperty.call(data, name)) lines.push("- " + name + ": " + data[name]);
    }
    lines.push("Use these values to direct the next response.");
    return lines.join("\n");
  }

  function initForms(cfg) {
    var forms = document.querySelectorAll("form.mcc-form");
    for (var i = 0; i < forms.length; i++) {
      (function (form) {
        if (form.getAttribute("data-mcc-wired") === "1") return;
        form.setAttribute("data-mcc-wired", "1");
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          if (form.reportValidity && !form.reportValidity()) return;
          var prompt = buildPrompt(form, serializeForm(form));
          sendPrompt(cfg, prompt);
          var status = form.querySelector(".mcc-form-status");
          if (status) status.textContent = "Sent to the conversation as the next prompt.";
          var fallback = form.querySelector(".mcc-form-fallback");
          if (fallback) {
            fallback.classList.add("mcc-visible");
            var area = fallback.querySelector("textarea");
            if (area) area.value = prompt;
          }
        });
        var copyPromptButton = form.querySelector(".mcc-copy-prompt");
        if (copyPromptButton) {
          copyPromptButton.addEventListener("click", function () {
            var area = form.querySelector(".mcc-form-fallback textarea");
            if (area) copyText(cfg, area.value, copyPromptButton);
          });
        }
      })(forms[i]);
    }
  }

  // ---- Prompt forge ---------------------------------------------------
  // Roughly four characters to a token: close enough to tell a lean prompt
  // from a bloated one, and cheap enough to recompute on every keystroke.
  function estimateTokens(text) {
    var trimmed = String(text == null ? "" : text).trim();
    return trimmed.length === 0 ? 0 : Math.max(1, Math.ceil(trimmed.length / 4));
  }

  // Live character (and, where the markup asks for it, token) counters for
  // any textarea marked data-mcc-counter.
  function initCounters() {
    var areas = document.querySelectorAll("[data-mcc-counter]");
    for (var i = 0; i < areas.length; i++) {
      (function (area) {
        if (area.getAttribute("data-mcc-counted") === "1") return;
        area.setAttribute("data-mcc-counted", "1");
        var field = area.closest ? area.closest(".mcc-field") : null;
        if (!field) field = area.parentNode;
        var count = field ? field.querySelector(".mcc-count") : null;
        if (!count) return;
        var tokens = field.querySelector(".mcc-tokens");
        var update = function () {
          var text = area.value || "";
          count.textContent = String(text.length);
          if (tokens) tokens.textContent = String(estimateTokens(text));
        };
        area.addEventListener("input", update);
        update();
      })(areas[i]);
    }
  }

  // The finished-prompt card sends nothing until the confirmation box has
  // been answered, so a stray click cannot post a prompt to the chat.
  function initPromptForge(cfg) {
    var panels = document.querySelectorAll(".mcc-forge-final");
    for (var i = 0; i < panels.length; i++) {
      (function (panel) {
        if (panel.getAttribute("data-mcc-wired") === "1") return;
        panel.setAttribute("data-mcc-wired", "1");
        var area = panel.querySelector(".mcc-forge-prompt");
        if (!area) return;
        var box = panel.querySelector(".mcc-confirm");
        var status = panel.querySelector(".mcc-form-status");
        function setStatus(text) { if (status) status.textContent = text; }
        function closeBox() { if (box) box.hidden = true; }

        var sendButton = panel.querySelector(".mcc-forge-send");
        if (sendButton) {
          sendButton.addEventListener("click", function () {
            if (area.value.trim() === "") {
              setStatus("Nothing to send: the prompt is empty.");
              return;
            }
            setStatus("");
            if (box) box.hidden = false;
          });
        }
        var yes = panel.querySelector(".mcc-confirm-yes");
        if (yes) {
          yes.addEventListener("click", function () {
            closeBox();
            // The prompt is already on screen in the textarea, so an
            // unconfirmed handoff points at the copy button rather than
            // printing a second copy of the same text.
            deliverPrompt(cfg, area.value.trim(), {
              setStatus: setStatus,
              showFallback: function () {
                setStatus("The chat client did not confirm this. Use Copy prompt and send it yourself.");
              },
            });
          });
        }
        var no = panel.querySelector(".mcc-confirm-no");
        if (no) {
          no.addEventListener("click", function () {
            closeBox();
            setStatus("Not sent. Edit the prompt, or copy it and send it yourself.");
          });
        }
        var copyButton = panel.querySelector(".mcc-forge-copy");
        if (copyButton) {
          copyButton.addEventListener("click", function () {
            copyText(cfg, area.value, copyButton);
            setStatus("Copied. Paste it as your next message.");
          });
        }
      })(panels[i]);
    }
  }

  // ---- Animation cards: sequential scene player ----------------------
  // Scenes are stacked layers; the player toggles mcc-active so CSS runs the
  // per-scene transition, and a chart carrying data-mcc-zoom gets its SVG
  // viewBox animated into the marked data region and back out mid-scene.
  function animateViewBox(svg, fromBox, toBox, ms, done) {
    var from = fromBox.split(" ").map(Number);
    var to = toBox.split(" ").map(Number);
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / ms);
      var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var box = [];
      for (var i = 0; i < 4; i++) box.push(from[i] + (to[i] - from[i]) * eased);
      svg.setAttribute("viewBox", box.join(" "));
      if (t < 1) window.requestAnimationFrame(frame);
      else if (done) done();
    }
    window.requestAnimationFrame(frame);
  }

  function initMotion(cfg) {
    var groups = document.querySelectorAll(".mcc-motion");
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        if (group.getAttribute("data-mcc-wired") === "1") return;
        group.setAttribute("data-mcc-wired", "1");
        var scenes = group.querySelectorAll(".mcc-scene");
        if (scenes.length === 0) return;
        var playButton = group.querySelector(".mcc-motion-play");
        var replayButton = group.querySelector(".mcc-motion-replay");
        var stepLabel = group.querySelector(".mcc-motion-step");
        var progressFill = group.querySelector(".mcc-motion-progress-fill");
        var loop = group.getAttribute("data-loop") === "1";
        var reduceMotion = false;
        try {
          reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (err) { /* older webviews */ }

        var index = 0;
        var playing = false;
        var timer = null;
        var zoomTimers = [];

        function sceneDuration(scene) {
          var ms = parseInt(scene.getAttribute("data-duration") || "3500", 10);
          return isNaN(ms) ? 3500 : ms;
        }

        function clearTimers() {
          if (timer) clearTimeout(timer);
          timer = null;
          for (var i = 0; i < zoomTimers.length; i++) clearTimeout(zoomTimers[i]);
          zoomTimers = [];
        }

        function resetProgress() {
          if (!progressFill) return;
          progressFill.style.transition = "none";
          progressFill.style.width = "0%";
        }

        function startProgress(ms) {
          if (!progressFill) return;
          resetProgress();
          // Force a reflow so the width transition restarts from zero.
          void progressFill.offsetWidth;
          progressFill.style.transition = "width " + ms + "ms linear";
          progressFill.style.width = "100%";
        }

        function showScene(next) {
          index = next;
          for (var i = 0; i < scenes.length; i++) {
            scenes[i].classList.toggle("mcc-active", i === index);
          }
          if (stepLabel) stepLabel.textContent = (index + 1) + "/" + scenes.length;
          var scene = scenes[index];
          var svg = scene.querySelector("svg[data-mcc-zoom]");
          if (svg && !reduceMotion) {
            var full = "0 0 160 90";
            var zoomBox = svg.getAttribute("data-mcc-zoom");
            var ms = sceneDuration(scene);
            svg.setAttribute("viewBox", full);
            zoomTimers.push(setTimeout(function () {
              animateViewBox(svg, full, zoomBox, Math.min(700, ms * 0.2), null);
            }, ms * 0.25));
            zoomTimers.push(setTimeout(function () {
              animateViewBox(svg, zoomBox, full, Math.min(700, ms * 0.2), null);
            }, ms * 0.75));
          }
        }

        function scheduleNext() {
          var ms = sceneDuration(scenes[index]);
          startProgress(ms);
          timer = setTimeout(function () {
            if (index + 1 < scenes.length) {
              showScene(index + 1);
              scheduleNext();
            } else if (loop) {
              showScene(0);
              scheduleNext();
            } else {
              setPlaying(false);
              resetProgress();
              post("notify", { message: cardTag(cfg) + ":clip-finished" });
            }
          }, ms);
        }

        function setPlaying(next) {
          playing = next;
          if (playButton) playButton.textContent = playing ? "Pause" : "Play";
        }

        function play() {
          setPlaying(true);
          showScene(index);
          scheduleNext();
        }

        function pause() {
          setPlaying(false);
          clearTimers();
          resetProgress();
        }

        if (playButton) {
          playButton.addEventListener("click", function () {
            if (playing) { pause(); return; }
            // Resuming replays the current scene from its start.
            if (index === scenes.length - 1 && !loop) index = 0;
            play();
          });
        }
        if (replayButton) {
          replayButton.addEventListener("click", function () {
            clearTimers();
            index = 0;
            play();
          });
        }

        showScene(0);
        if (group.getAttribute("data-autoplay") === "1" && !reduceMotion) {
          setPlaying(true);
          scheduleNext();
        } else {
          setPlaying(false);
        }
      })(groups[g]);
    }
  }

  // ---- Video ----------------------------------------------------------
  // Card markup is injected with innerHTML by whichever shell is hosting the
  // runtime, and some hosts run their own allowlist over it first. If the
  // <video> element did not survive that, the block would render as an empty
  // gap; say so instead, and keep the direct link reachable. When the element
  // is intact, autoplay is retried explicitly because an injected element does
  // not always get the same gesture treatment as one present at parse time.
  function initVideo(cfg) {
    var blocks = document.querySelectorAll(".mcc-video");
    for (var i = 0; i < blocks.length; i++) {
      (function (block) {
        // A distinct flag from initDrag's: .mcc-video is also a .mcc-block,
        // and sharing data-mcc-wired would let whichever ran first cancel
        // the other.
        if (block.getAttribute("data-mcc-video-wired") === "1") return;
        block.setAttribute("data-mcc-video-wired", "1");
        var video = block.querySelector("video");
        if (!video) {
          var note = document.createElement("p");
          note.className = "mcc-video-note";
          note.textContent = "This client removed the embedded video player. Use the link below to open the clip.";
          block.appendChild(note);
          post("notify", { message: cardTag(cfg) + ":video-stripped" });
          return;
        }
        video.addEventListener("error", function () {
          post("notify", { message: cardTag(cfg) + ":video-error" });
        });
        video.addEventListener("loadedmetadata", function () {
          post("notify", { message: cardTag(cfg) + ":video-ready" });
        });
        if (video.hasAttribute("autoplay") && typeof video.play === "function") {
          try {
            var started = video.play();
            if (started && typeof started.catch === "function") {
              started.catch(function () { /* blocked until the user interacts */ });
            }
          } catch (err) { /* older webviews reject play() synchronously */ }
        }
      })(blocks[i]);
    }
  }

  // ---- Tutor: dwell tooltips -----------------------------------------
  // Hovering a marked term longer than dwellMs shows its tip, promotes the
  // tip to a title attribute, and notifies the host so the model can react.
  function initTutor(cfg) {
    var terms = document.querySelectorAll(".mcc-term");
    if (terms.length === 0) return;
    var dwellMs = typeof cfg.dwellMs === "number" ? cfg.dwellMs : 1200;
    var tooltip = document.getElementById("mcc-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "mcc-tooltip";
      document.body.appendChild(tooltip);
    }
    var timer = null;

    for (var i = 0; i < terms.length; i++) {
      (function (term) {
        if (term.getAttribute("data-mcc-wired") === "1") return;
        term.setAttribute("data-mcc-wired", "1");
        term.addEventListener("mouseenter", function () {
          timer = setTimeout(function () {
            var tip = term.getAttribute("data-tip") || "";
            if (tip) {
              if (!term.getAttribute("title")) term.setAttribute("title", tip);
              tooltip.textContent = tip;
              tooltip.style.display = "block";
              var rect = term.getBoundingClientRect();
              tooltip.style.left = Math.max(4, rect.left) + "px";
              tooltip.style.top = (rect.bottom + 6) + "px";
            }
            post("notify", { message: "tutor:dwell:" + (term.textContent || "").trim() });
          }, dwellMs);
        });
        term.addEventListener("mouseleave", function () {
          if (timer) clearTimeout(timer);
          tooltip.style.display = "none";
        });
      })(terms[i]);
    }
  }

  // ---- Right-click menu: model context actions + built-in items ------
  function menuItem(menu, label, onClick) {
    var item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    item.addEventListener("click", function () {
      menu.style.display = "none";
      onClick(item);
    });
    menu.appendChild(item);
    return item;
  }

  function buildContextMenu(cfg) {
    var existing = document.getElementById("mcc-menu");
    if (existing) existing.remove();
    var actions = cfg.contextActions || [];
    var menu = document.createElement("div");
    menu.id = "mcc-menu";
    for (var i = 0; i < actions.length; i++) {
      (function (action) {
        menuItem(menu, action.label, function () {
          var selection = "";
          try { selection = String(window.getSelection() || ""); } catch (err) { selection = ""; }
          var prompt = action.prompt;
          while (prompt.indexOf("{{selection}}") > -1) prompt = prompt.replace("{{selection}}", selection);
          deliverPrompt(cfg, prompt, outboxSurface(cfg));
        });
      })(actions[i]);
    }
    if (actions.length > 0) {
      var sep = document.createElement("div");
      sep.className = "mcc-menu-sep";
      menu.appendChild(sep);
    }
    // Always offered, on every card: opens the three-step flow that turns a
    // short gist into one token-efficient prompt. Label and bootstrap text
    // are duplicated from cards/prompt-forge.ts, which cannot be imported
    // here without a cycle through cards/shell.ts.
    menuItem(menu, "Generate Efficient Verbose Prompt", function () {
      deliverPrompt(cfg, "[efficient-prompt] Call create_prompt_gist_card with no arguments. Reply with nothing else.", outboxSurface(cfg));
    });
    // Copies the standalone card HTML; the Insert Card bookmarklet can then
    // place it by hand on browser hosts.
    menuItem(menu, "Copy card", function (item) {
      copyText(cfg, "<!DOCTYPE html>\n" + document.documentElement.outerHTML, item);
    });
    document.body.appendChild(menu);
  }

  // ---- Runtime-owned styling and header toggles ----------------------
  // The toggle buttons and their styling are created here instead of in the
  // card markup, so cards rendered from older tool results also get them,
  // and stale theme CSS cannot leave the buttons unstyled. Collapsing never
  // removes anything - it only toggles a class whose CSS hides everything
  // but the header strip, and the host shrinks the iframe to match.
  var RUNTIME_CSS = "" +
    ".mcc-icon-btn{display:inline-flex;align-items:center;justify-content:center;" +
    "min-width:28px;min-height:26px;padding:3px 7px;line-height:1;" +
    "font-family:Consolas,'Courier New',monospace;}" +
    ".mcc-toggle-code.mcc-active{background:var(--mcc-primary-soft,#e7f0f9);}" +
    ".mcc-card.mcc-collapsed .mcc-body,.mcc-card.mcc-collapsed .mcc-foot{display:none;}" +
    ".mcc-card.mcc-collapsed .mcc-head{border-bottom:none;}" +
    ".mcc-toggle-card .mcc-chevron{display:block;transition:transform 0.15s;}" +
    ".mcc-card.mcc-collapsed .mcc-toggle-card .mcc-chevron{transform:rotate(-90deg);}" +
    ".mcc-codeview{margin:0 0 12px;}" +
    ".mcc-codeview[hidden]{display:none;}" +
    ".mcc-codeview pre{max-height:280px;overflow:auto;}";

  var CHEVRON_SVG = '<svg class="mcc-chevron" width="14" height="14" viewBox="0 0 16 16"' +
    ' aria-hidden="true" focusable="false"><path d="M3 5.5 8 10.5 13 5.5" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureRuntimeStyle() {
    if (document.getElementById("mcc-runtime-style")) return;
    var style = document.createElement("style");
    style.id = "mcc-runtime-style";
    style.textContent = RUNTIME_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureCardTools() {
    var cards = document.querySelectorAll(".mcc-card");
    for (var i = 0; i < cards.length; i++) {
      (function (article) {
        var head = article.querySelector(".mcc-head");
        if (!head) return;
        var tools = head.querySelector(".mcc-tools");
        if (!tools) {
          tools = document.createElement("div");
          tools.className = "mcc-tools";
          head.appendChild(tools);
        }
        // Order matters: the code toggle sits directly left of the collapse
        // toggle at the right edge of the header strip.
        if (article.getAttribute("data-mcc-no-code") !== "1" && !tools.querySelector(".mcc-toggle-code")) {
          var codeButton = document.createElement("button");
          codeButton.type = "button";
          codeButton.className = "mcc-btn mcc-icon-btn mcc-toggle-code";
          codeButton.title = "Show card code";
          codeButton.setAttribute("aria-expanded", "false");
          codeButton.textContent = "</>";
          tools.appendChild(codeButton);
        }
        if (article.getAttribute("data-mcc-no-collapse") !== "1" && !tools.querySelector(".mcc-toggle-card")) {
          var cardButton = document.createElement("button");
          cardButton.type = "button";
          cardButton.className = "mcc-btn mcc-icon-btn mcc-toggle-card";
          cardButton.title = "Collapse card";
          cardButton.setAttribute("aria-expanded", "true");
          cardButton.innerHTML = CHEVRON_SVG;
          tools.appendChild(cardButton);
        }
      })(cards[i]);
    }
  }

  // ---- Card collapse and card-code view ------------------------------
  function cardSourceHtml(article) {
    var clone = article.cloneNode(true);
    var junk = clone.querySelectorAll(".mcc-codeview, .mcc-drag");
    for (var i = 0; i < junk.length; i++) junk[i].parentNode.removeChild(junk[i]);
    return clone.outerHTML;
  }

  function setCardCollapsed(article, collapsed) {
    article.classList.toggle("mcc-collapsed", collapsed);
    var button = article.querySelector(".mcc-toggle-card");
    if (button) {
      // The chevron itself is CSS-rotated off the mcc-collapsed class.
      button.title = collapsed ? "Expand card" : "Collapse card";
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }

  function toggleCardCode(article, codeButton) {
    var body = article.querySelector(".mcc-body");
    if (!body) return;
    var view = body.querySelector(".mcc-codeview");
    var pre;
    if (!view) {
      view = document.createElement("div");
      view.className = "mcc-codeview";
      var wrap = document.createElement("div");
      wrap.className = "mcc-codewrap";
      var copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "mcc-btn mcc-copy-code";
      copyButton.textContent = "Copy";
      pre = document.createElement("pre");
      wrap.appendChild(copyButton);
      wrap.appendChild(pre);
      view.appendChild(wrap);
      body.insertBefore(view, body.firstChild);
    } else {
      view.hidden = !view.hidden;
    }
    var showing = !view.hidden;
    if (showing) {
      pre = view.querySelector("pre");
      if (pre) pre.textContent = cardSourceHtml(article);
      // A collapsed card would paint nothing; open it before showing code.
      setCardCollapsed(article, false);
    }
    codeButton.classList.toggle("mcc-active", showing);
    codeButton.setAttribute("aria-expanded", showing ? "true" : "false");
    codeButton.title = showing ? "Hide card code" : "Show card code";
    return showing;
  }

  // ---- Document-level listeners, wired exactly once ------------------
  function wireDocument() {
    if (window.__mccDocWired) return;
    window.__mccDocWired = true;

    // Show/hide expand-all and collapse-all buttons.
    document.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-mcc-expand]") : null;
      if (!button) return;
      var open = button.getAttribute("data-mcc-expand") === "all";
      var sections = document.querySelectorAll("details.mcc-reveal");
      for (var i = 0; i < sections.length; i++) sections[i].open = open;
    });

    // Collapse/expand card and show/hide card-code toggles.
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target.closest) return;
      var cfg = readConfig();
      var cardToggle = target.closest(".mcc-toggle-card");
      if (cardToggle) {
        var article = cardToggle.closest(".mcc-card");
        if (article) {
          var collapsed = !article.classList.contains("mcc-collapsed");
          setCardCollapsed(article, collapsed);
          post("notify", { message: cardTag(cfg) + (collapsed ? ":card-collapsed" : ":card-expanded") });
        }
        return;
      }
      var codeToggle = target.closest(".mcc-toggle-code");
      if (codeToggle) {
        var codeArticle = codeToggle.closest(".mcc-card");
        if (codeArticle) {
          var showing = toggleCardCode(codeArticle, codeToggle);
          post("notify", { message: cardTag(cfg) + (showing ? ":code-shown" : ":code-hidden") });
        }
      }
    });

    // Copy card and copy code buttons.
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target.closest) return;
      var cfg = readConfig();
      var cardButton = target.closest(".mcc-copy-card");
      if (cardButton) {
        copyText(cfg, "<!DOCTYPE html>\n" + document.documentElement.outerHTML, cardButton);
        return;
      }
      var codeButton = target.closest(".mcc-copy-code");
      if (codeButton) {
        var wrap = codeButton.closest(".mcc-codewrap");
        // A file view puts an aria-hidden line-number gutter before the code,
        // so the copy button asks for the code pre by name and hands back the
        // file without its line numbers.
        var pre = wrap ? wrap.querySelector("pre.mcc-code") || wrap.querySelector("pre") : null;
        if (pre) copyText(cfg, pre.textContent || "", codeButton);
      }
    });

    // File view toggle: Raw/Code on a source file, Raw/Rendered on markdown.
    // Everything needed is already in the card, so switching never costs a
    // round trip, and the choice survives tab switches because nothing is
    // destroyed. A view with its own pane swaps panes; a view that is only a
    // restyling of the same text (raw code) just moves data-mcc-view, which
    // is what the stylesheet keys off.
    document.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-mcc-view-set]") : null;
      if (!button) return;
      var view = button.getAttribute("data-mcc-view-set");
      var wrap = button.closest(".mcc-fileview");
      if (!wrap) return;
      wrap.setAttribute("data-mcc-view", view);
      var buttons = wrap.querySelectorAll("[data-mcc-view-set]");
      for (var b = 0; b < buttons.length; b++) {
        var on = buttons[b].getAttribute("data-mcc-view-set") === view;
        buttons[b].classList.toggle("mcc-active", on);
        buttons[b].setAttribute("aria-pressed", on ? "true" : "false");
      }
      var panes = wrap.querySelectorAll("[data-mcc-pane]");
      var wanted = null;
      for (var p = 0; p < panes.length; p++) {
        if (panes[p].getAttribute("data-mcc-pane") === view) wanted = panes[p];
      }
      // No pane of its own means this view is a restyling, not a document.
      if (wanted) {
        for (var q = 0; q < panes.length; q++) {
          panes[q].hidden = panes[q] !== wanted;
        }
      }
      post("notify", { message: cardTag(readConfig()) + ":file-view:" + view });
    });

    // External links open through the host.
    document.addEventListener("click", function (event) {
      var anchor = event.target.closest ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      var href = anchor.getAttribute("href") || "";
      if (href.indexOf("http") === 0) {
        post("link", { url: href });
      }
    });

    // Context menu display and dismissal.
    document.addEventListener("contextmenu", function (event) {
      var menu = document.getElementById("mcc-menu");
      if (!menu || menu.childElementCount === 0) return;
      // Editable fields keep the native menu: a user pasting their gist needs
      // the host clipboard items more than a card-level action list.
      if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable=\"true\"]")) {
        menu.style.display = "none";
        return;
      }
      event.preventDefault();
      menu.style.display = "block";
      var x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 6);
      var y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 6);
      menu.style.left = Math.max(4, x) + "px";
      menu.style.top = Math.max(4, y) + "px";
    });
    document.addEventListener("click", function () {
      var menu = document.getElementById("mcc-menu");
      if (menu) menu.style.display = "none";
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var menu = document.getElementById("mcc-menu");
      if (menu) menu.style.display = "none";
    });
  }

  function mccInit() {
    var cfg = readConfig();
    ensureRuntimeStyle();
    ensureCardTools();
    wireDocument();
    initTabs();
    initMotion(cfg);
    initVideo(cfg);
    initDrag(cfg);
    initForms(cfg);
    initCounters();
    initPromptForge(cfg);
    initTutor(cfg);
    buildContextMenu(cfg);
    post("notify", { message: cardTag(cfg) + ":ready" });
  }

  window.mccInit = mccInit;

  // Standalone card documents carry their config inline; initialize now.
  // The MCP Apps template injects config later and calls mccInit() itself.
  if (document.getElementById("mcc-config")) {
    mccInit();
  }
})();
})();
