// Policy Page JavaScript - Annotation Agreement Analysis

// API configuration to match main.js
const API_BASE = window.location.port === '8000' ? 'http://localhost:3000/api' : '/api';

// Get policy name from URL
const urlParams = new URLSearchParams(window.location.search);
const policyName = urlParams.get('policy');

/* 
 * Required Server Endpoints for File Management:
 * 
 * DELETE /api/policies/:policyName/contributors/:contributor/files/:fileName
 * - Deletes individual file from contributor's uploads
 * - Should update policy statistics
 * - Should remove contributor if no files remain
 * 
 * GET /api/policies/:policyName/contributors/:contributor/files/:fileName/download
 * - Downloads individual file
 * - Should return proper Content-Disposition header
 * 
 * These endpoints should be added to your server.js file
 */

// Initialize page when DOM is ready
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
  
  if (!infoDiv || !dataSource) return;
  
  const contributors = Object.keys(policyData.contributors).join(', ');
  const lastUpdated = new Date(policyData.lastUpdated).toLocaleDateString();
  const totalAnnotations = policyData.totalAnnotations || 0;
  
  dataSource.innerHTML = `Contributors: ${contributors}<br>Last updated: ${lastUpdated}<br>Total annotations: ${totalAnnotations}`;
  infoDiv.style.display = 'block';
  
  // Hide manual upload by default when server data loads
  const uploadSection = document.getElementById('fileUploadSection');
  if (uploadSection) {
    uploadSection.style.display = 'none';
  }
}

function showManualUpload() {
  const uploadSection = document.getElementById('fileUploadSection');
  if (uploadSection) {
    uploadSection.style.display = 'block';
  }
}

function showLoading(message) {
  const statsEl = document.getElementById('stats');
  const containerEl = document.getElementById('policyContainer');
  
  if (statsEl) {
    statsEl.innerHTML = `<span class="loading">${message}</span>`;
  }
  if (containerEl) {
    containerEl.innerHTML = `<div class="loading">${message}</div>`;
  }
}

