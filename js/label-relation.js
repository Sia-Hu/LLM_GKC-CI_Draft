// label-relation.js — Pure renderer (no auto-loading, no globals beyond window.renderLabelRelations)

// Custom colors for relation nodes
const labelColors = {
  Sender: '#3498db',
  Recipient: '#2ecc71',
  Subject: '#9b59b6',
  'Information Type': '#e74c3c',
  Modalities: '#f39c12',
  NotModalities: '#e67e22',
  Condition: '#1abc9c',
  Aim: '#34495e'
};

// ---------- helpers ----------
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

function wrapText(text, maxWidth) {
  const words = (text || '').split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + word).length > maxWidth) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines.slice(0, 3);
}

// ---------- connected components ----------
function findConnectedComponents(nodes, links) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map(nodes.map(n => [n.id, []]));
  links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (adj.has(s)) adj.get(s).push(t);
    if (adj.has(t)) adj.get(t).push(s);
  });

  const seen = new Set();
  const comps = [];
  function dfs(id, comp) {
    seen.add(id);
    comp.push(nodeMap.get(id));
    (adj.get(id) || []).forEach(nid => { if (!seen.has(nid)) dfs(nid, comp); });
  }

  for (const n of nodes) {
    if (!seen.has(n.id)) { const comp = []; dfs(n.id, comp); comps.push(comp); }
  }

  // sort by start offset for stable stacking
  comps.sort((a, b) => Math.min(...a.map(n => n.startPos)) - Math.min(...b.map(n => n.startPos)));
  return comps;
}

// ---------- main draw ----------
function createNetworkGraph(annotation, containerId) {
  const result = annotation?.result || [];
  const nodeMap = new Map();
  const links = [];

  result.forEach(item => {
    if (item.type === 'labels' && item.value?.labels) {
      const startPos = item.value.globalOffsets ? Number(item.value.globalOffsets.start) : 0;
      const endPos = item.value.globalOffsets ? Number(item.value.globalOffsets.end) : 0;
      if (!nodeMap.has(item.id)) {
        nodeMap.set(item.id, {
          id: item.id,
          label: Array.isArray(item.value.labels) ? item.value.labels[0] : item.value.labels,
          text: item.value.text || '',
          type: Array.isArray(item.value.labels) ? item.value.labels[0] : item.value.labels,
          startPos, endPos
        });
      }
    } else if (item.type === 'relation' && item.from_id && item.to_id) {
      links.push({ source: item.from_id, target: item.to_id });
    }
  });

  const nodes = Array.from(nodeMap.values());
  const components = findConnectedComponents(nodes, links);

  const container = d3.select(`#${containerId}`);
  if (container.empty()) return { nodes: 0, links: 0, components: 0 };
  container.selectAll('*').remove();

  const width = container.node().getBoundingClientRect().width || 800;
  const height = Math.max(700, components.length * 220);

  const svg = container.append('svg').attr('width', width).attr('height', height);
  const g = svg.append('g');
  svg.call(
    d3.zoom().scaleExtent([0.5, 3]).on('zoom', (event) => g.attr('transform', event.transform))
  );

  let currentY = 120;
  const componentSpacing = 220;

  components.forEach(component => {
    const compNodes = component.map(n => ({ ...n }));
    const compLinks = links.filter(l =>
      component.some(n => n.id === (typeof l.source === 'object' ? l.source.id : l.source)) &&
      component.some(n => n.id === (typeof l.target === 'object' ? l.target.id : l.target))
    );

    const sim = d3.forceSimulation(compNodes)
      .force('link', d3.forceLink(compLinks).id(d => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('x', d3.forceX(width / 2).strength(0.06))
      .force('y', d3.forceY(currentY).strength(0.5))
      .force('collision', d3.forceCollide().radius(80));

    const link = g.append('g').selectAll('line')
      .data(compLinks).join('line')
      .attr('stroke', '#999').attr('stroke-opacity', 0.6).attr('stroke-width', 2);

    const node = g.append('g').selectAll('g')
      .data(compNodes).join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', (event) => { if (!event.active) sim.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; })
        .on('drag', (event) => { event.subject.fx = event.x; event.subject.fy = event.y; })
        .on('end',  (event) => { if (!event.active) sim.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; })
      );

    node.append('circle')
      .attr('r', 60)
      .attr('fill', d => labelColors[d.type] || '#95a5a6')
      .attr('stroke', '#fff').attr('stroke-width', 3);

    node.append('text')
      .attr('dy', -45).attr('text-anchor', 'middle')
      .text(d => d.type);

    node.append('text')
      .attr('dy', -33).attr('text-anchor', 'middle')
      .text(d => `(${d.startPos}-${d.endPos})`);

    node.each(function(d){
      const gNode = d3.select(this);
      wrapText(truncateText(d.text, 60), 20).forEach((line, i) => {
        gNode.append('text')
          .attr('dy', -10 + (i * 12))
          .attr('text-anchor', 'middle')
          .text(line);
      });
    });

    node.append('title')
      .text(d => `${d.type} (${d.startPos}-${d.endPos})\n"${d.text}"`);

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    currentY += componentSpacing;
  });

  // click broadcast (optional)
  d3.selectAll(`#${containerId} .node circle`).on('click', function(event, d) {
    const customEvent = new CustomEvent('graphNodeClick', {
      detail: { start: d.startPos, end: d.endPos, text: d.text }
    });
    window.dispatchEvent(customEvent);
  });

  return { nodes: nodes.length, links: links.length, components: components.length };
}

// Public API
window.renderLabelRelations = function renderLabelRelations(annotationData, containerId = 'networkGraph') {
  return createNetworkGraph(annotationData, containerId);
};
