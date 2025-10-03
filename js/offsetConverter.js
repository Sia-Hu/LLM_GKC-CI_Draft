const { JSDOM } = require("jsdom");

function normalizeText(str) {
  return (str || "")
    .replace(/\s+/g, " ")   // collapse multiple spaces & newlines
    .replace(/\u00A0/g, " ") // replace non-breaking spaces
    .trim();
}

function addGlobalOffsets(task) {
  const rawHTML = (task.data && task.data.text) || task.file_upload || "";
  if (!rawHTML) return task;

  const dom = new JSDOM(rawHTML);
  const document = dom.window.document;
  const { NodeFilter, XPathResult } = dom.window;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  let flatText = "";
  const offsets = new Map();
  let pos = 0;

  while (walker.nextNode()) {
    const nodeText = normalizeText(walker.currentNode.nodeValue);
    const start = pos;
    const end = start + nodeText.length;
    offsets.set(walker.currentNode, { start, end, text: nodeText });
    flatText += nodeText;
    pos = end;
  }

  (task.annotations || []).forEach(ann => {
    (ann.result || []).forEach(r => {
      if (!r.value) return;

      const text = normalizeText(r.value.text || "");
      const xpath = r.value.start || "";

      if (!xpath || !text) return;

      let node = null;
      try {
        node = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      } catch (e) {
        console.warn("Invalid XPath skipped:", xpath, e.message);
      }

      if (node && offsets.has(node)) {
        const { start: globalStart, text: nodeText } = offsets.get(node);
        const localIndex = normalizeText(nodeText).indexOf(text);
        if (globalStart != null && localIndex !== -1) {
          const start = globalStart + localIndex;
          const end = start + text.length;
          r.value.globalOffsets = { start, end };
        }
      } else {
        // fallback global search
        const globalIndex = flatText.indexOf(text);
        if (globalIndex !== -1) {
          r.value.globalOffsets = {
            start: globalIndex,
            end: globalIndex + text.length
          };
        }
      }
    });
  });

  task.flatText = flatText;
  return task;
}

module.exports = { addGlobalOffsets };
