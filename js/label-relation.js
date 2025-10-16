const labelColors = {
  'Sender': '#3498db',
  'Recipient': '#2ecc71',
  'Subject': '#9b59b6',
  'Information Type': '#e74c3c',
  'Modalities': '#f39c12',
  'NotModalities': '#e67e22',
  'Condition': '#1abc9c',
  'Aim': '#34495e'
};

// ----------------------------------------------
// Helpers
// ----------------------------------------------

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function wrapText(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length > maxWidth) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });

  if (currentLine) lines.push(currentLine.trim());
  return lines.slice(0, 3);
}

// ----------------------------------------------
// Find connected components (subgraphs)
// ----------------------------------------------
function findConnectedComponents(nodes, links) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjList = new Map();
  nodes.forEach(n => adjList.set(n.id, []));
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (adjList.has(sourceId)) adjList.get(sourceId).push(targetId);
    if (adjList.has(targetId)) adjList.get(targetId).push(sourceId);
  });

  const visited = new Set();
  const components = [];

  function dfs(nodeId, component) {
    visited.add(nodeId);
    component.push(nodeMap.get(nodeId));
    adjList.get(nodeId).forEach(neighborId => {
      if (!visited.has(neighborId)) dfs(neighborId, component);
    });
  }

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component = [];
      dfs(node.id, component);
      components.push(component);
    }
  });

  // Sort components by Y position for cleaner layout
  components.sort((a, b) => {
    const minA = Math.min(...a.map(n => n.startPos));
    const minB = Math.min(...b.map(n => n.startPos));
    return minA - minB;
  });

  return components;
}

// ----------------------------------------------
// Main D3 network rendering
// ----------------------------------------------
function createNetworkGraph(annotation, containerId) {
  const result = annotation.result || [];
  const nodes = new Map();
  const links = [];

  // Build nodes and links
  result.forEach(item => {
    if (item.type === 'labels' && item.value.labels) {
      item.value.labels.forEach(label => {
        if (!nodes.has(item.id)) {
          const startPos = item.value.globalOffsets ? item.value.globalOffsets.start : 0;
          const endPos = item.value.globalOffsets ? item.value.globalOffsets.end : 0;
          nodes.set(item.id, {
            id: item.id,
            label: label,
            text: item.value.text,
            type: label,
            startPos,
            endPos
          });
        }
      });
    } else if (item.type === 'relation') {
      links.push({ source: item.from_id, target: item.to_id });
    }
  });

  const nodesArray = Array.from(nodes.values());
  const components = findConnectedComponents(nodesArray, links);

  // Prepare SVG container
  const container = d3.select(`#${containerId}`);
  container.selectAll('*').remove(); // clear previous
  const width = container.node().getBoundingClientRect().width || 800;
  const height = 700;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');
  const zoom = d3.zoom().scaleExtent([0.5, 3])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);

  const componentSpacing = 200;
  let currentY = 100;

  components.forEach(component => {
    const componentNodes = component.map(n => ({ ...n, componentY: currentY }));
    const componentLinks = links.filter(link =>
      component.some(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source)) &&
      component.some(n => n.id === (typeof link.target === 'object' ? link.target.id : link.target))
    );

    const simulation = d3.forceSimulation(componentNodes)
      .force('link', d3.forceLink(componentLinks).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(currentY).strength(0.5))
      .force('collision', d3.forceCollide().radius(80));

    const link = g.append('g')
      .selectAll('line')
      .data(componentLinks)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    const node = g.append('g')
      .selectAll('g')
      .data(componentNodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', 60)
      .attr('fill', d => labelColors[d.type] || '#95a5a6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3);

    node.append('text')
      .attr('class', 'node-label-type')
      .attr('dy', -45)
      .attr('text-anchor', 'middle')
      .text(d => d.type);

    node.append('text')
      .attr('class', 'node-label-position')
      .attr('dy', -33)
      .attr('text-anchor', 'middle')
      .text(d => '(' + d.startPos + '-' + d.endPos + ')');

    node.each(function (d) {
      const nodeGroup = d3.select(this);
      const textLines = wrapText(truncateText(d.text, 60), 20);
      textLines.forEach((line, i) => {
        nodeGroup.append('text')
          .attr('class', 'node-label-text')
          .attr('dy', -10 + (i * 12))
          .attr('text-anchor', 'middle')
          .text(line);
      });
    });

    node.append('title')
      .text(d => d.type + ' (' + d.startPos + '-' + d.endPos + ')\n"' + d.text + '"');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    currentY += componentSpacing;
  });

  return { nodes: nodesArray.length, links: links.length, components: components.length };
}

// ----------------------------------------------
// Public renderer: called by policyPage.js
// ----------------------------------------------
window.renderLabelRelations = function (annotationData, containerId = 'networkGraph') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('No container found for label relations');
    return;
  }
  container.innerHTML = '';
  console.log('Rendering label relations network...');

  // Create visualization
  const stats = createNetworkGraph(annotationData, containerId);

  // Attach node click handler to broadcast event
  d3.selectAll(`#${containerId} .node circle`)
    .on('click', function (event, d) {
      console.log('Clicked node:', d);
      const customEvent = new CustomEvent('graphNodeClick', {
        detail: { start: d.startPos, end: d.endPos, text: d.text }
      });
      window.dispatchEvent(customEvent);
    });

  return stats;
};

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const policyName = params.get("policy");
  const uploadSection = document.getElementById("uploadSection");
  const autoMsg = document.getElementById("autoLoadMessage");

  if (policyName) {
    console.log(`Auto-loading label relation graph for: ${policyName}`);
    document.getElementById("pageTitle").textContent =
      `Label Relations: ${policyName}`;
    if (uploadSection) uploadSection.style.display = "none"; // Hide upload UI
    if (autoMsg) {
      autoMsg.textContent = `📡 Automatically loaded network for "${policyName}"`;
      autoMsg.style.display = "block";
    }

    try {
      const res = await fetch(`/api/policies/${encodeURIComponent(policyName)}`);
      if (!res.ok) throw new Error("Policy not found");
      const policyData = await res.json();

      // Find the most recent file (same logic as policyPage)
      let latestFile = null;
      let latestTime = 0;
      Object.values(policyData.contributors).forEach(c => {
        (c.uploads || []).forEach(upload => {
          const t = new Date(upload.uploadedAt).getTime();
          if (t > latestTime && upload.annotationCount > 0) {
            latestFile = upload;
            latestTime = t;
          }
        });
      });

      if (!latestFile) {
        throw new Error("No valid annotation file found.");
      }

      const fileRes = await fetch(
        `/api/policy-file/${encodeURIComponent(policyName)}/${encodeURIComponent(latestFile.storedAs)}`
      );
      if (!fileRes.ok) throw new Error("Failed to fetch annotation data");

      const annotationData = await fileRes.json();
      const task = Array.isArray(annotationData) ? annotationData[0] : annotationData;

      console.log("Rendering relation graph for task:", task.id || "unknown");
      if (window.renderLabelRelations) {
        renderLabelRelations(task.annotations[0], "networkGraph");
      } else {
        console.error("renderLabelRelations is not defined");
      }
    } catch (err) {
      console.error("Auto-load error:", err);
      const msg = document.getElementById("errorMessage");
      msg.textContent = `❌ Failed to load data for "${policyName}": ${err.message}`;
      msg.style.display = "block";
      if (uploadSection) uploadSection.style.display = "block";
    }
  } else {
    // No ?policy= in URL → show manual upload UI
    console.log("No policy name detected; waiting for manual upload.");
    if (uploadSection) uploadSection.style.display = "block";
  }
});