function showMessage(message) {
  const statsEl = document.getElementById('stats');
  const containerEl = document.getElementById('policyContainer');
  
  if (statsEl) {
    statsEl.innerHTML = message;
  }
  if (containerEl) {
    containerEl.innerHTML = message;
  }
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
      const serverInfo = document.getElementById('serverDataInfo');
      if (serverInfo) {
        serverInfo.style.display = 'none';
      }
      
      processTask(task);
    } catch (err) {
      const statsEl = document.getElementById('stats');
      const containerEl = document.getElementById('policyContainer');
      
      if (statsEl) {
        statsEl.innerHTML = `<span class="error">Failed to parse JSON: ${err.message}</span>`;
      }
      if (containerEl) {
        containerEl.innerHTML = `<div class="error">Invalid JSON file</div>`;
      }
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

function normalizeText(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function buildTextNodeIndex(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  let idx = 0;
  while ((node = walker.nextNode())) {
    const normText = normalizeText(node.nodeValue);
    const len = normText.length;
    nodes.push({ node: node, start: idx, end: idx + len, text: normText });
    idx += len;
  }
  return { nodes, totalLength: idx };
}

function findNodeForOffset(nodesIndex, offset) {
  if (offset === nodesIndex.totalLength) {
    const last = nodesIndex.nodes[nodesIndex.nodes.length - 1];
    if (last && last.node) {
      return { node: last.node, local: last.node.nodeValue.length };
    }
  }
  for (let n of nodesIndex.nodes) {
    if (offset >= n.start && offset < n.end) {
      return { node: n.node, local: offset - n.start };
    }
  }
  return null;
}

function computeColorAndDetails(coveringAnns, allAnnotators) {
  if (!coveringAnns || coveringAnns.length === 0) {
    return { className: null, details: '' };
  }

  const labels = [...new Set(coveringAnns.map(a => a.label).filter(Boolean))];
  const users = [...new Set(coveringAnns.map(a => a.user))];
  const allUsers = [...allAnnotators];

  let className;
  if (labels.length === 1 && users.length === allUsers.length) {
    className = 'green'; // full agreement
  } else if (labels.length > 1) {
    className = 'red'; // conflicting labels
  } else {
    className = 'yellow'; // partial labeling
  }

  // Group users by label
  const labelsToUsers = {};
  coveringAnns.forEach(ann => {
    if (!ann.label) return;
    if (!labelsToUsers[ann.label]) {
      labelsToUsers[ann.label] = new Set();
    }
    labelsToUsers[ann.label].add(ann.user);
  });

  const detailsArr = [];
  const processedUsers = new Set();

  // Add label sections
  Object.entries(labelsToUsers).forEach(([label, usersSet]) => {
    let section = `<b>${label}</b><br>`;
    section += [...usersSet].map(u => `&nbsp;&nbsp;- ${u}`).join('<br>');
    detailsArr.push(section);
    usersSet.forEach(u => processedUsers.add(u));
  });

  // Add "Not labeled" section for annotators missing in this segment
  const notLabeledUsers = allUsers.filter(u => !processedUsers.has(u));
  if (notLabeledUsers.length > 0) {
    let section = `<b>Not labeled</b><br>`;
    section += notLabeledUsers.map(u => `&nbsp;&nbsp;- ${u}`).join('<br>');
    detailsArr.push(section);
  }

  return { className, details: detailsArr.join('<br><br>') };
}

function updateStatsDisplay(distinctSpansCount, fullAgreements, totalAnnotators) {
  const distinctSpansEl = document.getElementById('distinctSpans');
  const fullAgreementsEl = document.getElementById('fullAgreements');
  const totalAnnotatorsEl = document.getElementById('totalAnnotators');
  
  if (distinctSpansEl) distinctSpansEl.textContent = distinctSpansCount;
  if (fullAgreementsEl) fullAgreementsEl.textContent = fullAgreements;
  if (totalAnnotatorsEl) totalAnnotatorsEl.textContent = totalAnnotators;
}

function calculateF1Metrics(annSpans, allUsers) {
  if (annSpans.length === 0 || allUsers.size < 2) {
    return { precision: 0, recall: 0, f1Score: 0 };
  }

  // Group annotations by annotator
  const annotatorSpans = {};
  annSpans.forEach(span => {
    if (!annotatorSpans[span.user]) {
      annotatorSpans[span.user] = [];
    }
    annotatorSpans[span.user].push({
      start: span.start,
      end: span.end,
      label: span.label
    });
  });

  const annotators = Object.keys(annotatorSpans);
  if (annotators.length < 2) {
    return { precision: 0, recall: 0, f1Score: 0 };
  }

  // Calculate pairwise F1 scores between all annotators
  let totalPrecision = 0;
  let totalRecall = 0;
  let comparisons = 0;

  for (let i = 0; i < annotators.length; i++) {
    for (let j = i + 1; j < annotators.length; j++) {
      const annotator1 = annotators[i];
      const annotator2 = annotators[j];
      
      const spans1 = annotatorSpans[annotator1];
      const spans2 = annotatorSpans[annotator2];
      
      // Calculate overlap metrics
      const { precision, recall } = calculatePairwiseMetrics(spans1, spans2);
      
      totalPrecision += precision;
      totalRecall += recall;
      comparisons++;
    }
  }

  if (comparisons === 0) {
    return { precision: 0, recall: 0, f1Score: 0 };
  }

  // Average across all pairwise comparisons
  const avgPrecision = totalPrecision / comparisons;
  const avgRecall = totalRecall / comparisons;
  
  // Calculate F1 score
  const f1Score = (avgPrecision + avgRecall > 0) ? 
    (2 * avgPrecision * avgRecall) / (avgPrecision + avgRecall) : 0;

  return {
    precision: Math.round(avgPrecision * 100),
    recall: Math.round(avgRecall * 100),
    f1Score: Math.round(f1Score * 100)
  };
}

function calculateJaccardMetrics(annSpans, allUsers) {
  if (annSpans.length === 0 || allUsers.size < 2) {
    return { jaccard: 0 };
  }

  // Group spans by annotator
  const annotatorSpans = {};
  annSpans.forEach(span => {
    if (!annotatorSpans[span.user]) {
      annotatorSpans[span.user] = [];
    }
    annotatorSpans[span.user].push({
      start: span.start,
      end: span.end,
      label: span.label
    });
  });

  const annotators = Object.keys(annotatorSpans);
  if (annotators.length < 2) {
    return { jaccard: 0 };
  }

  let totalJaccard = 0;
  let comparisons = 0;

  for (let i = 0; i < annotators.length; i++) {
    for (let j = i + 1; j < annotators.length; j++) {
      const spans1 = annotatorSpans[annotators[i]];
      const spans2 = annotatorSpans[annotators[j]];

      // Treat spans as sets of [start,end,label] keys
      const set1 = new Set(spans1.map(s => `${s.start}-${s.end}-${s.label}`));
      const set2 = new Set(spans2.map(s => `${s.start}-${s.end}-${s.label}`));

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const jaccard = union.size > 0 ? intersection.size / union.size : 0;

      totalJaccard += jaccard;
      comparisons++;
    }
  }

  const avgJaccard = comparisons > 0 ? totalJaccard / comparisons : 0;
  return { jaccard: Math.round(avgJaccard * 100) };
}

function calculatePairwiseMetrics(spans1, spans2) {
  if (spans1.length === 0 && spans2.length === 0) {
    return { precision: 1, recall: 1 };
  }
  
  if (spans1.length === 0 || spans2.length === 0) {
    return { precision: 0, recall: 0 };
  }

  // Find overlapping spans (considering both position and label)
  let truePositives = 0;
  let processedSpans2 = new Set();

  spans1.forEach(span1 => {
    for (let i = 0; i < spans2.length; i++) {
      if (processedSpans2.has(i)) continue;
      
      const span2 = spans2[i];
      
      // Check for overlap and same label
      if (spansOverlap(span1, span2) && span1.label === span2.label) {
        truePositives++;
        processedSpans2.add(i);
        break;
      }
    }
  });

  // Precision: TP / (TP + FP) = TP / total_spans1
  const precision = spans1.length > 0 ? truePositives / spans1.length : 0;
  
  // Recall: TP / (TP + FN) = TP / total_spans2  
  const recall = spans2.length > 0 ? truePositives / spans2.length : 0;

  return { precision, recall };
}

function spansOverlap(span1, span2) {
  const start1 = span1.start;
  const end1 = span1.end;
  const start2 = span2.start;
  const end2 = span2.end;

  // Calculate overlap
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  
  if (overlapStart >= overlapEnd) {
    return false; // No overlap
  }

  return true;
}

function processTask(task) {
  const container = document.getElementById('policyContainer');
  if (!container) {
    console.error('Policy container not found');
    return;
  }
  
  container.innerHTML = '';

  const rawHTML = (task.data && task.data.text) ? task.data.text : (task.file_upload || '');
  const bodyHTML = parseHTMLBody(rawHTML);
  container.innerHTML = bodyHTML;

  const annSpans = [];
  const allUsers = new Set();
  
  (task.annotations || []).forEach(annObj => {
    const userEmail = annObj.completed_by?.email || annObj.completed_by || 'Unknown';
    allUsers.add(userEmail);
    (annObj.result || []).forEach(r => {
      if (r.value && r.value.globalOffsets) {
        annSpans.push({
          start: Number(r.value.globalOffsets.start),
          end: Number(r.value.globalOffsets.end),
          user: userEmail,
          label: Array.isArray(r.value.labels) ? r.value.labels[0] : (r.value.labels || null),
          text: r.value.text || ''
        });
      }
    });
  });

  if (annSpans.length === 0) {
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.innerText = 'No annotation spans found.';
    }
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
      const {className, details} = computeColorAndDetails(seg.covering, allUsers);
      const frag=range.extractContents();
      const span=document.createElement('span');
      span.className='highlight '+(className||'');
      span.dataset.details=details;
      span.appendChild(frag);
      range.insertNode(span);
    } catch(e){console.warn('wrap failed',seg,e);}
  });

  // Add event listeners for hover details
  const detailsEl = document.getElementById('details');
  if (detailsEl) {
    container.querySelectorAll('.highlight').forEach(el=>{
      el.addEventListener('mouseenter',()=>{
        detailsEl.innerHTML = el.dataset.details || 'No labels';
      });
      el.addEventListener('mouseleave',()=>{
        detailsEl.innerHTML = 'Hover over highlighted text to see annotation details';
      });
    });
  }
  
  // Calculate and display statistics
  const grouped = {};
  annSpans.forEach(a => {
    const k = `${a.start}-${a.end}`;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(a);
  });
  const fullAgree = Object.values(grouped).filter(list => {
    const labels = [...new Set(list.map(x => x.label))];
    const users = [...new Set(list.map(x => x.user))];
    return labels.length === 1 && users.length > 1;
  }).length;

  // Update basic stats
  updateStatsDisplay(Object.keys(grouped).length, fullAgree, allUsers.size);

  // F1 Score
  const f1Metrics = calculateF1Metrics(annSpans, allUsers);
  const f1ScoreEl = document.getElementById('f1Score');
  if (f1ScoreEl) f1ScoreEl.textContent = f1Metrics.f1Score + "%";

  // Jaccard score
  const jaccardMetrics = calculateJaccardMetrics(annSpans, allUsers);
  const jaccardScoreEl = document.getElementById('jaccardScore');
  if (jaccardScoreEl) jaccardScoreEl.textContent = jaccardMetrics.jaccard + "%";

  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = 'Analysis complete. Stats updated below.';
  }
}

