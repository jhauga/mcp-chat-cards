// Client-side runtime injected into every card. Kept dependency-free and
// written without backticks or dollar-brace sequences so it can live safely
// inside a TypeScript template literal.
//
// The runtime is exposed as window.mccInit() so it can run in two modes:
// - Standalone card documents include an #mcc-config element up front, so
//   the runtime initializes immediately at load.
// - The MCP Apps template injects card markup and config after the tool
//   result arrives, then calls window.mccInit() itself.
//
// Host integration: outbound events go through window.__mccHostBridge when
// a host adapter (the MCP Apps template) has installed one. Otherwise the
// runtime falls back to MCP-UI style window.parent.postMessage messages:
//   { type: "prompt", payload: { prompt } }   - text to run as the next prompt
//   { type: "notify", payload: { message } }  - lightweight event notification
//   { type: "link",   payload: { url } }      - ask the host to open a link
export const CARD_RUNTIME_JS = `(function () {
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
        handle.textContent = "\\u22EE\\u22EE";
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
  function serializeForm(form) {
    var data = {};
    var elements = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (!el.name || el.disabled) continue;
      if (el.type === "checkbox") {
        if (el.checked) {
          if (data[el.name]) data[el.name] += ", " + el.value; else data[el.name] = el.value;
        }
      } else if (el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    }
    return data;
  }

  function buildPrompt(form, data) {
    var template = form.getAttribute("data-prompt-template");
    var webform = form.getAttribute("data-webform");
    if (webform) {
      var spec = {};
      try { spec = JSON.parse(webform); } catch (err) { spec = {}; }
      var payload = { action: spec.action || "", method: spec.method || "POST", sourceUrl: spec.sourceUrl || "", fields: data };
      return "The user filled out the mirrored web form \\"" + (form.getAttribute("data-card-title") || "form") + "\\". " +
        "Review the values with the user if anything looks off, then call the submit_web_form tool with this payload:\\n" +
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
    var lines = ["Form \\"" + (form.getAttribute("data-card-title") || "form") + "\\" submitted with:"];
    for (var name in data) {
      if (Object.prototype.hasOwnProperty.call(data, name)) lines.push("- " + name + ": " + data[name]);
    }
    lines.push("Use these values to direct the next response.");
    return lines.join("\\n");
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

  // ---- Tutor: right-click context actions ----------------------------
  function buildContextMenu(cfg) {
    var existing = document.getElementById("mcc-menu");
    if (existing) existing.remove();
    var actions = cfg.contextActions || [];
    if (actions.length === 0) return;
    var menu = document.createElement("div");
    menu.id = "mcc-menu";
    for (var i = 0; i < actions.length; i++) {
      (function (action) {
        var item = document.createElement("button");
        item.type = "button";
        item.textContent = action.label;
        item.addEventListener("click", function () {
          menu.style.display = "none";
          var selection = "";
          try { selection = String(window.getSelection() || ""); } catch (err) { selection = ""; }
          var prompt = action.prompt;
          while (prompt.indexOf("{{selection}}") > -1) prompt = prompt.replace("{{selection}}", selection);
          sendPrompt(cfg, prompt);
        });
        menu.appendChild(item);
      })(actions[i]);
    }
    document.body.appendChild(menu);
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

    // Copy card and copy code buttons.
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target.closest) return;
      var cfg = readConfig();
      var cardButton = target.closest(".mcc-copy-card");
      if (cardButton) {
        copyText(cfg, "<!DOCTYPE html>\\n" + document.documentElement.outerHTML, cardButton);
        return;
      }
      var codeButton = target.closest(".mcc-copy-code");
      if (codeButton) {
        var wrap = codeButton.closest(".mcc-codewrap");
        var pre = wrap ? wrap.querySelector("pre") : null;
        if (pre) copyText(cfg, pre.textContent || "", codeButton);
      }
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
    wireDocument();
    initTabs();
    initDrag(cfg);
    initForms(cfg);
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
})();`;
