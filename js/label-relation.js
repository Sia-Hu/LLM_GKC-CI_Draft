// Label Relations Network JS

// Colors for different labels
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

// Upload area drag/drop
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processFile(file);
});

// Helpers
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
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

// File processor
async function processFile(file) {
  const errorMsg = document.getElementById('errorMessage');
  const successMsg = document.getElementById('successMessage');

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  if (!file.name.endsWith('.json')) {
    errorMsg.textContent = 'Please upload a JSON file';
    errorMsg.style.display = 'block';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      successMsg.textContent = 'File loaded successfully: ' + file.name;
      successMsg.style.display = 'block';

      document.getElementById('visualizations').innerHTML = '';
      document.getElementById('visualizations').style.display = 'block';

      createVisualizations(data);
    } catch (error) {
      errorMsg.textContent = 'Error parsing JSON: ' + error.message;
      errorMsg.style.display = 'block';
    }
  };
  reader.onerror = () => {
    errorMsg.textContent = 'Error reading file';
    errorMsg.style.display = 'block';
  };
  reader.readAsText(file);
}

// Find connected components
function findConnectedComponents(nodes, links) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjList = new Map();
  nodes.forEach(n => adjList.set(n.id, []));
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    adjList.get(sourceId).push(targetId);
    adjList.get(targetId).push(sourceId);
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
  components.sort((a, b) => {
    const minA = Math.min(...a.map(n => n.startPos));
    const minB = Math.min(...b.map(n => n.startPos));
    return minA - minB;
  });
  return components;
}

// Graph drawing
function createNetworkGraph(annotation, containerId) {
  const result = annotation.result;
  const nodes = new Map();
  const links = [];

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

  const container = d3.select('#' + containerId);
  const width = container.node().getBoundingClientRect().width;
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
      .text(d => d.type);

    node.append('text')
      .attr('class', 'node-label-position')
      .attr('dy', -33)
      .text(d => '(' + d.startPos + '-' + d.endPos + ')');

    node.each(function(d) {
      const nodeGroup = d3.select(this);
      const textLines = wrapText(truncateText(d.text, 60), 20);
      textLines.forEach((line, i) => {
        nodeGroup.append('text')
          .attr('class', 'node-label-text')
          .attr('dy', -10 + (i * 12))
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
      node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
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

// Build visualizations per task/annotation
function createVisualizations(data) {
  data.forEach((item, taskIndex) => {
    const vizContainer = document.getElementById('visualizations');
    const taskSection = document.createElement('div');
    taskSection.className = 'task-section';
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    taskHeader.textContent = 'Task ID: ' + item.id + ' | File: ' + item.file_upload;
    const annotationsContainer = document.createElement('div');
    annotationsContainer.className = 'annotations-container';
    taskSection.appendChild(taskHeader);
    taskSection.appendChild(annotationsContainer);
    vizContainer.appendChild(taskSection);

    item.annotations.forEach((annotation, annIndex) => {
      const containerId = 'annotation-' + taskIndex + '-' + annIndex;
      const card = document.createElement('div');
      card.className = 'annotation-card';
      const header = document.createElement('div');
      header.className = 'annotation-header';
      const annotatorName = 'Annotator ' + annotation.completed_by;
      header.innerHTML = '<div class="annotation-title">' + annotatorName +
        ' (ID: ' + annotation.id + ')</div>' +
        '<div class="annotation-meta">Created: ' +
        new Date(annotation.created_at).toLocaleString() + '</div>';
      const networkDiv = document.createElement('div');
      networkDiv.id = containerId;
      networkDiv.className = 'network-container';
      card.appendChild(header);
      card.appendChild(networkDiv);
      annotationsContainer.appendChild(card);

      setTimeout(() => {
        const stats = createNetworkGraph(annotation, containerId);
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats';
        statsDiv.innerHTML = '<strong>Statistics:</strong> ' + stats.nodes +
          ' labels, ' + stats.links + ' relations, ' + stats.components +
          ' subgraphs | <strong>Tip:</strong> Scroll to zoom, drag nodes to reposition';
        card.appendChild(statsDiv);
        const legend = document.createElement('div');
        legend.className = 'legend';
        Object.entries(labelColors).forEach(([label, color]) => {
          legend.innerHTML += '<div class="legend-item">' +
            '<div class="legend-color" style="background-color: ' + color + '"></div>' +
            '<span>' + label + '</span></div>';
        });
        card.appendChild(legend);
      }, 100 * annIndex);
    });
  });
}