// Management Functions
function exportPolicyData() {
  if (!policyName) {
    showNotification('No policy selected for export', 'error');
    return;
  }
  
  try {
    // Try to use the main dashboard export functionality
    if (window.opener && window.opener.exportPolicyData) {
      window.opener.exportPolicyData(policyName);
    } else if (window.parent && window.parent.exportPolicyData) {
      window.parent.exportPolicyData(policyName);
    } else {
      // Fallback: direct API call
      window.open(`${API_BASE}/policy-file/${encodeURIComponent(policyName)}/export`, '_blank');
    }
    showNotification('Export initiated successfully', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Failed to export policy data', 'error');
  }
}

function deleteCurrentPolicy() {
  if (!policyName) {
    showNotification('No policy selected for deletion', 'error');
    return;
  }
  
  const confirmMessage = `Are you sure you want to delete the policy "${policyName}"?\n\nThis will permanently delete all annotations and files.\n\nThis action cannot be undone.`;
  
  if (confirm(confirmMessage)) {
    showNotification('Deleting policy...', 'info');
    
    fetch(`${API_BASE}/policies/${encodeURIComponent(policyName)}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete policy');
      }
      return response.json();
    })
    .then(data => {
      showNotification('Policy deleted successfully', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    })
    .catch(error => {
      console.error('Error deleting policy:', error);
      showNotification('Failed to delete policy: ' + error.message, 'error');
    });
  }
}

async function viewProjectFiles(policyName) {
  if (!policyName) {
    showNotification('No policy selected', 'error');
    return;
  }
  
  try {
    showNotification('Loading project files...', 'info');
    
    const response = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyName)}`);
    if (!response.ok) {
      throw new Error('Failed to load policy data');
    }
    
    const policyData = await response.json();
    showFilesModal(policyName, policyData);
    
  } catch (error) {
    console.error('Error viewing project files:', error);
    showNotification('Failed to load project files: ' + error.message, 'error');
  }
}

function showFilesModal(policyName, policyData) {
  const existingModal = document.getElementById('filesModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'filesModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  let filesHTML = '';
  let totalFiles = 0;
  
  if (policyData.contributors && Object.keys(policyData.contributors).length > 0) {
    Object.entries(policyData.contributors).forEach(([contributor, contributorData]) => {
      if (contributorData.uploads && contributorData.uploads.length > 0) {
        filesHTML += `
          <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #2d3748; display: flex; align-items: center; gap: 10px;">
              <span style="width: 30px; height: 30px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                ${contributor.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
              ${contributor}
            </h4>
        `;
        
        contributorData.uploads.forEach(upload => {
          totalFiles++;
          const uploadDate = new Date(upload.uploadedAt).toLocaleString();
          const fileSize = upload.fileSize ? formatFileSize(upload.fileSize) : 'Unknown size';
          
          filesHTML += `
            <div style="margin: 8px 0; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-weight: 600; color: #2d3748;">${upload.originalName || upload.filename}</div>
                <div style="font-size: 0.85em; color: #666; margin-top: 2px;">
                  📅 ${uploadDate} • 📊 ${upload.annotationCount || 0} annotations • 💾 ${fileSize}
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-left: 15px;">
                <button onclick="downloadProjectFile('${encodeURIComponent(policyName)}', '${encodeURIComponent(contributor)}', '${encodeURIComponent(upload.storedAs || upload.filename)}')" 
                        style="padding: 6px 12px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;"
                        title="Download file">
                  📥 Download
                </button>
                <button onclick="deleteProjectFile('${encodeURIComponent(policyName)}', '${encodeURIComponent(contributor)}', '${encodeURIComponent(upload.storedAs || upload.filename)}', '${encodeURIComponent(upload.originalName || upload.filename)}')" 
                        style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;"
                        title="Delete file">
                  🗑️ Delete
                </button>
              </div>
            </div>
          `;
        });
        
        filesHTML += '</div>';
      }
    });
  }
  
  if (totalFiles === 0) {
    filesHTML = '<p style="text-align: center; color: #666; font-style: italic; padding: 40px;">No files found for this policy.</p>';
  }
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 15px;
    width: 90%;
    max-width: 800px;
    max-height: 80%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;
  
  modalContent.innerHTML = `
    <div style="padding: 25px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h2 style="margin: 0; color: #2d3748;">Project Files</h2>
        <p style="margin: 5px 0 0 0; color: #666;">${policyName}</p>
      </div>
      <button onclick="closeFilesModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px;">&times;</button>
    </div>
    <div style="background: #f8f9fa; padding: 15px; border-bottom: 1px solid #e2e8f0;">
      <strong>Total Files:</strong> ${totalFiles} • 
      <strong>Contributors:</strong> ${Object.keys(policyData.contributors || {}).length} •
      <strong>Last Updated:</strong> ${new Date(policyData.lastUpdated || Date.now()).toLocaleDateString()}
    </div>
    <div style="flex: 1; overflow-y: auto; padding: 20px;">
      ${filesHTML}
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFilesModal();
    }
  });
}

function closeFilesModal() {
  const modal = document.getElementById('filesModal');
  if (modal) {
    modal.remove();
  }
}

async function deleteProjectFile(policyName, contributor, fileName, displayName) {
  const confirmMessage = `Are you sure you want to delete "${displayName}" uploaded by ${contributor}?\n\nThis action cannot be undone.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    showNotification('Deleting file...', 'info');
    
    const response = await fetch(`${API_BASE}/policies/${policyName}/contributors/${encodeURIComponent(contributor)}/files/${encodeURIComponent(fileName)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to delete file: ${errorData.error}`);
    }
    
    showNotification('File deleted successfully', 'success');
    
    await viewProjectFiles(decodeURIComponent(policyName));
    
    if (decodeURIComponent(policyName) === getCurrentPolicyName()) {
      await loadPolicyFromServer(decodeURIComponent(policyName));
    }
    
  } catch (error) {
    console.error('Error deleting file:', error);
    showNotification('Failed to delete file: ' + error.message, 'error');
  }
}

