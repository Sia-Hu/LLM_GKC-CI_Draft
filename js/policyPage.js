console.info('policyPage.js – resilient fetch v2');

// ---------- API base ----------
function detectAppRoot() {
  const m = location.pathname.match(/\/(LLM_GKC-CI_Draft|GKC-CI)(?=\/|$)/);
  return m ? m[0] : '';
}
const API_BASE = `${location.origin}${detectAppRoot()}/api`;

// ---------- Robust fetch with fallback on 403/404/405 & network errors ----------
async function apiFetch(path, init) {
  const pretty = `${API_BASE}${path}`;
  const fallback = `${API_BASE}/?route=${encodeURIComponent(path.replace(/^\//, ''))}`;
  try {
    let res = await fetch(pretty, init);
    if (res.ok) return res;
    if ([403, 404, 405].includes(res.status)) {
      res = await fetch(fallback, init);
      return res;
    }
    return res;
  } catch (e) {
    return fetch(fallback, init);
  }
}
async function apiJson(path, init) {
  const res = await apiFetch(path, init);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  return data ?? {};
}

// ---------- URL & boot ----------
const urlParams = new URLSearchParams(window.location.search);
const policyName = urlParams.get('policy') || '';

document.addEventListener('DOMContentLoaded', () => {
  if (policyName) {
    updatePageTitle(policyName);
    loadPolicyFromServer(policyName);
  }
  const fi = document.getElementById('fileInput');
  if (fi) fi.addEventListener('change', handleManualUpload);

  const link = document.getElementById('relationLink');
  if (link) link.addEventListener('click', openRelationModal);
});

window.policyName = policyName;

function updatePageTitle(name) {
  document.title = `Policy Analysis - ${name}`;
  const h = document.getElementById('pageTitle');
  if (h) h.textContent = `Policy Analysis: ${name}`;
}

// ---------- Load latest uploaded file for this policy ----------
let __lastTask = null;

async function loadPolicyFromServer(name) {
  try {
    showLoading('Loading policy data from server…');
    const all = await apiJson('/policies');                 // <- uses fallback if needed
    const policyData = all[name];
    if (!policyData) { showMessage('Policy not found on server.'); return; }

    const contributors = policyData.contributors || {};
    if (!Object.keys(contributors).length) {
      showMessage('No annotations for this policy yet. Upload below.'); return;
    }

    let latestFile = null, latestTime = 0;
    Object.values(contributors).forEach(c => {
      (c.uploads || []).forEach(u => {
        const when = new Date(u.uploadedAt || 0).getTime() || 0;
        const count = Number(u.annotationCount || 0);
        if (count > 0 && when >= latestTime) { latestFile = u; latestTime = when; }
      });
    });
    if (!latestFile) { showMessage('No annotation files found.'); return; }

    const stored = latestFile.storedAs || latestFile.filename || latestFile.name;
    const annotationData = await apiJson(`/policy-file/${encodeURIComponent(name)}/${encodeURIComponent(stored)}`);
    showServerDataInfo(policyData);

    __lastTask = Array.isArray(annotationData) ? annotationData[0] : annotationData;
    processTask(__lastTask); // your existing renderer
  } catch (err) {
    console.error('Load error:', err);
    showMessage('Could not load server data. You can upload a file manually below.');
    showManualUpload();
  }
}

// ---------- UI helpers ----------
function showServerDataInfo(policyData) {
  const infoDiv = document.getElementById('serverDataInfo');
  const dataSource = document.getElementById('dataSource');
  if (!infoDiv || !dataSource) return;
  const contributors = Object.keys(policyData.contributors || {}).join(', ') || '—';
  const lastUpdated = policyData.lastUpdated ? new Date(policyData.lastUpdated).toLocaleDateString() : '—';
  const totalAnnotations = policyData.totalAnnotations ?? 0;
  dataSource.innerHTML = `Contributors: ${contributors}<br>Last updated: ${lastUpdated}<br>Total annotations: ${totalAnnotations}`;
  infoDiv.style.display = 'block';
  const uploadSection = document.getElementById('fileUploadSection');
  if (uploadSection) uploadSection.style.display = 'none';
}
function showManualUpload() {
  const uploadSection = document.getElementById('fileUploadSection');
  if (uploadSection) uploadSection.style.display = 'block';
}
function showLoading(msg) {
  const s = document.getElementById('stats');
  const c = document.getElementById('policyContainer');
  if (s) s.innerHTML = `<span class="loading">${msg}</span>`;
  if (c) c.innerHTML = `<div class="loading">${msg}</div>`;
}
function showMessage(msg) {
  const s = document.getElementById('stats');
  const c = document.getElementById('policyContainer');
  if (s) s.textContent = msg;
  if (c) c.textContent = msg;
}

