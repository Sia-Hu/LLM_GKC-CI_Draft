console.log("✅ relations.js loaded");

const LABEL_HEADERS = [
  "Sender",
  "Subject",
  "Information Type",
  "Recipient",
  "Aim",
  "Condition",
  "Modalities",
  "NotModalities",
  "Consequence"
];

const tableContainer = document.getElementById("relationTableContainer");
const backBtn = document.getElementById("backToPolicy");

// 🟣 Back button handler
if (backBtn) {
  backBtn.addEventListener("click", () => {
    const lastURL = localStorage.getItem("lastPolicyURL");
    if (lastURL) window.location.href = lastURL;
    else window.history.back();
  });
}

// 🟣 Load relation data
(function loadRelations() {
  const dataJSON = localStorage.getItem("relationsData");
  const taskJSON = sessionStorage.getItem("lastPolicyJson");

  if (!taskJSON) {
    tableContainer.innerHTML = `
      <div class="empty-message">
        ⚠️ No relation data found.<br>
        Go back to the policy page and click <b>“View Relations”</b> again.
      </div>`;
    return;
  }

  const task = JSON.parse(taskJSON);
  const tuples = buildConnectedRelationFlows(task);

  if (!Array.isArray(tuples) || tuples.length === 0) {
    tableContainer.innerHTML = `
      <div class="empty-message">
        📭 No relation tuples available for this policy.
      </div>`;
    return;
  }

  renderRelationTable(tuples);
})();

// 🟣 Extract connected label flows
function buildConnectedRelationFlows(task) {
  const tuples = [];
  const annotations = Array.isArray(task?.annotations) ? task.annotations : [];

  annotations.forEach(annObj => {
    const annotator = annObj?.completed_by?.email || annObj?.completed_by || "Unknown";
    const result = annObj.result || [];

    // 🔹 Step 1. Gather label nodes
    const nodes = new Map(); // id -> { id, label, text, start, end }
    result.forEach(r => {
      if (r.type === "labels" && r.value?.labels) {
        const labelName = Array.isArray(r.value.labels) ? r.value.labels[0] : r.value.labels;
        const start = Number(r.value?.globalOffsets?.start ?? r.value?.start ?? 0);
        const end = Number(r.value?.globalOffsets?.end ?? r.value?.end ?? start);
        nodes.set(r.id, {
          id: r.id,
          label: labelName,
          text: r.value?.text || "",
          start, end
        });
      }
    });

    // 🔹 Step 2. Build undirected graph of connected labels
    const adj = new Map();
    result.forEach(r => {
      if (r.type === "relation" && r.from_id && r.to_id) {
        if (!nodes.has(r.from_id) || !nodes.has(r.to_id)) return;
        if (!adj.has(r.from_id)) adj.set(r.from_id, new Set());
        if (!adj.has(r.to_id)) adj.set(r.to_id, new Set());
        adj.get(r.from_id).add(r.to_id);
        adj.get(r.to_id).add(r.from_id);
      }
    });
    nodes.forEach((_, id) => { if (!adj.has(id)) adj.set(id, new Set()); });

    // 🔹 Step 3. DFS to find connected components
    const seen = new Set();
    const components = [];
    for (const id of adj.keys()) {
      if (seen.has(id)) continue;
      const comp = [];
      const stack = [id];
      seen.add(id);
      while (stack.length) {
        const cur = stack.pop();
        if (nodes.has(cur)) comp.push(nodes.get(cur));
        (adj.get(cur) || []).forEach(nbr => {
          if (!seen.has(nbr)) { seen.add(nbr); stack.push(nbr); }
        });
      }
      if (comp.length) components.push(comp);
    }

    // 🔹 Step 4. Convert each connected group into one row
    components.forEach(comp => {
      comp.sort((a, b) => a.start - b.start);
      const row = { annotator };

      LABEL_HEADERS.forEach(label => { row[label] = []; });

      comp.forEach(n => {
        if (LABEL_HEADERS.includes(n.label)) {
          row[n.label].push(n.text.trim());
        }
      });

      row.startOffset = Math.min(...comp.map(n => n.start));
      tuples.push(row);
    });
  });

  // 🔹 Step 5. Sort by position in the policy text
  // 🔹 Step 5. Sort by text position and group overlaps
tuples.sort((a, b) => {
  const diff = a.startOffset - b.startOffset;
  if (Math.abs(diff) < 30) {
    // same neighborhood → group by annotator alphabetically
    return (a.annotator || "").localeCompare(b.annotator || "");
  }
  return diff;
});
return tuples;
}

// 🟣 Render the table
function renderRelationTable(tuples) {
  const table = document.createElement("table");
  table.className = "relation-table";

  // ✅ Create THEAD
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Annotator", ...LABEL_HEADERS].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ✅ Create TBODY
  const tbody = document.createElement("tbody");
  tuples.forEach(flow => {
    const tr = document.createElement("tr");
    const annotatorCell = document.createElement("td");
    annotatorCell.textContent = flow.annotator || "Unknown";
    tr.appendChild(annotatorCell);

    LABEL_HEADERS.forEach(label => {
      const td = document.createElement("td");
      const texts = flow[label] || [];
      if (texts.length > 0) {
        td.innerHTML = texts
          .map(txt => `<div class="label-entry">“${txt.trim()}”</div>`)
          .join("");
      } else {
        td.innerHTML = `<span class="empty-cell">—</span>`;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);

  console.log(`✅ Rendered ${tuples.length} relation tuples.`);
}

