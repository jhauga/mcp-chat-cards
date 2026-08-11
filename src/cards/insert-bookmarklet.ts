// "Insert Card" bookmarklet. Card iframes are sandboxed, so nothing inside a
// card can add items to the host page's right-click menu - and page script
// cannot extend the browser's native context menu at all. The closest
// reliable equivalent is a bookmarklet the user runs on the host page: it
// watches right-clicks and shows a floating "Insert Card" item next to the
// cursor. Choosing it reads the card HTML that "Copy card" placed on the
// clipboard and injects the card as a sandboxed iframe at the clicked spot
// (above or below the element under the cursor).
//
// The insertion is cosmetic and local to the current page view: it is not
// part of the conversation history and disappears on reload.
//
// Kept free of backticks and dollar-brace sequences so it can live inside a
// TypeScript template literal.
export const INSERT_BOOKMARKLET_JS = `(function () {
  "use strict";

  if (window.__mccInsertInstalled) {
    alert("Insert Card is already active. Right-click where the card should go.");
    return;
  }
  window.__mccInsertInstalled = true;

  var chip = document.createElement("button");
  chip.id = "mcc-insert-chip";
  chip.type = "button";
  chip.textContent = "Insert Card";
  chip.style.cssText =
    "position:fixed;z-index:2147483647;display:none;padding:6px 12px;" +
    "border:1px solid #d8e2ec;border-radius:6px;background:#ffffff;color:#1a4f86;" +
    "font:13px 'Segoe UI',system-ui,sans-serif;" +
    "box-shadow:0 4px 14px rgba(31,35,40,0.18);cursor:pointer;";
  document.body.appendChild(chip);

  // Captured at right-click time: the element under the cursor and the
  // pointer position decide where the card lands.
  var targetEl = null;
  var clickY = 0;

  document.addEventListener("contextmenu", function (event) {
    var node = event.target;
    targetEl = node && node.nodeType === 1 ? node : null;
    clickY = event.clientY;
    chip.style.display = "block";
    chip.style.left = Math.max(4, Math.min(event.clientX + 2, window.innerWidth - chip.offsetWidth - 8)) + "px";
    chip.style.top = Math.max(4, Math.min(event.clientY + 2, window.innerHeight - chip.offsetHeight - 8)) + "px";
  }, true);

  document.addEventListener("click", function (event) {
    if (event.target !== chip) chip.style.display = "none";
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") chip.style.display = "none";
  }, true);

  // Walk up from the clicked node to a block worth inserting beside, so the
  // card is not wedged inside an inline span.
  function insertionAnchor(node) {
    var anchor = node;
    while (
      anchor.parentNode &&
      anchor.parentNode !== document.body &&
      (anchor.getBoundingClientRect().width < 120 || anchor.getBoundingClientRect().height < 16)
    ) {
      anchor = anchor.parentNode;
    }
    return anchor;
  }

  function insertCard(html) {
    if (!targetEl || !targetEl.parentNode) {
      alert("Right-click the spot in the conversation first, then choose Insert Card.");
      return;
    }
    var anchor = insertionAnchor(targetEl);
    if (!anchor.parentNode) return;
    var holder = document.createElement("div");
    holder.setAttribute("data-mcc-inserted", "1");
    holder.style.cssText = "margin:10px 0;";
    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.cssText = "width:100%;height:440px;border:none;border-radius:10px;background:transparent;";
    frame.srcdoc = html;
    holder.appendChild(frame);
    var rect = anchor.getBoundingClientRect();
    var before = clickY < rect.top + rect.height / 2;
    anchor.parentNode.insertBefore(holder, before ? anchor : anchor.nextSibling);
  }

  chip.addEventListener("click", function () {
    chip.style.display = "none";
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert("This page does not allow reading the clipboard; paste the copied card into a file instead.");
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (text && text.indexOf("mcc-card") > -1) {
        insertCard(text);
      } else {
        alert('No copied card found. Right-click a card and choose "Copy card" first.');
      }
    }, function () {
      alert("Clipboard read was blocked. Allow clipboard access for this page and try again.");
    });
  });
})();`;

// A bookmarklet is a javascript: URL saved as a bookmark; the browser runs
// it in the context of the current page when clicked.
export function buildInsertBookmarklet(): string {
  return "javascript:" + encodeURIComponent(INSERT_BOOKMARKLET_JS);
}