// ---------- Manual local file upload preview ----------
function handleManualUpload(event) {
  const f = event.target.files?.[0];
  if (!f) return;
  showLoading('Processing file…');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);
      __lastTask = Array.isArray(json) ? json[0] : json;
      const serverInfo = document.getElementById('serverDataInfo');
      if (serverInfo) serverInfo.style.display = 'none';
      processTask(__lastTask);
    } catch (err) {
      const s = document.getElementById('stats');
      const c = document.getElementById('policyContainer');
      if (s) s.innerHTML = `<span class="error">Failed to parse JSON: ${err.message}</span>`;
      if (c) c.innerHTML = `<div class="error">Invalid JSON file</div>`;
    }
  };
  reader.readAsText(f);
}

/* -----------------------------------------------------------------
   Everything below this line is your existing renderer/metrics code.
   (No functional changes needed; left as-is so highlights, F1/Jaccard,
   relations modal, etc., work exactly like before.)
------------------------------------------------------------------*/


// ---------- Normalization ----------
function buildNormalizedMap(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const normToDom = [];
  let normIndex = 0, lastWasSpace = false;
  const isSpace = ch => ch === '\u00A0' || /\s/.test(ch);

  function isHidden(node) {
    const el = node.parentElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag && ['STYLE', 'SCRIPT', 'NOSCRIPT'].includes(tag)) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    let p = el.parentElement;
    while (p) {
      const csp = getComputedStyle(p);
      if (csp.display === 'none' || p.getAttribute('aria-hidden') === 'true') return true;
      p = p.parentElement;
    }
    return false;
  }

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (isHidden(node)) continue;
    const text = node.nodeValue.replace(/\r/g, '').replace(/\n/g, ' ');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (isSpace(ch)) {
        if (!lastWasSpace) { normToDom[normIndex++] = { node, offset: i }; lastWasSpace = true; }
      } else {
        normToDom[normIndex++] = { node, offset: i }; lastWasSpace = false;
      }
    }
  }
  return normToDom;
}

function toRangeFromNorm(normToDom, start, end) {
  const s = normToDom[Math.max(0, Math.min(start, normToDom.length - 1))];
  const e = normToDom[Math.max(0, Math.min(end - 1, normToDom.length - 1))];
  if (!s || !e) return null;
  const r = document.createRange();
  r.setStart(s.node, s.offset);
  r.setEnd(e.node, e.offset + 1);
  return r;
}

// ---------- coloring & details ----------
function computeColorAndDetails(coveringAnns, allAnnotators) {
  if (!coveringAnns || coveringAnns.length === 0) return { className: null, details: '' };

  const labels = [...new Set(coveringAnns.map(a => a.label).filter(Boolean))];
  const users = [...new Set(coveringAnns.map(a => a.user))];
  const allUsers = [...allAnnotators];

  let className;
  if (labels.length === 1 && users.length === allUsers.length) className = 'green';
  else if (labels.length > 1) className = 'red';
  else className = 'yellow';

  const labelsToUsers = {};
  coveringAnns.forEach(ann => {
    if (!ann.label) return;
    if (!labelsToUsers[ann.label]) labelsToUsers[ann.label] = new Set();
    labelsToUsers[ann.label].add(ann.user);
  });

  const detailsArr = [];
  const processedUsers = new Set();

  Object.entries(labelsToUsers).forEach(([label, usersSet]) => {
    let section = `<b>${label}</b><br>`;
    section += [...usersSet].map(u => `&nbsp;&nbsp;- ${u}`).join('<br>');
    detailsArr.push(section);
    usersSet.forEach(u => processedUsers.add(u));
  });

  const notLabeled = allUsers.filter(u => !processedUsers.has(u));
  if (notLabeled.length > 0) {
    let section = `<b>Not labeled</b><br>`;
    section += notLabeled.map(u => `&nbsp;&nbsp;- ${u}`).join('<br>');
    detailsArr.push(section);
  }

  return { className, details: detailsArr.join('<br><br>') };
}

// ---------- metrics ----------
function updateStatsDisplay(distinctSpansCount, fullAgreements, totalAnnotators) {
  const a = document.getElementById('distinctSpans');
  const b = document.getElementById('fullAgreements');
  const c = document.getElementById('totalAnnotators');
  if (a) a.textContent = distinctSpansCount;
  if (b) b.textContent = fullAgreements;
  if (c) c.textContent = totalAnnotators;
}