async function downloadProjectFile(policyName, contributor, fileName) {
  try {
    showNotification('Preparing download...', 'info');
    
    const response = await fetch(`${API_BASE}/policies/${policyName}/contributors/${encodeURIComponent(contributor)}/files/${encodeURIComponent(fileName)}/download`);
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = fileName;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Download started', 'success');
    
  } catch (error) {
    console.error('Error downloading file:', error);
    showNotification('Failed to download file: ' + error.message, 'error');
  }
}

function getCurrentPolicyName() {
  return policyName;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 1000;
    max-width: 400px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    animation: slideInRight 0.3s ease;
  `;
  
  if (type === 'error') {
    notification.style.background = 'linear-gradient(45deg, #e53e3e, #c53030)';
  } else if (type === 'success') {
    notification.style.background = 'linear-gradient(45deg, #48bb78, #38a169)';
  } else {
    notification.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }
  }, 4000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .loading {
    color: #667eea;
    font-style: italic;
  }
  
  .error {
    color: #e53e3e;
    font-weight: 600;
  }
  
  .highlight {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    transition: all 0.2s ease;
  }
  
  .highlight:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
  
  .highlight.green {
    background-color: rgba(72, 187, 120, 0.3);
    border: 1px solid rgba(72, 187, 120, 0.5);
  }
  
  .highlight.yellow {
    background-color: rgba(255, 193, 7, 0.3);
    border: 1px solid rgba(255, 193, 7, 0.5);
  }
  
  .highlight.red {
    background-color: rgba(229, 62, 62, 0.3);
    border: 1px solid rgba(229, 62, 62, 0.5);
  }
`;
document.head.appendChild(style);

// Global function exports for HTML onclick handlers
window.exportPolicyData = exportPolicyData;
window.deleteCurrentPolicy = deleteCurrentPolicy;
window.viewProjectFiles = viewProjectFiles;
window.showManualUpload = showManualUpload;
window.showNotification = showNotification;
window.closeFilesModal = closeFilesModal;
window.deleteProjectFile = deleteProjectFile;
window.downloadProjectFile = downloadProjectFile;