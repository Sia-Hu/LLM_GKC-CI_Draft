// API configuration to match main.js
const API_BASE = window.location.port === '8000' ? 'http://localhost:8001/api' : '/api';

// Get policy name from URL
const urlParams = new URLSearchParams(window.location.search);
const policyName = urlParams.get('policy');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  if (policyName) {
    updatePageTitle(policyName);
    loadPolicyFromServer(policyName);
  }
  
  document.getElementById('fileInput').addEventListener('change', handleManualUpload);
});

function updatePageTitle(policyName) {
  document.title = `Policy Analysis - ${policyName}`;
  document.getElementById('pageTitle').textContent = `Policy Analysis: ${policyName}`;
}

async function loadPolicyFromServer(policyName) {
  try {
    showLoading('Loading policy data from server...');
    
    const response = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyName)}`);
    if (!response.ok) {
      throw new Error('Policy not found on server');
    }

    const policyData = await response.json();
    
    if (!policyData.contributors || Object.keys(policyData.contributors).length === 0) {
      showMessage('No annotations found for this policy. Upload a file below.');
      return;
    }

    // Find the most recent annotation file
    let latestFile = null;
    let latestTime = 0;
    
    Object.values(policyData.contributors).forEach(contributor => {
      contributor.uploads.forEach(upload => {
        const uploadTime = new Date(upload.uploadedAt).getTime();
        if (uploadTime > latestTime && upload.annotationCount > 0) {
          latestFile = upload;
          latestTime = uploadTime;
        }
      });
    });

    if (!latestFile) {
      showMessage('No annotation files found. Upload a file below.');
      return;
    }

    // Load the annotation file
    const fileResponse = await fetch(`${API_BASE}/policy-file/${encodeURIComponent(policyName)}/${encodeURIComponent(latestFile.storedAs)}`);
    
    if (!fileResponse.ok) {
      throw new Error('Could not load annotation file');
    }

    const annotationData = await fileResponse.json();
    
    // Show server data info
    showServerDataInfo(policyData, latestFile);
    
    // Process the data
    const task = Array.isArray(annotationData) ? annotationData[0] : annotationData;
    processTask(task);

  } catch (error) {
    console.error('Error loading from server:', error);
    showMessage('Could not load server data. You can upload a file manually below.');
  }
}

function showServerDataInfo(policyData, latestFile) {
  const infoDiv = document.getElementById('serverDataInfo');
  const dataSource = document.getElementById('dataSource');
  
  const contributors = Object.keys(policyData.contributors).join(', ');
  const lastUpdated = new Date(policyData.lastUpdated).toLocaleDateString();
  const totalAnnotations = policyData.totalAnnotations || 0;
  
  dataSource.innerHTML = `Contributors: ${contributors}<br>Last updated: ${lastUpdated}<br>Total annotations: ${totalAnnotations}`;
  infoDiv.style.display = 'block';
  
  // Hide manual upload by default when server data loads
  document.getElementById('fileUploadSection').style.display = 'none';
}

function showManualUpload() {
  document.getElementById('fileUploadSection').style.display = 'block';
}

function showLoading(message) {
  document.getElementById('stats').innerHTML = `<span class="loading">${message}</span>`;
  document.getElementById('policyContainer').innerHTML = `<div class="loading">${message}</div>`;
}

function showMessage(message) {
  document.getElementById('stats').innerHTML = message;
  document.getElementById('policyContainer').innerHTML = message;
}

function handleManualUpload(event) {
  const f = event.target.files[0];
  if (!f) return;
  
  showLoading('Processing file...');
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);
      const task = Array.isArray(json) ? json[0] : json;
      
      // Hide server data info when manual file is uploaded
      document.getElementById('serverDataInfo').style.display = 'none';
      
      processTask(task);
    } catch (err) {
      document.getElementById('stats').innerHTML = `<span class="error">Failed to parse JSON: ${err.message}</span>`;
      document.getElementById('policyContainer').innerHTML = `<div class="error">Invalid JSON file</div>`;
    }
  };
  reader.readAsText(f);
}

function parseHTMLBody(htmlString) {
  try {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    return doc.body ? doc.body.innerHTML : htmlString;
  } catch (e) {
    return htmlString;
  }
}

function buildTextNodeIndex(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  let idx = 0;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    nodes.push({ node: node, start: idx, end: idx + len });
    idx += len;
  }
  return { nodes, totalLength: idx };
}

function findNodeForOffset(nodesIndex, offset) {
  if (offset === nodesIndex.totalLength) {
    const last = nodesIndex.nodes[nodesIndex.nodes.length - 1];
    return { node: last.node, local: last.node.nodeValue.length };
  }
  for (let n of nodesIndex.nodes) {
    if (offset >= n.start && offset < n.end) {
      return { node: n.node, local: offset - n.start };
    }
  }
  return null;
}

function computeColorAndDetails(coveringAnns) {
  if (!coveringAnns || coveringAnns.length === 0) return { className: null, details: '' };
  
  const labels = [...new Set(coveringAnns.map(a => a.label))];
  const users = [...new Set(coveringAnns.map(a => a.user))];
  let className = 'yellow';
  if (labels.length === 1 && users.length > 1) className = 'green';
  else if (labels.length > 1) className = 'red';

  const orderedLabels = [
    "Sender", "Subject", "Information Type", "Recipient", 
    "Aim", "Condition", "Modalities", "Consequence"
  ];
  const labelsToUsers = {};
  coveringAnns.forEach(ann => {
    if (!ann.label) return;
    if (!labelsToUsers[ann.label]) {
      labelsToUsers[ann.label] = new Set();
    }
    labelsToUsers[ann.label].add(ann.user);
  });

  const detailsArr = [];
  const processedLabels = new Set();

  orderedLabels.forEach(label => {
    if (labelsToUsers[label]) {
      let section = `<b>${label}</b><br>`;
      section += [...labelsToUsers[label]].map(user => `&nbsp;&nbsp;- Annotator ${user}`).join('<br>');
      detailsArr.push(section);
      processedLabels.add(label);
    }
  });

  Object.keys(labelsToUsers).forEach(label => {
    if (!processedLabels.has(label)) {
      let section = `<b>${label}</b><br>`;
      section += [...labelsToUsers[label]].map(user => `&nbsp;&nbsp;- Annotator ${user}`).join('<br>');
      detailsArr.push(section);
    }
  });
  
  const details = detailsArr.join('<br><br>');
  return { className, details };
}

function updateStatsDisplay(distinctSpansCount, fullAgreements, totalAnnotators) {
  const distinctSpansEl = document.getElementById('distinctSpans');
  const fullAgreementsEl = document.getElementById('fullAgreements');
  const agreementRateEl = document.getElementById('agreementRate');
  const totalAnnotatorsEl = document.getElementById('totalAnnotators');
  
  if (distinctSpansEl) distinctSpansEl.textContent = distinctSpansCount;
  if (fullAgreementsEl) fullAgreementsEl.textContent = fullAgreements;
  if (totalAnnotatorsEl) totalAnnotatorsEl.textContent = totalAnnotators;
  
  const agreementRate = distinctSpansCount > 0 ? Math.round((fullAgreements / distinctSpansCount) * 100) : 0;
  if (agreementRateEl) agreementRateEl.textContent = agreementRate + '%';
}

function processTask(task) {
  const container = document.getElementById('policyContainer');
  container.innerHTML = '';

  const rawHTML = (task.data && task.data.text) ? task.data.text : (task.file_upload || '');
  const bodyHTML = parseHTMLBody(rawHTML);
  container.innerHTML = bodyHTML;

  const annSpans = [];
  const allUsers = new Set();
  
  (task.annotations || []).forEach(annObj => {
    allUsers.add(annObj.completed_by);
    (annObj.result || []).forEach(r => {
      if (r.value && r.value.globalOffsets) {
        annSpans.push({
          start: Number(r.value.globalOffsets.start),
          end: Number(r.value.globalOffsets.end),
          user: annObj.completed_by,
          label: Array.isArray(r.value.labels) ? r.value.labels[0] : (r.value.labels || null),
          text: r.value.text || ''
        });
      }
    });
  });

  if (annSpans.length === 0) {
    document.getElementById('stats').innerText = 'No annotation spans found.';
    updateStatsDisplay(0, 0, 0);
    return;
  }

  let nodesIndex = buildTextNodeIndex(container);
  const totalLen = nodesIndex.totalLength;
  const breakSet = new Set([0, totalLen]);
  annSpans.forEach(s => {
    if (s.start >= 0 && s.start <= totalLen) breakSet.add(s.start);
    if (s.end >= 0 && s.end <= totalLen) breakSet.add(s.end);
  });
  const breaks = [...breakSet].sort((a,b)=>a-b);

  const segments = [];
  for (let i=0;i<breaks.length-1;i++){
    const s=breaks[i], e=breaks[i+1];
    if (s===e) continue;
    const covering = annSpans.filter(a=>a.start<=s && a.end>=e);
    segments.push({start:s,end:e,covering});
  }

  const segmentsToWrap = segments.filter(seg=>seg.covering.length>0)
                          .sort((a,b)=>b.start-a.start);

  segmentsToWrap.forEach(seg=>{
    nodesIndex = buildTextNodeIndex(container);
    const curTotal = nodesIndex.totalLength;
    const segStart = Math.min(seg.start, curTotal);
    const segEnd = Math.min(seg.end, curTotal);
    const startPos = findNodeForOffset(nodesIndex, segStart);
    const endPos = findNodeForOffset(nodesIndex, segEnd);
    if (!startPos || !endPos) return;
    try {
      const range=document.createRange();
      range.setStart(startPos.node,startPos.local);
      range.setEnd(endPos.node,endPos.local);
      const {className,details}=computeColorAndDetails(seg.covering);
      const frag=range.extractContents();
      const span=document.createElement('span');
      span.className='highlight '+className;
      span.dataset.details=details;
      span.appendChild(frag);
      range.insertNode(span);
    } catch(e){console.warn('wrap failed',seg,e);}
  });

  container.querySelectorAll('.highlight').forEach(el=>{
    el.addEventListener('mouseenter',()=>{
      document.getElementById('details').innerHTML = el.dataset.details || 'No labels';
    });
  });
  
  const grouped = {};
  annSpans.forEach(a=>{
    const k=`${a.start}-${a.end}`;
    if(!grouped[k]) grouped[k]=[];
    grouped[k].push(a);
  });
  const fullAgree = Object.values(grouped).filter(list=>{
    const labels=[...new Set(list.map(x=>x.label))];
    const users=[...new Set(list.map(x=>x.user))];
    return labels.length===1 && users.length>1;
  }).length;

  updateStatsDisplay(Object.keys(grouped).length, fullAgree, allUsers.size);
  document.getElementById('stats').innerHTML = 'Analysis complete. See statistics above and hover over highlighted text for details.';
}

// Management functions
function exportPolicyData() {
  if (!policyName) {
    alert('No policy selected for export');
    return;
  }
  // This would integrate with your main.js export functionality
  if (window.exportPolicyData) {
    window.exportPolicyData(policyName);
  } else {
    alert('Export functionality not available. Please use the main dashboard.');
  }
}

function deleteCurrentPolicy() {
  if (!policyName) {
    alert('No policy selected for deletion');
    return;
  }
  
  if (confirm(`Are you sure you want to delete the policy "${policyName}"? This action cannot be undone.`)) {
    // This would integrate with your main.js delete functionality
    if (window.deleteProject) {
      window.deleteProject(encodeURIComponent(policyName)).then(() => {
        alert('Policy deleted successfully');
        window.location.href = 'index.html';
      }).catch(error => {
        alert('Failed to delete policy: ' + error.message);
      });
    } else {
      alert('Delete functionality not available. Please use the main dashboard.');
    }
  }
}

function viewProjectFiles(policyName) {
  if (!policyName) {
    alert('No policy selected');
    return;
  }
  
  // This would integrate with your main.js file viewing functionality
  if (window.viewProjectFiles) {
    window.viewProjectFiles(policyName);
  } else {
    alert('File viewing functionality not available. Please use the main dashboard.');
  }
}