function calculatePairwiseMetrics(spans1, spans2) {
  if (spans1.length === 0 && spans2.length === 0) return { precision: 1, recall: 1 };
  if (spans1.length === 0 || spans2.length === 0) return { precision: 0, recall: 0 };

  let tp = 0;
  const used2 = new Set();
  spans1.forEach(s1 => {
    for (let i = 0; i < spans2.length; i++) {
      if (used2.has(i)) continue;
      const s2 = spans2[i];
      if (spansOverlap(s1, s2) && s1.label === s2.label) { tp++; used2.add(i); break; }
    }
  });
  return { precision: tp / spans1.length, recall: tp / spans2.length };
}

function spansOverlap(a, b) {
  const os = Math.max(a.start, b.start);
  const oe = Math.min(a.end, b.end);
  return os < oe;
}

function calculateF1Metrics(annSpans, allUsers) {
  if (annSpans.length === 0 || allUsers.size < 2) return { precision: 0, recall: 0, f1Score: 0 };
  const annotatorSpans = {};
  annSpans.forEach(s => { (annotatorSpans[s.user] ||= []).push({ start: s.start, end: s.end, label: s.label }); });
  const annotators = Object.keys(annotatorSpans);
  if (annotators.length < 2) return { precision: 0, recall: 0, f1Score: 0 };

  let totalP = 0, totalR = 0, cmp = 0;
  for (let i = 0; i < annotators.length; i++) {
    for (let j = i + 1; j < annotators.length; j++) {
      const { precision, recall } = calculatePairwiseMetrics(annotatorSpans[annotators[i]], annotatorSpans[annotators[j]]);
      totalP += precision; totalR += recall; cmp++;
    }
  }
  if (!cmp) return { precision: 0, recall: 0, f1Score: 0 };
  const avgP = totalP / cmp, avgR = totalR / cmp;
  const f1 = (avgP + avgR > 0) ? (2 * avgP * avgR) / (avgP + avgR) : 0;
  return { precision: Math.round(avgP * 100), recall: Math.round(avgR * 100), f1Score: Math.round(f1 * 100) };
}

function calculateF1ByLabel(annSpans, allUsers) {
  const labelSet = new Set(annSpans.map(a => a.label).filter(Boolean));
  const results = [];
  const annotators = Array.from(allUsers);
  labelSet.forEach(label => {
    const spansLabel = annSpans.filter(a => a.label === label);
    const pairScores = [];
    for (let i = 0; i < annotators.length; i++) {
      for (let j = i + 1; j < annotators.length; j++) {
        const spansA = spansLabel.filter(s => s.user === annotators[i]);
        const spansB = spansLabel.filter(s => s.user === annotators[j]);
        if (spansA.length === 0 && spansB.length === 0) continue;
        const { precision, recall } = calculatePairwiseMetrics(spansA, spansB);
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        pairScores.push(f1);
      }
    }
    const avgF1 = pairScores.length ? Math.round((pairScores.reduce((a,b)=>a+b,0)/pairScores.length)*100) : 0;
    results.push({ label, f1: avgF1 });
  });
  return results;
}

function calculateJaccardMetrics(annSpans, allUsers) {
  if (annSpans.length === 0 || allUsers.size < 2) return { jaccard: 0 };
  const annotatorSpans = {};
  annSpans.forEach(s => { (annotatorSpans[s.user] ||= []).push({ start: s.start, end: s.end, label: s.label }); });
  const annotators = Object.keys(annotatorSpans);
  if (annotators.length < 2) return { jaccard: 0 };

  let total = 0, cmp = 0;
  for (let i = 0; i < annotators.length; i++) {
    for (let j = i + 1; j < annotators.length; j++) {
      const a = annotatorSpans[annotators[i]];
      const b = annotatorSpans[annotators[j]];
      const set1 = new Set(a.map(s => `${s.start}-${s.end}-${s.label}`));
      const set2 = new Set(b.map(s => `${s.start}-${s.end}-${s.label}`));
      const inter = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      const jacc = union.size > 0 ? inter.size / union.size : 0;
      total += jacc; cmp++;
    }
  }
  return { jaccard: Math.round((total / cmp) * 100) };
}

