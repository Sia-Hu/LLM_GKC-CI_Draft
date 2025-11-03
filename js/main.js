
/* GKCCI Dashboard – resilient API calls with fallback to /api/?route=...  */
(function () {
  'use strict';

  // -------- App root & API base (unchanged behavior) --------
  const APP_ROOT = (() => {
    const m = location.pathname.match(/\/(LLM_GKC-CI_Draft|GKC-CI)(?=\/|$)/);
    return m ? m[0] : '';
  })();
  const API_BASE = `${location.origin}${APP_ROOT}/api`;

  // -------- Robust API fetch with automatic fallback --------
  async function apiFetch(path, init = {}) {
    const pretty = `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
    const fallback = `${API_BASE}/?route=${encodeURIComponent(path.replace(/^\//, ''))}`;

    try {
      let res = await fetch(pretty, init);
      if (res.ok) return res;
      if ([403, 404, 405].includes(res.status)) {
        // Try the querystring router when pretty routes are blocked
        res = await fetch(fallback, init);
        return res;
      }
      return res; // bubble 5xx etc. to caller
    } catch (e) {
      // Network problem → last resort: fallback
      return fetch(fallback, init);
    }
  }

  async function apiJson(path, init) {
    const res = await apiFetch(path, init);
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data ?? {};
  }

  // -------- Local state --------
  const appState = {
    policies: {},
    student: null,
    policyName: null,
    isLoading: false
  };

  // -------- Boot --------
  document.addEventListener('DOMContentLoaded', function () {
    console.log('GKCCI Dashboard initializing…');
    initializeApp();
  });

  async function initializeApp() {
    setupUserInterface();
    setupStudentForm();
    setupUploadHandlers();
    setupFilters();
    updateUploadSection();
    await loadPoliciesFromServer();
  }

  // -------- UI helpers --------
  function updateLoadingState(isLoading) {
    const el = document.getElementById('loadingIndicator');
    if (el) el.style.display = isLoading ? 'block' : 'none';
  }
  function showMessage(message, type = 'success') {
    const n = document.createElement('div');
    const bg = type === 'error'
      ? 'linear-gradient(45deg,#e53e3e,#c53030)'
      : 'linear-gradient(45deg,#48bb78,#38a169)';
    n.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:1000;color:#fff;
      padding:14px 18px;border-radius:8px;background:${bg};font-weight:700;
      box-shadow:0 5px 15px rgba(0,0,0,.2)
    `;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), type === 'error' ? 4000 : 3000);
  }
  function showStatus(message, icon) {
    const s = document.getElementById('uploadStatus');
    if (!s) return;
    s.querySelector('.status-icon').textContent = icon;
    s.querySelector('.status-text').textContent = message;
    s.style.display = 'block';
  }
  function hideStatus() {
    const s = document.getElementById('uploadStatus');
    if (s) s.style.display = 'none';
  }

  // -------- API: load policies & stats --------
  async function loadPoliciesFromServer() {
    try {
      appState.isLoading = true; updateLoadingState(true);
      const policies = await apiJson('/policies');
      appState.policies = policies || {};
      displayPolicyList();
      await updateProjectMetrics();
    } catch (e) {
      console.error('Failed to load policies:', e);
      showMessage(e.message || 'Failed to load policies', 'error');
    } finally {
      appState.isLoading = false; updateLoadingState(false);
    }
  }

  async function updateProjectMetrics() {
    try {
      const stats = await apiJson('/stats');
      const map = {
        totalPolicyFiles: stats.totalPolicies,
        totalContributors: stats.totalContributors,
        totalAnnotations: stats.totalAnnotations,
        avgAnnotationsPerPolicy: stats.avgAnnotationsPerPolicy,
        policyCount: stats.totalPolicies,
        studentCount: stats.totalContributors,
        annotationCount: stats.totalAnnotations
      };
      Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      });
      const ds = document.getElementById('dataSummary');
      if (ds && stats.totalPolicies > 0) ds.style.display = 'block';
    } catch (e) {
      console.error('Stats error:', e);
    }
  }

  // -------- Upload handling (POST /upload) --------
  function setupUploadHandlers() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    const area = document.querySelector('.upload-area');
    if (area) {
      area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
      area.addEventListener('dragleave', e => { e.preventDefault(); area.classList.remove('dragover'); });
      area.addEventListener('drop', e => {
        e.preventDefault(); area.classList.remove('dragover');
        const f = e.dataTransfer.files; if (f.length) {
          fileInput.files = f;
          handleFileUpload({ target: { files: f } });
        }
      });
    }
  }

  async function handleFileUpload(event) {
    if (!appState.student || !appState.policyName) {
      showMessage('Please enter your name and policy name first', 'error'); return;
    }
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.json')) { showMessage('Please select a JSON file', 'error'); return; }

    showStatus('Uploading file…', '📤');
    try {
      const form = new FormData();
      form.append('annotationFile', file);
      form.append('originalName', file.name);
      form.append('studentName', appState.student.name);
      form.append('studentEmail', appState.student.email || '');
      form.append('university', appState.student.university || '');
      form.append('policyName', appState.policyName);

      const res = await apiFetch('/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || 'Upload failed');

      showUploadSuccess(false, data.annotationCount || 0);
      await loadPoliciesFromServer();
      showStatus('File uploaded successfully!', '✅');
    } catch (e) {
      console.error('Upload error:', e);
      showStatus('Upload failed', '❌');
      showMessage(e.message || 'Upload failed', 'error');
    } finally {
      setTimeout(hideStatus, 2500);
      if (event && event.target) event.target.value = '';
    }
  }

  function showUploadSuccess(isNewPolicy, annotationCount) {
    const box = document.getElementById('uploadSuccess');
    const text = document.getElementById('uploadSuccessText');
    if (!box || !text) return;
    text.textContent = isNewPolicy
      ? `🎉 New annotation project "${appState.policyName}" created! Added ${annotationCount} annotations.`
      : `✅ Added ${annotationCount} annotations to "${appState.policyName}"`;
    box.style.display = 'block';
    setTimeout(() => (box.style.display = 'none'), 5000);
  }

  // -------- Student form & filters (unchanged behavior) --------
  function setupUserInterface() {
    document.getElementById('userName').textContent = 'Welcome!';
    document.getElementById('userRole').textContent = 'Select your details below';
    document.getElementById('userAvatar').textContent = '👤';
  }

  function setupStudentForm() {
    const name = document.getElementById('studentName');
    const email = document.getElementById('studentEmail');
    const uni = document.getElementById('university');
    const policy = document.getElementById('policyName');

    function update() {
      const nm = name?.value.trim();
      const em = email?.value.trim();
      const un = uni?.value;
      const pn = policy?.value.trim();

      if (nm && pn) {
        appState.student = { name: nm, email: em, university: un };
        appState.policyName = pn;
        document.getElementById('userName').textContent = nm;
        document.getElementById('userRole').textContent = `${un || 'Student'} - ${pn}`;
        document.getElementById('userAvatar').textContent =
          nm.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);

        const exists = appState.policies.hasOwnProperty(pn);
        document.getElementById('selectedText').textContent =
          exists ? `Ready to add annotations to existing policy: "${pn}"`
                 : `Ready to create new policy: "${pn}"`;
        document.getElementById('selectedInfo').style.display = 'block';
      } else {
        appState.student = null; appState.policyName = null;
        document.getElementById('selectedInfo').style.display = 'none';
        setupUserInterface();
      }
      updateUploadSection();
    }

    [name, email, uni, policy].forEach(el => el && (el.oninput = el.onchange = update));
  }

  function updateUploadSection() {
    const name = document.getElementById('studentName')?.value?.trim();
    const policy = document.getElementById('policyName')?.value?.trim();
    const university = document.getElementById('university')?.value;

    const hasReq = !!(name && policy);

    const nameCheck = document.getElementById('nameCheck');
    const policyCheck = document.getElementById('policyCheck');
    const universityCheck = document.getElementById('universityCheck');
    if (nameCheck) nameCheck.textContent = name ? '✅' : '❌';
    if (policyCheck) policyCheck.textContent = policy ? '✅' : '❌';
    if (universityCheck) universityCheck.textContent = university ? '✅' : '❓';

    const ph = document.getElementById('uploadPlaceholder');
    const ui = document.getElementById('uploadInterface');
    if (ph && ui) { ph.style.display = hasReq ? 'none' : 'block'; ui.style.display = hasReq ? 'block' : 'none'; }

    const btn = document.getElementById('enableUploadBtn');
    if (btn) {
      if (hasReq) {
        btn.textContent = 'Upload Interface Enabled ✅';
        btn.style.background = 'linear-gradient(45deg,#48bb78,#38a169)';
        btn.style.color = '#fff'; btn.disabled = false;
      } else {
        btn.textContent = 'Complete Information to Enable Upload';
        btn.style.background = '#ccc'; btn.style.color = '#666'; btn.disabled = true;
      }
    }
  }

  function setupFilters() {
    const s1 = document.getElementById('policySearch');
    const s2 = document.getElementById('policySearchMain');
    if (s1) s1.addEventListener('input', applyFilters);
    if (s2) s2.addEventListener('input', filterPolicyList);
  }
  function applyFilters() {
    const term = document.getElementById('policySearch')?.value.toLowerCase() || '';
    document.querySelectorAll('#policyListMain .policy-card').forEach(card => {
      const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
      card.style.display = title.includes(term) ? 'block' : 'none';
    });
  }
  function filterPolicyList() {
    const term = document.getElementById('policySearchMain')?.value.toLowerCase() || '';
    document.querySelectorAll('.policy-card').forEach(card => {
      const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
      card.style.display = title.includes(term) ? 'block' : 'none';
    });
  }

  // -------- Render policy cards (unchanged) --------
  function displayPolicyList() {
    loadExistingPolicies();
    if (Object.keys(appState.policies).length > 0) {
      const section = document.getElementById('policyTracking');
      if (section) section.style.display = 'block';
    }
  }

  function loadExistingPolicies() {
    const list = document.getElementById('policyListMain');
    const empty = document.getElementById('noPoliciesMessage');
    if (!list) return;

    const policies = Object.keys(appState.policies);
    if (policies.length === 0) {
      if (empty) empty.style.display = 'block';
      list.querySelectorAll('.policy-card').forEach(c => c.remove());
      return;
    }
    if (empty) empty.style.display = 'none';

    list.querySelectorAll('.policy-card').forEach(c => c.remove());

    let explorer = document.getElementById('projectExplorerLink');
    if (!explorer) {
      explorer = document.createElement('div');
      explorer.id = 'projectExplorerLink';
      explorer.style.cssText = `
        background:linear-gradient(45deg,#48bb78,#38a169);color:#fff;padding:15px 20px;border-radius:12px;
        margin-bottom:20px;text-align:center;cursor:pointer;transition:.3s;box-shadow:0 5px 15px rgba(72,187,120,.2);
      `;
      explorer.innerHTML = `<strong>🔍 View All Projects in Hierarchical Structure</strong><br>
                            <small style="opacity:.9;">Browse files organized by project folders</small>`;
      explorer.addEventListener('click', () => (window.location.href = 'projectExplorer.html'));
      explorer.addEventListener('mouseenter', () => {
        explorer.style.transform = 'translateY(-3px)';
        explorer.style.boxShadow = '0 10px 25px rgba(72,187,120,.3)';
      });
      explorer.addEventListener('mouseleave', () => {
        explorer.style.transform = 'translateY(0)';
        explorer.style.boxShadow = '0 5px 15px rgba(72,187,120,.2)';
      });
      list.appendChild(explorer);
    }

    const grid = document.createElement('div');
    grid.className = 'policy-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;';

    Object.entries(appState.policies).forEach(([name, data]) => {
      const c = Object.keys(data.contributors || {}).length;
      const a = data.totalAnnotations || 0;
      const d = new Date(data.lastUpdated || data.createdAt || Date.now()).toLocaleDateString();
      grid.appendChild(createCard(name, c, a, d));
    });
    list.appendChild(grid);
  }

  function createCard(policyName, contributorCount, annotationCount, lastUpdated) {
    const card = document.createElement('div');
    card.className = 'policy-card';
    card.style.cssText = `
      border:1px solid #e2e8f0;border-radius:15px;padding:25px;background:#fff;cursor:pointer;
      transition:.3s;box-shadow:0 5px 15px rgba(0,0,0,.08);position:relative;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px)';
      card.style.boxShadow = '0 20px 40px rgba(0,0,0,.15)';
      card.style.borderColor = '#667eea';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 5px 15px rgba(0,0,0,.08)';
      card.style.borderColor = '#e2e8f0';
    });
    card.addEventListener('click', e => {
      if (!e.target.closest('.card-actions') && !e.target.closest('.delete-checkbox')) {
        window.location.href = `policyPage.html?policy=${encodeURIComponent(policyName)}`;
      }
    });

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:15px;margin-bottom:20px;">
        <div style="width:50px;height:50px;background:linear-gradient(45deg,#667eea,#764ba2);
             border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2em;">📁</div>
        <div style="flex:1;">
          <h4 style="margin:0;color:#2d3748;font-size:1.2em;margin-bottom:5px;">${policyName}</h4>
          <p style="margin:0;color:#718096;font-size:.9em;">
            <span style="background:#e2e8f0;padding:2px 8px;border-radius:12px;font-size:.8em;margin-right:8px;">PROJECT</span>
            Last updated: ${lastUpdated}
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:15px;">
        <div style="text-align:center;padding:12px;background:#f8f9fa;border-radius:8px;">
          <strong style="display:block;color:#667eea;font-size:1.3em;">${contributorCount}</strong>
          <span style="font-size:.8em;color:#666;">Contributors</span>
        </div>
        <div style="text-align:center;padding:12px;background:#f8f9fa;border-radius:8px;">
          <strong style="display:block;color:#48bb78;font-size:1.3em;">${annotationCount}</strong>
          <span style="font-size:.8em;color:#666;">Annotations</span>
        </div>
        <div style="text-align:center;padding:12px;background:#f8f9fa;border-radius:8px;">
          <strong style="display:block;color:#f093fb;font-size:1.3em;">${Math.round(annotationCount / contributorCount) || 0}</strong>
          <span style="font-size:.8em;color:#666;">Avg/Person</span>
        </div>
      </div>
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid #e2e8f0;">
        <div class="card-actions" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <span style="color:#667eea;font-size:.9em;font-weight:600;">Click to view analysis →</span>
          <div style="display:flex;gap:8px;">
            <button onclick="event.stopPropagation(); viewProjectFiles('${encodeURIComponent(policyName)}')"
                    style="padding:6px 12px;background:#48bb78;color:#fff;border:none;border-radius:5px;font-size:.8em;cursor:pointer;">📁 Files</button>
            <button onclick="event.stopPropagation(); window.location.href='policyManagement.html?policy=${encodeURIComponent(policyName)}'"
                    style="padding:6px 12px;background:#f093fb;color:#fff;border:none;border-radius:5px;font-size:.8em;cursor:pointer;">Manage</button>
            <button onclick="event.stopPropagation(); deleteProject('${encodeURIComponent(policyName)}')"
                    style="padding:6px 12px;background:#e53e3e;color:#fff;border:none;border-radius:5px;font-size:.8em;cursor:pointer;">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `;
    return card;
  }

  // -------- File/Project actions (now using apiFetch) --------
  window.viewProjectFiles = async function (policyName) {
    try {
      const data = await apiJson(`/policies/${encodeURIComponent(policyName)}/files`);
      showProjectFilesModal(decodeURIComponent(policyName), data);
    } catch (e) {
      showMessage(`Failed to load project files: ${e.message}`, 'error');
    }
  };

  function showProjectFilesModal(policyName, fileData) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;
    `;
    const content = document.createElement('div');
    content.style.cssText = `
      background:#fff;border-radius:15px;padding:30px;max-width:800px;max-height:80vh;overflow:auto;margin:20px;
      box-shadow:0 20px 40px rgba(0,0,0,.3);
    `;
    const filesHTML = (fileData.files || []).map(f => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #e2e8f0;background:#f8f9fa;margin-bottom:8px;border-radius:6px;">
        <div>
          <div style="font-weight:600;color:#333;">${f.name}</div>
          <div style="font-size:.85em;color:#666;">Size: ${(f.size/1024).toFixed(1)} KB • Created: ${new Date(f.created).toLocaleString()}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="downloadProjectFile('${encodeURIComponent(policyName)}','${encodeURIComponent(f.name)}')"
                  style="padding:6px 12px;background:#48bb78;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:.85em;">Download</button>
          <button onclick="deleteProjectFile('${encodeURIComponent(policyName)}','${encodeURIComponent(f.name)}')"
                  style="padding:6px 12px;background:#e53e3e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:.85em;">Delete</button>
        </div>
      </div>
    `).join('') || '<div style="text-align:center;color:#666;padding:40px;">No files found in this project</div>';

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;color:#2d3748;">Project Files: ${policyName}</h2>
        <button onclick="this.closest('.modal-backdrop').remove()"
                style="background:#e53e3e;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">Close</button>
      </div>
      <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;">
        <strong>Project Directory:</strong> <code>${fileData.directory}</code><br>
        <strong>Total Files:</strong> ${fileData.files?.length || 0}
      </div>
      ${filesHTML}
    `;
    modal.appendChild(content);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  window.deleteProject = async function (policyName) {
    const decoded = decodeURIComponent(policyName);
    const p = appState.policies[decoded];
    if (!p) { showMessage('Policy not found', 'error'); return; }

    const confirmMsg = `Delete "${decoded}"?\n\nThis removes all files & annotations. This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await apiFetch(`/policies/${policyName}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || 'Delete failed');
      }
      delete appState.policies[decoded];
      await loadPoliciesFromServer();
      showMessage(`Project "${decoded}" deleted`, 'success');
    } catch (e) {
      showMessage(e.message || 'Delete failed', 'error');
    }
  };

  window.deleteProjectFile = async function (policyName, fileName) {
    if (!confirm('Delete this file permanently?')) return;
    try {
      const res = await apiFetch(`/policies/${policyName}/files/${fileName}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || 'Delete failed');
      }
      await viewProjectFiles(decodeURIComponent(policyName));
      showMessage('File deleted', 'success');
    } catch (e) {
      showMessage(e.message || 'Delete failed', 'error');
    }
  };

  window.downloadProjectFile = async function (policyName, fileName) {
    try {
      const data = await apiJson(`/policy-file/${policyName}/${fileName}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = decodeURIComponent(fileName);
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showMessage('File downloaded', 'success');
    } catch (e) {
      showMessage(e.message || 'Download failed', 'error');
    }
  };

  // -------- Expose a few handlers the HTML expects --------
  window.updateUploadSection = updateUploadSection;
  window.applyFilters = applyFilters;
  window.filterPolicyList = filterPolicyList;
  window.loadPoliciesFromServer = loadPoliciesFromServer;
  window.showMessage = showMessage;
})();
