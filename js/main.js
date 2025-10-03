// Updated Main Application Logic - Server-Based Storage with Fixed Delete Functionality

(function() {
    'use strict';
    
    // API endpoints - adjust port based on your setup
    const API_BASE = window.location.port === '8000' ? 'http://localhost:8001/api' : '/api';
    const API_ENDPOINTS = {
        policies: `${API_BASE}/policies`,
        upload: `${API_BASE}/upload`,
        uploadJson: `${API_BASE}/upload-json`,
        stats: `${API_BASE}/stats`
    };
    
    // Local state (no longer using localStorage)
    const appState = {
        policies: {},
        student: null,
        policyName: null,
        isLoading: false
    };
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('GKCCI Dashboard initializing...');
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
    
    // API Helper Functions
    async function apiRequest(url, options = {}) {
        try {
            appState.isLoading = true;
            updateLoadingState(true);
            
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            showMessage(error.message || 'Server error occurred', 'error');
            throw error;
        } finally {
            appState.isLoading = false;
            updateLoadingState(false);
        }
    }
    
    async function uploadFile(formData) {
        try {
            const response = await fetch(API_ENDPOINTS.upload, {
                method: 'POST',
                body: formData // Don't set Content-Type for FormData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            
            return data;
        } catch (error) {
            console.error('Upload Error:', error);
            showMessage(error.message || 'Upload failed', 'error');
            throw error;
        }
    }
    
    async function loadPoliciesFromServer() {
        try {
            const policies = await apiRequest(API_ENDPOINTS.policies);
            appState.policies = policies;
            displayPolicyList();
            updateProjectMetrics();
        } catch (error) {
            console.error('Failed to load policies:', error);
            // Continue with empty state
        }
    }
    
    function updateLoadingState(isLoading) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = isLoading ? 'block' : 'none';
        }
    }
    
    function setupUserInterface() {
        document.getElementById('userName').textContent = 'Welcome!';
        document.getElementById('userRole').textContent = 'Select your details below';
        document.getElementById('userAvatar').textContent = '👤';
    }
    
    function setupStudentForm() {
        const nameInput = document.getElementById('studentName');
        const emailInput = document.getElementById('studentEmail');
        const universitySelect = document.getElementById('university');
        const policyInput = document.getElementById('policyName');
        
        function updateForm() {
            const name = nameInput?.value.trim();
            const email = emailInput?.value.trim();
            const university = universitySelect?.value;
            const policy = policyInput?.value.trim();
            
            if (name && policy) {
                appState.student = { name, email, university };
                appState.policyName = policy;
                
                document.getElementById('userName').textContent = name;
                document.getElementById('userRole').textContent = `${university || 'Student'} - ${policy}`;
                
                const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                document.getElementById('userAvatar').textContent = initials;
                
                const exists = appState.policies.hasOwnProperty(policy);
                const message = exists ? 
                    `Ready to add annotations to existing policy: "${policy}"` :
                    `Ready to create new policy: "${policy}"`;
                
                document.getElementById('selectedText').textContent = message;
                document.getElementById('selectedInfo').style.display = 'block';
            } else {
                appState.student = null;
                appState.policyName = null;
                document.getElementById('selectedInfo').style.display = 'none';
                
                document.getElementById('userName').textContent = 'Welcome!';
                document.getElementById('userRole').textContent = 'Select your details below';
                document.getElementById('userAvatar').textContent = '👤';
            }
            
            updateUploadSection();
        }
        
        [nameInput, emailInput, universitySelect, policyInput].forEach(element => {
            if (element) {
                element.addEventListener('input', updateForm);
                element.addEventListener('change', updateForm);
            }
        });
    }
    
    function updateUploadSection() {
        const name = document.getElementById('studentName')?.value?.trim() || '';
        const policy = document.getElementById('policyName')?.value?.trim() || '';
        const university = document.getElementById('university')?.value || '';
        
        // Update checklist indicators
        const nameCheck = document.getElementById('nameCheck');
        const policyCheck = document.getElementById('policyCheck');
        const universityCheck = document.getElementById('universityCheck');
        
        if (nameCheck) nameCheck.textContent = name ? '✅' : '❌';
        if (policyCheck) policyCheck.textContent = policy ? '✅' : '❌';
        if (universityCheck) universityCheck.textContent = university ? '✅' : '❓';
        
        const hasRequiredInfo = !!(name && policy);
        
        // Update upload interface visibility
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const uploadInterface = document.getElementById('uploadInterface');
        
        if (uploadPlaceholder && uploadInterface) {
            if (hasRequiredInfo) {
                uploadPlaceholder.style.display = 'none';
                uploadInterface.style.display = 'block';
            } else {
                uploadPlaceholder.style.display = 'block';
                uploadInterface.style.display = 'none';
            }
        }
        
        // Update enable button
        const enableBtn = document.getElementById('enableUploadBtn');
        if (enableBtn) {
            if (hasRequiredInfo) {
                enableBtn.textContent = 'Upload Interface Enabled ✅';
                enableBtn.style.background = 'linear-gradient(45deg, #48bb78, #38a169)';
                enableBtn.style.color = 'white';
                enableBtn.style.cursor = 'default';
                enableBtn.disabled = false;
            } else {
                enableBtn.textContent = 'Complete Information to Enable Upload';
                enableBtn.style.background = '#ccc';
                enableBtn.style.color = '#666';
                enableBtn.style.cursor = 'not-allowed';
                enableBtn.disabled = true;
            }
        }
    }
    
    function setupUploadHandlers() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileUpload);
        }
        
        // Drag and drop
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    handleFileUpload({ target: { files: files } });
                }
            });
        }
    }
    
    async function handleFileUpload(event) {
        if (!appState.student || !appState.policyName) {
            showMessage('Please enter your name and policy name first', 'error');
            return;
        }
        
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            showMessage('Please select a JSON file', 'error');
            return;
        }
        
        showStatus('Uploading file...', '📤');
        
        try {
            const formData = new FormData();
            formData.append('annotationFile', file);
            formData.append('studentName', appState.student.name);
            formData.append('studentEmail', appState.student.email || '');
            formData.append('university', appState.student.university || '');
            formData.append('policyName', appState.policyName);
            
            const result = await uploadFile(formData);
            
            
            showStatus('File uploaded successfully!', '✅');
            showUploadSuccess(result.isNewPolicy, result.annotationCount);
            
            // Reload policies from server
            await loadPoliciesFromServer();
            
            setTimeout(hideStatus, 3000);
        } catch (error) {
            showStatus('Upload failed', '❌');
            setTimeout(hideStatus, 3000);
        }
        event.target.value = "";
    }
    
    function showUploadSuccess(isNewPolicy, annotationCount) {
        const successDiv = document.getElementById('uploadSuccess');
        const successText = document.getElementById('uploadSuccessText');
        
        if (successDiv && successText) {
            const message = isNewPolicy ? 
                `🎉 New annotation project "${appState.policyName}" created! You're the first contributor. Added ${annotationCount} annotations.` :
                `✅ Your ${annotationCount} annotations have been added to project "${appState.policyName}"`;
            
            successText.textContent = message;
            successDiv.style.display = 'block';
            
            setTimeout(() => {
                if (successDiv) successDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    function displayPolicyList() {
        loadExistingPolicies(); // This handles the main display
        
        // Update the data summary if there are policies
        if (Object.keys(appState.policies).length > 0) {
            const section = document.getElementById('policyTracking');
            if (section) section.style.display = 'block';
        }
    }
    
    function loadExistingPolicies() {
        const policyListMain = document.getElementById('policyListMain');
        const noPoliciesMessage = document.getElementById('noPoliciesMessage');
        
        if (!policyListMain) return;
        
        const policies = Object.keys(appState.policies);
        
        if (policies.length === 0) {
            if (noPoliciesMessage) noPoliciesMessage.style.display = 'block';
            const existingCards = policyListMain.querySelectorAll('.policy-card');
            existingCards.forEach(card => card.remove());
            return;
        }
        
        if (noPoliciesMessage) noPoliciesMessage.style.display = 'none';
        
        // Clear existing cards
        const existingCards = policyListMain.querySelectorAll('.policy-card');
        existingCards.forEach(card => card.remove());
        
        // Add project explorer link if not already present
        let explorerLink = document.getElementById('projectExplorerLink');
        if (!explorerLink && policies.length > 0) {
            explorerLink = document.createElement('div');
            explorerLink.id = 'projectExplorerLink';
            explorerLink.style.cssText = `
                background: linear-gradient(45deg, #48bb78, #38a169);
                color: white;
                padding: 15px 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(72, 187, 120, 0.2);
            `;
            explorerLink.innerHTML = `
                <strong>🔍 View All Projects in Hierarchical Structure</strong><br>
                <small style="opacity: 0.9;">Browse files organized by project folders</small>
            `;
            explorerLink.addEventListener('click', () => {
                window.location.href = 'projectExplorer.html';
            });
            explorerLink.addEventListener('mouseenter', () => {
                explorerLink.style.transform = 'translateY(-3px)';
                explorerLink.style.boxShadow = '0 10px 25px rgba(72, 187, 120, 0.3)';
            });
            explorerLink.addEventListener('mouseleave', () => {
                explorerLink.style.transform = 'translateY(0)';
                explorerLink.style.boxShadow = '0 5px 15px rgba(72, 187, 120, 0.2)';
            });
            policyListMain.appendChild(explorerLink);
        }
        
        // Create grid container
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;';
        grid.className = 'policy-grid';
        
        Object.entries(appState.policies).forEach(([policyName, policyData]) => {
            const contributorCount = Object.keys(policyData.contributors).length;
            const totalAnnotations = policyData.totalAnnotations || 0;
            const lastUpdated = new Date(policyData.lastUpdated || policyData.createdAt).toLocaleDateString();
            
            const card = createClickablePolicyCard(policyName, contributorCount, totalAnnotations, lastUpdated);
            grid.appendChild(card);
        });
        
        policyListMain.appendChild(grid);
    }
    
    function createClickablePolicyCard(policyName, contributorCount, annotationCount, lastUpdated) {
        const card = document.createElement('div');
        card.className = 'policy-card';
        card.style.cssText = `
            border: 1px solid #e2e8f0;
            border-radius: 15px;
            padding: 25px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            position: relative;
        `;
        
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
            card.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
            card.style.borderColor = '#667eea';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.08)';
            card.style.borderColor = '#e2e8f0';
        });
        
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-actions') && !e.target.closest('.delete-checkbox')) {
                window.location.href = `policyPage.html?policy=${encodeURIComponent(policyName)}`;
            }
        });
        
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2em;">📁</div>
                <div style="flex: 1;">
                    <h4 style="margin: 0; color: #2d3748; font-size: 1.2em; margin-bottom: 5px;">${policyName}</h4>
                    <p style="margin: 0; color: #718096; font-size: 0.9em;">
                        <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 8px;">PROJECT</span>
                        Last updated: ${lastUpdated}
                    </p>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="display: block; color: #667eea; font-size: 1.3em;">${contributorCount}</strong>
                    <span style="font-size: 0.8em; color: #666;">Contributors</span>
                </div>
                <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="display: block; color: #48bb78; font-size: 1.3em;">${annotationCount}</strong>
                    <span style="font-size: 0.8em; color: #666;">Annotations</span>
                </div>
                <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="display: block; color: #f093fb; font-size: 1.3em;">${Math.round(annotationCount / contributorCount) || 0}</strong>
                    <span style="font-size: 0.8em; color: #666;">Avg/Person</span>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                <div class="card-actions" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <span style="color: #667eea; font-size: 0.9em; font-weight: 600;">Click to view analysis →</span>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="event.stopPropagation(); viewProjectFiles('${encodeURIComponent(policyName)}')" 
                                style="padding: 6px 12px; background: #48bb78; color: white; border: none; border-radius: 5px; font-size: 0.8em; cursor: pointer; display: flex; align-items: center; gap: 4px;" 
                                title="View project files">
                            📁 Files
                        </button>
                        <button onclick="event.stopPropagation(); window.location.href='policyManagement.html?policy=${encodeURIComponent(policyName)}'" 
                                style="padding: 6px 12px; background: #f093fb; color: white; border: none; border-radius: 5px; font-size: 0.8em; cursor: pointer;">
                            Manage
                        </button>
                        <button onclick="event.stopPropagation(); deleteProject('${encodeURIComponent(policyName)}')" 
                                style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 5px; font-size: 0.8em; cursor: pointer;" 
                                title="Delete entire project">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return card;
    }
    
    async function updateProjectMetrics() {
        try {
            const stats = await apiRequest(API_ENDPOINTS.stats);
            
            const elements = {
                'totalPolicyFiles': stats.totalPolicies,
                'totalContributors': stats.totalContributors,
                'totalAnnotations': stats.totalAnnotations,
                'avgAnnotationsPerPolicy': stats.avgAnnotationsPerPolicy,
                'policyCount': stats.totalPolicies,
                'studentCount': stats.totalContributors,
                'annotationCount': stats.totalAnnotations
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });
            
            // Show data summary if there's data
            const dataSummary = document.getElementById('dataSummary');
            if (dataSummary && stats.totalPolicies > 0) {
                dataSummary.style.display = 'block';
            }
        } catch (error) {
            console.error('Failed to update project metrics:', error);
        }
    }
    
    function setupFilters() {
        const searchInput = document.getElementById('policySearch');
        const mainSearchInput = document.getElementById('policySearchMain');
        
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        }
        
        if (mainSearchInput) {
            mainSearchInput.addEventListener('input', filterPolicyList);
        }
    }
    
    function applyFilters() {
        const searchTerm = document.getElementById('policySearch')?.value.toLowerCase() || '';
        const cards = document.querySelectorAll('#policyListMain .policy-card');
        
        cards.forEach(card => {
            const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
            const matches = title.includes(searchTerm);
            card.style.display = matches ? 'block' : 'none';
        });
    }
    
    function filterPolicyList() {
        const searchTerm = document.getElementById('policySearchMain')?.value.toLowerCase() || '';
        const cards = document.querySelectorAll('.policy-card');
        
        cards.forEach(card => {
            const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
            const matches = title.includes(searchTerm);
            card.style.display = matches ? 'block' : 'none';
        });
    }
    
    function showStatus(message, icon) {
        const status = document.getElementById('uploadStatus');
        if (status) {
            status.querySelector('.status-icon').textContent = icon;
            status.querySelector('.status-text').textContent = message;
            status.style.display = 'block';
        }
    }
    
    function hideStatus() {
        const status = document.getElementById('uploadStatus');
        if (status) status.style.display = 'none';
    }
    
    function showMessage(message, type) {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 
            'linear-gradient(45deg, #e53e3e, #c53030)' :
            'linear-gradient(45deg, #48bb78, #38a169)';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-weight: bold;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, type === 'error' ? 4000 : 3000);
    }
    
    // Fixed Delete Functions - Now properly defined as global functions
    window.deleteProject = async function(policyName) {
        const decodedPolicyName = decodeURIComponent(policyName);
        const policy = appState.policies[decodedPolicyName];
        
        if (!policy) {
            showMessage('Policy not found', 'error');
            return;
        }
        
        const contributorCount = Object.keys(policy.contributors).length;
        const totalAnnotations = policy.totalAnnotations || 0;
        
        const confirmMessage = `Are you sure you want to delete the entire project "${decodedPolicyName}"?\n\nThis will permanently delete:\n- ${contributorCount} contributors\n- ${totalAnnotations} annotations\n- All uploaded files\n\nThis action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/policies/${policyName}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Failed to delete project: ${errorData.error}`);
            }
            
            showMessage(`Project "${decodedPolicyName}" deleted successfully`, 'success');
            
            // Force clear the local cache first
            delete appState.policies[decodedPolicyName];

            
            // Force refresh from server
            await loadPoliciesFromServer();
            
            // Force re-render the policy list
            displayPolicyList();
            
            // Update metrics
            updateProjectMetrics();
            
            // Optional: Force page reload if above doesn't work
            // window.location.reload();
            
        } catch (error) {
            console.error('Error deleting project:', error);
            showMessage(`Failed to delete project: ${error.message}`, 'error');
        }
    };
    
    // Global functions for HTML onclick handlers
    window.confirmStudentInfo = function() {
        const name = document.getElementById('studentName')?.value.trim();
        const email = document.getElementById('studentEmail')?.value.trim();
        const university = document.getElementById('university')?.value;
        const policy = document.getElementById('policyName')?.value.trim();
        
        if (!name || !policy) {
            showMessage('Please enter your name and policy file name', 'error');
            return;
        }
        
        // Set app state
        appState.student = { name, email, university };
        appState.policyName = policy;
        
        // Update user info display
        document.getElementById('userName').textContent = name;
        document.getElementById('userRole').textContent = `${university || 'Student'} - ${policy}`;
        
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        document.getElementById('userAvatar').textContent = initials;
        
        // Check if policy exists
        const exists = appState.policies.hasOwnProperty(policy);
        const message = exists ? 
            `Ready to add annotations to existing policy: "${policy}"` :
            `Ready to create new policy: "${policy}"`;
        
        document.getElementById('selectedText').textContent = message;
        document.getElementById('selectedInfo').style.display = 'block';
        
        // Enable upload section
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.style.display = 'block';
        }
        
        // Disable the form
        document.getElementById('studentName').disabled = true;
        document.getElementById('studentEmail').disabled = true;
        document.getElementById('university').disabled = true;
        document.getElementById('policyName').disabled = true;
        
        // Update confirm button
        const confirmBtn = document.getElementById('confirmInfoBtn');
        if (confirmBtn) {
            confirmBtn.style.background = 'linear-gradient(45deg, #48bb78, #38a169)';
            confirmBtn.textContent = '✅ Information Confirmed - Upload Section Enabled';
            confirmBtn.disabled = true;
        }
        
        showMessage('Information confirmed! Upload section is now enabled below.', 'success');
        
        // Scroll to upload section
        setTimeout(() => {
            uploadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
    };
    
    window.editStudentInfo = function() {
        // Re-enable the form
        document.getElementById('studentName').disabled = false;
        document.getElementById('studentEmail').disabled = false;
        document.getElementById('university').disabled = false;
        document.getElementById('policyName').disabled = false;
        
        // Hide upload section
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        
        // Hide selected info
        document.getElementById('selectedInfo').style.display = 'none';
        
        // Reset confirm button
        const confirmBtn = document.getElementById('confirmInfoBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
            confirmBtn.textContent = 'Confirm Information & Enable Upload';
        }
        
        // Reset app state
        appState.student = null;
        appState.policyName = null;
        
        // Reset user display
        document.getElementById('userName').textContent = 'Welcome!';
        document.getElementById('userRole').textContent = 'Select your details below';
        document.getElementById('userAvatar').textContent = '👤';
    };
    
    window.processJSONPaste = async function() {
        if (!appState.student || !appState.policyName) {
            showMessage('Please enter your name and policy name first', 'error');
            return;
        }
        
        const jsonText = document.getElementById('jsonPaste')?.value.trim();
        if (!jsonText) {
            showMessage('Please paste JSON data first', 'error');
            return;
        }
        
        showStatus('Processing JSON...', '📤');
        
        try {
            const result = await apiRequest(API_ENDPOINTS.uploadJson, {
                method: 'POST',
                body: JSON.stringify({
                    studentName: appState.student.name,
                    studentEmail: appState.student.email || '',
                    university: appState.student.university || '',
                    policyName: appState.policyName,
                    jsonData: jsonText
                })
            });
            
            showUploadSuccess(result.isNewPolicy, result.annotationCount);
            document.getElementById('jsonPaste').value = '';
            showMessage('JSON processed successfully!', 'success');
            
            // Reload policies from server
            await loadPoliciesFromServer();
            
        } catch (error) {
            showMessage('Failed to process JSON data', 'error');
        } finally {
            hideStatus();
        }
    };
    
    window.refreshPolicyList = async function() {
        try {
            await loadPoliciesFromServer();
            showMessage('Policy list refreshed', 'success');
        } catch (error) {
            showMessage('Failed to refresh policy list', 'error');
        }
    };
    
    window.searchExistingPolicies = function() {
        const input = document.getElementById('policyName');
        const dropdown = document.getElementById('existingPolicies');
        const searchTerm = input?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            if (dropdown) dropdown.style.display = 'none';
            return;
        }
        
        const matches = Object.keys(appState.policies).filter(name => 
            name.toLowerCase().includes(searchTerm)
        );
        
        if (dropdown) {
            dropdown.innerHTML = '';
            
            if (matches.length > 0) {
                matches.forEach(policyName => {
                    const policyData = appState.policies[policyName];
                    const contributorCount = Object.keys(policyData.contributors).length;
                    const annotationCount = policyData.totalAnnotations || 0;
                    
                    const item = document.createElement('div');
                    item.style.cssText = 'padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s;';
                    item.innerHTML = `
                        <strong style="color: #333;">${policyName}</strong><br>
                        <small style="color: #666;">${contributorCount} contributor(s), ${annotationCount} annotations</small>
                    `;
                    item.addEventListener('mouseenter', () => {
                        item.style.backgroundColor = '#f8f9fa';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.backgroundColor = 'white';
                    });
                    item.addEventListener('click', () => {
                        input.value = policyName;
                        dropdown.style.display = 'none';
                        input.dispatchEvent(new Event('input'));
                    });
                    dropdown.appendChild(item);
                });
                dropdown.style.display = 'block';
            } else {
                const noMatchItem = document.createElement('div');
                noMatchItem.style.cssText = 'padding: 15px; text-align: center; color: #666; background: #f8f9fa;';
                noMatchItem.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <strong style="color: #333;">No existing policies found</strong>
                    </div>
                    <div style="margin-bottom: 10px; font-size: 0.9em;">
                        Create new policy: "<strong style="color: #667eea;">${input.value}</strong>"
                    </div>
                    <button onclick="acceptNewPolicy()" style="padding: 8px 16px; background: #48bb78; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em; font-weight: 600;">
                        Create This Policy
                    </button>
                `;
                dropdown.appendChild(noMatchItem);
                dropdown.style.display = 'block';
            }
        }
    };
    
    window.acceptNewPolicy = function() {
        const dropdown = document.getElementById('existingPolicies');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
        
        const policyInput = document.getElementById('policyName');
        if (policyInput) {
            policyInput.dispatchEvent(new Event('input'));
        }
        
        showMessage('New policy name accepted. Complete the form and click confirm.', 'success');
    };
    
    // Add click outside handler to close dropdown
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('existingPolicies');
        const policyInput = document.getElementById('policyName');
        
        if (dropdown && policyInput && 
            !dropdown.contains(event.target) && 
            !policyInput.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Global function for viewing project files
    window.viewProjectFiles = async function(policyName) {
        try {
            console.log(`Attempting to load files for policy: ${policyName}`);
            const response = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyName)}/files`);
            
            console.log(`Response status: ${response.status}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('API error response:', errorData);
                throw new Error(`Server error (${response.status}): ${errorData.error || 'Unknown error'}`);
            }
            
            const fileData = await response.json();
            console.log('File data received:', fileData);
            showProjectFilesModal(policyName, fileData);
            
        } catch (error) {
            console.error('Error loading project files:', error);
            showMessage(`Failed to load project files: ${error.message}`, 'error');
        }
    };
    
    function showProjectFilesModal(policyName, fileData) {
        // Create modal backdrop
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        `;
        
        const filesHTML = fileData.files.length > 0 ? 
            fileData.files.map(file => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e2e8f0; background: #f8f9fa; margin-bottom: 8px; border-radius: 6px;">
                    <div>
                        <div style="font-weight: 600; color: #333;">${file.name}</div>
                        <div style="font-size: 0.85em; color: #666;">
                            Size: ${(file.size / 1024).toFixed(1)} KB | 
                            Created: ${new Date(file.created).toLocaleString()}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="downloadProjectFile('${encodeURIComponent(policyName)}', '${encodeURIComponent(file.name)}')" 
                                style="padding: 6px 12px; background: #48bb78; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                            Download
                        </button>
                        <button onclick="deleteProjectFile('${encodeURIComponent(policyName)}', '${encodeURIComponent(file.name)}')" 
                                style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('') :
            '<div style="text-align: center; color: #666; padding: 40px;">No files found in this project</div>';
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #333;">Project Files: ${policyName}</h2>
                <button onclick="this.closest('.modal-backdrop').remove()" 
                        style="background: #e53e3e; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                    Close
                </button>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <strong>Project Directory:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${fileData.directory}</code><br>
                <strong>Total Files:</strong> ${fileData.files.length}
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${filesHTML}
            </div>
        `;
        
        modal.appendChild(modalContent);
        modal.className = 'modal-backdrop';
        document.body.appendChild(modal);
        
        // Close modal when clicking backdrop
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    window.deleteProject = async function(policyName) {
        const decodedPolicyName = decodeURIComponent(policyName);
        const policy = appState.policies[decodedPolicyName];
        
        if (!policy) {
            showMessage('Policy not found', 'error');
            return;
        }
        
        const contributorCount = Object.keys(policy.contributors).length;
        const totalAnnotations = policy.totalAnnotations || 0;
        
        const confirmMessage = `Are you sure you want to delete the entire project "${decodedPolicyName}"?\n\nThis will permanently delete:\n- ${contributorCount} contributors\n- ${totalAnnotations} annotations\n- All uploaded files\n\nThis action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/policies/${policyName}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Failed to delete project: ${errorData.error}`);
            }
            
            showMessage(`Project "${decodedPolicyName}" deleted successfully`, 'success');
            
            // Clear the specific policy from local state
            delete appState.policies[decodedPolicyName];
            
            // Immediately hide the policy card
            const policyCards = document.querySelectorAll('.policy-card');
            policyCards.forEach(card => {
                const cardTitle = card.querySelector('h4')?.textContent;
                if (cardTitle === decodedPolicyName) {
                    card.remove();
                }
            });
            
            // Force complete refresh after a brief delay
            setTimeout(async () => {
                await loadPoliciesFromServer();
                displayPolicyList();
                updateProjectMetrics();
            }, 500);
            
        } catch (error) {
            console.error('Error deleting project:', error);
            showMessage(`Failed to delete project: ${error.message}`, 'error');
        }
    };
    // Global function for downloading project files
    window.downloadProjectFile = async function(policyName, fileName) {
        try {
            const response = await fetch(`${API_BASE}/policy-file/${encodeURIComponent(policyName)}/${encodeURIComponent(fileName)}`);
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            
            const data = await response.json();
            
            // Create download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage('File downloaded successfully', 'success');
            
        } catch (error) {
            console.error('Error downloading file:', error);
            showMessage('Failed to download file', 'error');
        }
    };
    
    // Export functions to window for HTML onclick handlers
    window.handleFileUpload = handleFileUpload;
    window.updateUploadSection = updateUploadSection;
    window.filterPolicyList = filterPolicyList;
    window.applyFilters = applyFilters;
    window.loadPoliciesFromServer = loadPoliciesFromServer; // Export for bulk delete functionality
    window.showMessage = showMessage; // Export for bulk delete functionality
    
    window.sortPolicyList = function() {
        const sortBy = document.getElementById('sortPolicies')?.value;
        showMessage(`Sorted by ${sortBy}`, 'success');
    };
    
    window.fetchFromAPI = function() {
        showMessage('API functionality requires Label Studio connection details', 'error');
    };
    
})();