// ---------- main render ----------
function processTask(task) {
  const container = document.getElementById('policyContainer');
  if (!container) { console.error('Policy container not found'); return; }
  container.innerHTML = '';

  const rawHTML = task?.data?.text || task?.file_upload || '';
  container.innerHTML = rawHTML;

  const annSpans = [];
  const allUsers = new Set();

  (task.annotations || []).forEach(annObj => {
    const userEmail = annObj.completed_by?.email || annObj.completed_by || 'Unknown';
    allUsers.add(userEmail);
    (annObj.result || []).forEach(r => {
      if (r.value?.globalOffsets) {
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

  const statsEl = document.getElementById('stats');
  if (!annSpans.length) {
    if (statsEl) statsEl.innerText = 'No annotation spans found.';
    updateStatsDisplay(0, 0, 0);
    return;
  }

  // Build segments
  const totalLen = annSpans.reduce((m, s) => Math.max(m, s.end), 0);
  const breakSet = new Set([0, totalLen]);
  annSpans.forEach(s => { breakSet.add(s.start); breakSet.add(s.end); });
  const breaks = [...breakSet].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const s = breaks[i], e = breaks[i + 1];
    if (s === e) continue;
    const covering = annSpans.filter(a => a.start <= s && a.end >= e);
    if (covering.length > 0) {
      const { className, details } = computeColorAndDetails(covering, allUsers);
      segments.push({ start: s, end: e, covering, className, details });
    }
  }

  // index map
  const normToDom = buildNormalizedMap(container);

  // CSS Custom Highlight API
  const supportsHighlights = typeof CSS !== 'undefined' && CSS.highlights && typeof CSS.highlights.set === 'function';
  if (!document.getElementById('textColorHighlightStyles')) {
    const style = document.createElement('style');
    style.id = 'textColorHighlightStyles';
    style.textContent = `
      ::highlight(agree)    { color: #16a34a; background: transparent; }
      ::highlight(partial)  { color: #ca8a04; background: transparent; }
      ::highlight(conflict) { color: #dc2626; background: transparent; }
      ::highlight(hoverSeg) { text-decoration: underline; }
    `;
    document.head.appendChild(style);
  }

  if (supportsHighlights) {
    try { for (const k of CSS.highlights.keys()) CSS.highlights.delete(k); } catch {}
    const agree = [], partial = [], conflict = [];
    segments.forEach(seg => {
      const range = toRangeFromNorm(normToDom, seg.start, seg.end);
      if (!range) return;
      if (seg.className === 'green') agree.push(range);
      else if (seg.className === 'yellow') partial.push(range);
      else if (seg.className === 'red') conflict.push(range);
    });
    if (agree.length)   CSS.highlights.set('agree',   new Highlight(...agree));
    if (partial.length) CSS.highlights.set('partial', new Highlight(...partial));
    if (conflict.length)CSS.highlights.set('conflict',new Highlight(...conflict));
  } else {
    console.warn('CSS Custom Highlight API not supported; color display disabled.');
  }

  // Hover/lock
  const detailsEl = document.getElementById('details');
  const relationInfo = document.getElementById('relationInfo');
  let locked = false, lastKey = null, lockedSeg = null;

  function showSegmentDetails(seg) {
    if (!detailsEl) return;
    if (!seg) { detailsEl.innerHTML = ''; if (relationInfo) relationInfo.innerHTML = ''; return; }

    let html = seg.details || 'No labels';

    // Relation tuples for this segment (best-effort)
    try {
      const wordText = (container.textContent || '').substring(seg.start, seg.end).trim();
      const relationTuples = [];

      ( __lastTask?.annotations || [] ).forEach(annObj => {
        const userEmail = annObj.completed_by?.email || annObj.completed_by || 'Unknown';
        const nodes = []; const links = [];
        (annObj.result || []).forEach(r => {
          if (r.type === 'labels' && r.value?.labels) {
            nodes.push({
              id: r.id,
              text: r.value.text || '',
              label: Array.isArray(r.value.labels) ? r.value.labels[0] : r.value.labels
            });
          } else if (r.type === 'relation' && r.from_id && r.to_id) {
            links.push({ source: r.from_id, target: r.to_id });
          }
        });
        links.forEach(l => {
          const src = nodes.find(n => n.id === l.source);
          const tgt = nodes.find(n => n.id === l.target);
          if (src && tgt && (src.text.includes(wordText) || tgt.text.includes(wordText))) {
            relationTuples.push(`${userEmail}: (<b>${src.label || 'Label'} → ${tgt.label || 'Label'}</b>) – “${src.text}” → “${tgt.text}”`);
          }
        });
      });

      if (relationTuples.length > 0) {
        const relationHTML = relationTuples.map(t => `<div style="margin-bottom:4px;">${t}</div>`).join('');
        html += `<hr><b>Relations:</b><br>${relationHTML}`;
        if (relationInfo) relationInfo.innerHTML = relationHTML;
      } else if (relationInfo) {
        relationInfo.innerHTML = '';
      }
    } catch (e) {
      console.warn('Relation tuple extraction failed:', e);
    }

    detailsEl.innerHTML = html;
  }

  function caretToNormIndex(x, y) {
    let rng = null;
    if (document.caretRangeFromPoint) rng = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) { rng = document.createRange(); rng.setStart(pos.offsetNode, pos.offset); rng.collapse(true); }
    }
    if (!rng || !rng.startContainer) return null;
    const node = rng.startContainer;
    const offset = rng.startOffset;
    for (let i = 0; i < normToDom.length; i++) {
      const map = normToDom[i];
      if (map.node === node && map.offset >= offset) return i;
    }
    return null;
  }

  function segAtNormIndex(i) {
    return segments.find(s => i >= s.start && i < s.end) || null;
  }

  function setHover(seg) {
    if (!supportsHighlights) return;
    try { CSS.highlights.delete('hoverSeg'); } catch {}
    if (seg) {
      const r = toRangeFromNorm(normToDom, seg.start, seg.end);
      if (r) CSS.highlights.set('hoverSeg', new Highlight(r));
    }
  }

  container.style.cursor = 'text';

  container.addEventListener('mousemove', e => {
    if (locked) return;
    const idx = caretToNormIndex(e.clientX, e.clientY);
    const seg = segAtNormIndex(idx);
    const key = seg ? `${seg.start}-${seg.end}` : null;
    if (key === lastKey) return;
    lastKey = key;
    setHover(seg);
    showSegmentDetails(seg);
  });

  container.addEventListener('mouseleave', () => {
    if (locked) return;
    lastKey = null;
    setHover(null);
    showSegmentDetails(null);
  });

  container.addEventListener('click', e => {
    const idx = caretToNormIndex(e.clientX, e.clientY);
    const seg = segAtNormIndex(idx);
    if (locked && seg === lockedSeg) {
      locked = false; lockedSeg = null;
      if (detailsEl) detailsEl.classList.remove('locked');
      setHover(null); showSegmentDetails(null);
    } else {
      locked = true; lockedSeg = seg;
      if (detailsEl) detailsEl.classList.add('locked');
      setHover(seg); showSegmentDetails(seg);
    }
  });

  // Metrics & panels
  const grouped = {};
  annSpans.forEach(a => { (grouped[`${a.start}-${a.end}`] ||= []).push(a); });
  const fullAgree = Object.values(grouped).filter(list => {
    const labels = [...new Set(list.map(x => x.label))];
    const users = [...new Set(list.map(x => x.user))];
    return labels.length === 1 && users.length > 1;
  }).length;

  updateStatsDisplay(Object.keys(grouped).length, fullAgree, allUsers.size);

  const f1Metrics = calculateF1Metrics(annSpans, allUsers);
  const jaccardMetrics = calculateJaccardMetrics(annSpans, allUsers);
  const f1ByLabel = calculateF1ByLabel(annSpans, allUsers);

  const f1El = document.getElementById('f1Score');
  const jaccardEl = document.getElementById('jaccardScore');
  if (f1El) f1El.textContent = f1Metrics.f1Score + '%';
  if (jaccardEl) jaccardEl.textContent = jaccardMetrics.jaccard + '%';

  // Pairwise F1 by annotator
  const annotatorList = Array.from(allUsers);
  const pairwiseF1 = [];
  for (let i = 0; i < annotatorList.length; i++) {
    for (let j = i + 1; j < annotatorList.length; j++) {
      const userA = annotatorList[i];
      const userB = annotatorList[j];
      const spansA = annSpans.filter(s => s.user === userA);
      const spansB = annSpans.filter(s => s.user === userB);
      const { precision, recall } = calculatePairwiseMetrics(spansA, spansB);
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      pairwiseF1.push({ pair: `${userA} ↔ ${userB}`, f1: Math.round(f1 * 100) });
    }
  }

  const labelReportContainer = document.getElementById('labelReports');
  if (labelReportContainer) {
    const reports = generateLabelReports(annSpans, allUsers, __lastTask || task);
    labelReportContainer.innerHTML = `
      <h3>🧾 Label-Level Summary</h3>
      ${Object.values(reports).map(r => `
        <div class="label-report" style="border-bottom:1px solid #ccc; margin-bottom:15px; padding-bottom:10px;">
          <h4 style="margin-bottom:5px;">${r.label}</h4>
          <ul style="margin:0; padding-left:18px; line-height:1.5;">
            <li><b>Annotation Count:</b> ${r.count}</li>
            <li><b>Annotator Coverage:</b> ${r.coverage}%</li>
            <li><b>Average F1 (Agreement):</b> ${r.f1}%</li>
            <li><b>Distinct Segments:</b> ${r.distinctSpans}</li>
            <li><b>Span Overlap Rate:</b> ${r.overlapRate}%</li>
            <li><b>Common Disagreements:</b> ${
              r.commonDisagreements.map(d => `${d.label} (${d.count})`).join(', ') || 'None'
            }</li>
            <li><b>Annotator Precision/Recall:</b><br>
              ${Object.entries(r.perAnnotator)
                .map(([u, v]) => `&nbsp;&nbsp;${u}: P=${v.precision}%, R=${v.recall}%`)
                .join('<br>')}
            </li>
          </ul>
        </div>
      `).join('')}
    `;
  }

  const analysis = document.getElementById('analysisResults');
  if (analysis) analysis.style.display = 'block';

  const pairwiseContainer = document.getElementById('pairwiseF1');
  if (pairwiseContainer) {
    pairwiseContainer.innerHTML =
      '<h4>Pairwise F1 by Annotator</h4>' +
      pairwiseF1.map(p => `<div>${p.pair}: <b>${p.f1}%</b></div>`).join('');
  }

  const labelF1Container = document.getElementById('labelF1');
  if (labelF1Container) {
    labelF1Container.innerHTML =
      '<h4>F1 by Label Category</h4>' +
      f1ByLabel.map(l => `<div>${l.label}: <b>${l.f1}%</b></div>`).join('');
  }

  const colorCounts = { red: 0, yellow: 0, green: 0 };
  segments.forEach(s => { if (s.className && s.className in colorCounts) colorCounts[s.className]++; });
  const totalSegs = colorCounts.red + colorCounts.yellow + colorCounts.green;
  const pct = k => totalSegs ? ((colorCounts[k] / totalSegs) * 100).toFixed(1) + '%' : '0%';

  const mismatch = document.getElementById('mismatchDist');
  if (mismatch) {
    mismatch.innerHTML = `
      <h4>Color Distribution</h4>
      <div>🟢 Green (agreement): <b>${pct('green')}</b></div>
      <div>🟡 Yellow (partial): <b>${pct('yellow')}</b></div>
      <div>🔴 Red (conflict): <b>${pct('red')}</b></div>
    `;
  }

  if (statsEl) statsEl.innerHTML = 'Analysis complete. Stats updated below.';
}

// ---------- label-level reports ----------
function generateLabelReports(annSpans, allUsers, task) {
  const labelReports = {};
  const labels = [...new Set(annSpans.map(a => a.label).filter(Boolean))];
  const byLabel = {};
  labels.forEach(l => { byLabel[l] = annSpans.filter(a => a.label === l); });

  labels.forEach(label => {
    const spans = byLabel[label];
    if (!spans.length) return;

    const labelUsers = new Set(spans.map(s => s.user));
    const coverage = ((labelUsers.size / allUsers.size) * 100).toFixed(1);
    const count = spans.length;
    const f1 = calculateF1Metrics(spans, allUsers).f1Score;
    const distinctSpans = new Set(spans.map(s => `${s.start}-${s.end}`)).size;

    let overlapCount = 0, pairCount = 0;
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        if (spans[i].user !== spans[j].user) {
          pairCount++;
          if (spansOverlap(spans[i], spans[j])) overlapCount++;
        }
      }
    }
    const overlapRate = pairCount ? ((overlapCount / pairCount) * 100).toFixed(1) : 0;

    const overlapCounts = {};
    labels.forEach(other => {
      if (other === label) return;
      const otherSpans = byLabel[other] || [];
      let ov = 0;
      spans.forEach(s1 => otherSpans.forEach(s2 => { if (spansOverlap(s1, s2)) ov++; }));
      overlapCounts[other] = ov;
    });
    const commonDisagreements = Object.entries(overlapCounts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([l, c]) => ({ label: l, count: c }));

    const perAnnotator = {};
    allUsers.forEach(user => {
      const userSpans = spans.filter(s => s.user === user);
      const others = spans.filter(s => s.user !== user);
      const { precision, recall } = calculatePairwiseMetrics(userSpans, others);
      perAnnotator[user] = { precision: Math.round(precision * 100), recall: Math.round(recall * 100) };
    });

    labelReports[label] = { label, count, coverage, f1, distinctSpans, overlapRate, commonDisagreements, perAnnotator };
  });

  return labelReports;
}

// ---------- Relations modal (in-page) ----------
function openRelationModal() {
  if (!__lastTask || !(__lastTask.annotations || []).length) {
    showNotification('Load a policy JSON first to view relations.', 'error');
    return;
  }
  const modal = document.getElementById('relationModal');
  if (!modal) return;

  modal.style.display = 'flex';
  const firstAnn = __lastTask.annotations[0]; // show first annotator’s graph by default
  const containerId = 'networkGraph';
  const canvas = document.getElementById(containerId);
  if (canvas) canvas.innerHTML = '';

  if (typeof window.renderLabelRelations === 'function') {
    window.renderLabelRelations(firstAnn, containerId);
  } else {
    showNotification('Relation renderer not available.', 'error');
  }
}

function closeRelationModal() {
  const modal = document.getElementById('relationModal');
  if (modal) modal.style.display = 'none';
}
window.closeRelationModal = closeRelationModal;

// ---------- File management (modal, delete, download) ----------
async function viewProjectFiles(name) {
  if (!name) { showNotification('No policy selected', 'error'); return; }
  try {
    showNotification('Loading project files...', 'info');
    const res = await apiFetch('/policies');
    if (!res.ok) throw new Error('Failed to load policy data');
    const all = await res.json();
    const policyData = all[decodeURIComponent(name)];
    if (!policyData) throw new Error('Policy not found');
    showFilesModal(decodeURIComponent(name), policyData);
  } catch (e) {
    console.error('Error viewing project files:', e);
    showNotification('Failed to load project files: ' + e.message, 'error');
  }
}

function showFilesModal(name, policyData) {
  const existing = document.getElementById('filesModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'filesModal';
  modal.style.cssText = `
    position: fixed; top:0; left:0; width:100%; height:100%;
    background: rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:center; justify-content:center;
  `;

  let filesHTML = '';
  let totalFiles = 0;

  if (policyData.contributors && Object.keys(policyData.contributors).length > 0) {
    Object.entries(policyData.contributors).forEach(([contributor, cData]) => {
      if (cData.uploads && cData.uploads.length > 0) {
        filesHTML += `
          <div style="margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px;">
            <h4 style="margin:0 0 10px 0; color:#2d3748; display:flex; align-items:center; gap:10px;">
              <span style="width:30px; height:30px; background:#667eea; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">
                ${contributor.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
              ${contributor}
            </h4>
        `;
        cData.uploads.forEach(upload => {
          totalFiles++;
          const uploadDate = upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleString() : '—';
          const fileSize = upload.fileSize ? formatFileSize(upload.fileSize) : 'Unknown size';
          const stored = upload.storedAs || upload.filename || upload.name || '';
          const shown = upload.originalName || upload.filename || stored || 'file.json';

          filesHTML += `
            <div style="margin:8px 0; padding:10px; background:#fff; border-radius:6px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
              <div style="flex:1;">
                <div style="font-weight:600; color:#2d3748;">${shown}</div>
                <div style="font-size:0.85em; color:#666; margin-top:2px;">
                  📅 ${uploadDate} • 📊 ${upload.annotationCount || 0} annotations • 💾 ${fileSize}
                </div>
              </div>
              <div style="display:flex; gap:8px; margin-left:15px;">
                <button onclick="downloadProjectFile('${encodeURIComponent(name)}', '${encodeURIComponent(stored)}')"
                        style="padding:6px 12px; background:#4299e1; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.85em;" title="Download file">
                  📥 Download
                </button>
                <button onclick="deleteProjectFile('${encodeURIComponent(name)}', '${encodeURIComponent(stored)}', '${encodeURIComponent(shown)}')"
                        style="padding:6px 12px; background:#e53e3e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:0.85em;" title="Delete file">
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

  if (!totalFiles) {
    filesHTML = '<p style="text-align:center; color:#666; font-style:italic; padding:40px;">No files found for this policy.</p>';
  }

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background:#fff; border-radius:15px; width:90%; max-width:800px; max-height:80%;
    overflow:hidden; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.3);
  `;
  modalContent.innerHTML = `
    <div style="padding:25px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2 style="margin:0; color:#2d3748;">Project Files</h2>
        <p style="margin:5px 0 0 0; color:#666;">${name}</p>
      </div>
      <button onclick="closeFilesModal()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#666; padding:5px;">&times;</button>
    </div>
    <div style="background:#f8f9fa; padding:15px; border-bottom:1px solid #e2e8f0;">
      <strong>Total Files:</strong> ${totalFiles} • 
      <strong>Contributors:</strong> ${Object.keys(policyData.contributors || {}).length} •
      <strong>Last Updated:</strong> ${new Date(policyData.lastUpdated || Date.now()).toLocaleDateString()}
    </div>
    <div style="flex:1; overflow-y:auto; padding:20px;">${filesHTML}</div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) closeFilesModal(); });
}

function closeFilesModal() {
  const m = document.getElementById('filesModal');
  if (m) m.remove();
}

async function deleteProjectFile(name, fileName, displayName) {
  const disp = decodeURIComponent(displayName || fileName || 'this file');
  if (!confirm(`Are you sure you want to delete "${disp}"?\n\nThis action cannot be undone.`)) return;

  try {
    showNotification('Deleting file...', 'info');
    const res = await apiFetch(`/policies/${encodeURIComponent(name)}/files/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Delete failed');
    }
    showNotification('File deleted successfully', 'success');

    await viewProjectFiles(decodeURIComponent(name));
    if (decodeURIComponent(name) === policyName) await loadPolicyFromServer(decodeURIComponent(name));
  } catch (e) {
    console.error('Error deleting file:', e);
    showNotification('Failed to delete file: ' + e.message, 'error');
  }
}

async function downloadProjectFile(name, fileName) {
  try {
    showNotification('Preparing download...', 'info');
    const res = await apiFetch(`/policy-file/${encodeURIComponent(name)}/${encodeURIComponent(fileName)}`);
    if (!res.ok) throw new Error('Failed to download file');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = decodeURIComponent(fileName) || 'annotations.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Download started', 'success');
  } catch (e) {
    console.error('Error downloading file:', e);
    showNotification('Failed to download file: ' + e.message, 'error');
  }
}

// ---------- delete whole policy ----------
function deleteCurrentPolicy() {
  if (!policyName) { showNotification('No policy selected for deletion', 'error'); return; }
  if (!confirm(`Are you sure you want to delete the policy "${policyName}"?\n\nThis will permanently delete all annotations and files.\n\nThis action cannot be undone.`)) return;

  showNotification('Deleting policy...', 'info');

  apiFetch(`/policies/${encodeURIComponent(policyName)}`, { method: 'DELETE' })
    .then(r => { if (!r.ok) throw new Error('Failed to delete policy'); return r.json(); })
    .then(() => {
      showNotification('Policy deleted successfully', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    })
    .catch(err => {
      console.error('Error deleting policy:', err);
      showNotification('Failed to delete policy: ' + err.message, 'error');
    });
}

// ---------- misc ----------
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
  const n = document.createElement('div');
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 15px 20px; border-radius: 8px;
    color: #fff; font-weight: 600; z-index: 1000; max-width: 400px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2); animation: slideInRight 0.3s ease;
  `;
  n.style.background = type === 'error'
    ? 'linear-gradient(45deg, #e53e3e, #c53030)'
    : type === 'success'
      ? 'linear-gradient(45deg, #48bb78, #38a169)'
      : 'linear-gradient(45deg, #667eea, #764ba2)';
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => {
    if (!document.body.contains(n)) return;
    n.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => { if (document.body.contains(n)) document.body.removeChild(n); }, 300);
  }, 4000);
}

const animStyle = document.createElement('style');
animStyle.textContent = `
  @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  .loading { color: #667eea; font-style: italic; }
  .error { color: #e53e3e; font-weight: 600; }
`;
document.head.appendChild(animStyle);

// Expose for HTML
window.exportPolicyData  = function exportPolicyData() {
  if (!policyName) { showNotification('No policy selected for export', 'error'); return; }
  try {
    if (window.opener?.exportPolicyData) {
      window.opener.exportPolicyData(policyName);
    } else if (window.parent?.exportPolicyData) {
      window.parent.exportPolicyData(policyName);
    } else {
      window.open(`${API_BASE}/policy-file/${encodeURIComponent(policyName)}/export`, '_blank');
    }
    showNotification('Export initiated successfully', 'success');
  } catch (e) {
    console.error('Export error:', e);
    showNotification('Failed to export policy data', 'error');
  }
};
window.deleteCurrentPolicy = deleteCurrentPolicy;
window.viewProjectFiles    = viewProjectFiles;
window.showManualUpload    = showManualUpload;
window.showNotification    = showNotification;
window.closeFilesModal     = closeFilesModal;
