// Policy Management System for GKCCI Dashboard

/**
 * Policy Manager Class - Handles all policy-related operations
 */
class PolicyManager {
    constructor() {
        this.policies = this.loadPolicies();
        this.currentPolicy = null;
    }

    /**
     * Load policies from localStorage
     */
    loadPolicies() {
        const user = window.UserAuth?.getCurrentUser();
        if (!user) return [];
        
        const key = `gkcci_policies_${user.id}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Save policies to localStorage
     */
    savePolicies() {
        const user = window.UserAuth?.getCurrentUser();
        if (!user) return;
        
        const key = `gkcci_policies_${user.id}`;
        localStorage.setItem(key, JSON.stringify(this.policies));
    }

    /**
     * Create a new policy
     */
    createPolicy(policyData) {
        const newPolicy = {
            id: this.generatePolicyId(),
            title: policyData.title,
            company: policyData.company,
            jurisdiction: policyData.jurisdiction || 'Unknown',
            description: policyData.description || '',
            url: policyData.url || '',
            createdAt: new Date().toISOString(),
            createdBy: window.UserAuth?.getCurrentUser()?.id,
            annotations: [],
            annotators: [],
            stats: {
                totalAnnotations: 0,
                totalAnnotators: 0,
                avgAgreement: 0,
                completeness: 0
            }
        };

        this.policies.push(newPolicy);
        this.savePolicies();
        return newPolicy;
    }

    /**
     * Generate unique policy ID
     */
    generatePolicyId() {
        return 'policy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get all policies
     */
    getAllPolicies() {
        return this.policies;
    }

    /**
     * Get policy by ID
     */
    getPolicyById(policyId) {
        return this.policies.find(policy => policy.id === policyId);
    }

    /**
     * Add annotations to a policy
     */
    addAnnotationsToPolicy(policyId, annotations, annotatorInfo) {
        const policy = this.getPolicyById(policyId);
        if (!policy) return false;

        // Add annotator if not already present
        const existingAnnotator = policy.annotators.find(a => a.id === annotatorInfo.id);
        if (!existingAnnotator) {
            policy.annotators.push(annotatorInfo);
        }

        // Add annotations with policy reference
        const annotationsWithPolicy = annotations.map(ann => ({
            ...ann,
            policyId: policyId,
            uploadedAt: new Date().toISOString()
        }));

        policy.annotations = policy.annotations.concat(annotationsWithPolicy);
        this.updatePolicyStats(policy);
        this.savePolicies();
        return true;
    }

    /**
     * Update policy statistics
     */
    updatePolicyStats(policy) {
        const annotations = policy.annotations;
        const annotators = policy.annotators;

        policy.stats = {
            totalAnnotations: annotations.length,
            totalAnnotators: annotators.length,
            avgAgreement: this.calculateAverageAgreement(annotations),
            completeness: this.calculateCompleteness(annotations),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Calculate average agreement for a policy
     */
    calculateAverageAgreement(annotations) {
        if (annotations.length === 0) return 0;
        
        const confidenceSum = annotations.reduce((sum, ann) => {
            return sum + (parseFloat(ann.confidence) || 0);
        }, 0);
        
        return (confidenceSum / annotations.length).toFixed(1);
    }

    /**
     * Calculate annotation completeness
     */
    calculateCompleteness(annotations) {
        // Calculate based on GKCCI parameters coverage
        const gkcciParams = ['Sender', 'Subject', 'Information Type', 'Recipient', 'Aim', 'Condition', 'Modalities', 'Consequence'];
        const coveredParams = new Set(annotations.map(ann => ann.label));
        return ((coveredParams.size / gkcciParams.length) * 100).toFixed(0);
    }

    /**
     * Delete a policy
     */
    deletePolicy(policyId) {
        this.policies = this.policies.filter(policy => policy.id !== policyId);
        this.savePolicies();
    }

    /**
     * Update policy information
     */
    updatePolicy(policyId, updates) {
        const policy = this.getPolicyById(policyId);
        if (!policy) return false;

        Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
        this.savePolicies();
        return true;
    }

    /**
     * Get annotations for a specific policy
     */
    getPolicyAnnotations(policyId) {
        const policy = this.getPolicyById(policyId);
        return policy ? policy.annotations : [];
    }

    /**
     * Get aggregated statistics across all policies
     */
    getOverallStats() {
        const stats = {
            totalPolicies: this.policies.length,
            totalAnnotations: 0,
            totalAnnotators: new Set(),
            avgAgreement: 0
        };

        this.policies.forEach(policy => {
            stats.totalAnnotations += policy.stats.totalAnnotations;
            policy.annotators.forEach(annotator => {
                stats.totalAnnotators.add(annotator.id);
            });
        });

        // Calculate overall average agreement
        if (this.policies.length > 0) {
            const agreementSum = this.policies.reduce((sum, policy) => {
                return sum + parseFloat(policy.stats.avgAgreement || 0);
            }, 0);
            stats.avgAgreement = (agreementSum / this.policies.length).toFixed(1);
        }

        stats.totalAnnotators = stats.totalAnnotators.size;
        return stats;
    }
}

// Initialize policy manager
const policyManager = new PolicyManager();

/**
 * UI Management Functions
 */

// Current view state
let currentView = 'list'; // 'list' or 'detail'
let currentPolicyId = null;

/**
 * Show policy list view
 */
function showPolicyList() {
    currentView = 'list';
    currentPolicyId = null;
    
    document.getElementById('policyListView').classList.add('active');
    document.getElementById('policyDetailView').classList.remove('active');
    
    updateBreadcrumb();
    renderPolicyGrid();
    updateOverallStats();
}

/**
 * Show policy detail view
 */
function showPolicyDetail(policyId) {
    const policy = policyManager.getPolicyById(policyId);
    if (!policy) return;
    
    currentView = 'detail';
    currentPolicyId = policyId;
    
    document.getElementById('policyListView').classList.remove('active');
    document.getElementById('policyDetailView').classList.add('active');
    
    updateBreadcrumb(policy.title);
    renderPolicyDetail(policy);
}

/**
 * Update breadcrumb navigation
 */
function updateBreadcrumb(policyTitle = null) {
    const breadcrumb = document.getElementById('breadcrumb');
    
    if (policyTitle) {
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" onclick="showPolicyList()">📁 Policy Documents</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item active">📄 ${policyTitle}</span>
        `;
    } else {
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item active">📁 Policy Documents</span>
        `;
    }
}

/**
 * Render policy grid
 */
function renderPolicyGrid() {
    const policies = policyManager.getAllPolicies();
    const grid = document.getElementById('policyGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (policies.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    grid.innerHTML = policies.map(policy => `
        <div class="policy-card" onclick="showPolicyDetail('${policy.id}')">
            <div class="policy-card-header">
                <h3 class="policy-title">${policy.title}</h3>
                <div class="policy-status ${policy.stats.totalAnnotations > 0 ? 'active' : 'pending'}">
                    ${policy.stats.totalAnnotations > 0 ? '✅ Active' : '⏳ Pending'}
                </div>
            </div>
            <div class="policy-card-body">
                <div class="policy-company">${policy.company}</div>
                <div class="policy-jurisdiction">📍 ${policy.jurisdiction}</div>
                <div class="policy-description">${policy.description || 'No description provided'}</div>
                
                <div class="policy-stats-mini">
                    <div class="stat-mini">
                        <strong>${policy.stats.totalAnnotations}</strong>
                        <span>Annotations</span>
                    </div>
                    <div class="stat-mini">
                        <strong>${policy.stats.totalAnnotators}</strong>
                        <span>Annotators</span>
                    </div>
                    <div class="stat-mini">
                        <strong>${policy.stats.avgAgreement}%</strong>
                        <span>Agreement</span>
                    </div>
                </div>
            </div>
            <div class="policy-card-footer">
                <div class="policy-date">Created ${formatDate(policy.createdAt)}</div>
                <div class="policy-actions-mini">
                    <button class="mini-btn" onclick="event.stopPropagation(); uploadToPolicyModal('${policy.id}')" title="Upload annotations">📤</button>
                    <button class="mini-btn" onclick="event.stopPropagation(); exportPolicyData('${policy.id}')" title="Export data">📥</button>
                    <button class="mini-btn" onclick="event.stopPropagation(); deletePolicyConfirm('${policy.id}')" title="Delete policy">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Update overall statistics
 */
function updateOverallStats() {
    const stats = policyManager.getOverallStats();
    
    document.getElementById('totalPolicies').textContent = stats.totalPolicies;
    document.getElementById('totalAnnotations').textContent = stats.totalAnnotations.toLocaleString();
    document.getElementById('avgAgreement').textContent = stats.avgAgreement + '%';
    document.getElementById('activeAnnotators').textContent = stats.totalAnnotators;
}

/**
 * Render policy detail view
 */
function renderPolicyDetail(policy) {
    // Update policy header
    document.getElementById('policyTitle').textContent = policy.title;
    document.getElementById('policyCompany').textContent = policy.company;
    document.getElementById('policyJurisdiction').textContent = policy.jurisdiction;
    document.getElementById('policyCreated').textContent = formatDate(policy.createdAt);
    document.getElementById('policyAnnotators').textContent = policy.stats.totalAnnotators;
    
    // Update metrics
    document.getElementById('policyOverallAgreement').textContent = policy.stats.avgAgreement + '%';
    document.getElementById('policyKappa').textContent = calculateKappa(policy.annotations);
    document.getElementById('policyCompleteness').textContent = policy.stats.completeness + '%';
    
    // Render charts for this policy
    renderPolicyCharts(policy);
    
    // Render annotator grid
    renderAnnotatorGrid(policy);
    
    // Render comparison results
    renderComparisonResults(policy);
}

/**
 * Render charts for specific policy
 */
function renderPolicyCharts(policy) {
    const annotations = policy.annotations;
    
    // Update label distribution chart
    const labelCounts = {};
    annotations.forEach(ann => {
        labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
    });
    
    const policyLabelChart = document.getElementById('policyLabelChart');
    if (policyLabelChart && typeof Chart !== 'undefined') {
        const ctx = policyLabelChart.getContext('2d');
        
        // Destroy existing chart if it exists
        if (window.currentPolicyLabelChart) {
            window.currentPolicyLabelChart.destroy();
        }
        
        window.currentPolicyLabelChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(labelCounts),
                datasets: [{
                    data: Object.values(labelCounts),
                    backgroundColor: Object.keys(labelCounts).map(label => window.labelColors[label] || '#999999'),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    // Update consistency chart
    const monthlyData = {};
    annotations.forEach(ann => {
        const month = new Date(ann.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[month]) monthlyData[month] = [];
        monthlyData[month].push(parseFloat(ann.confidence));
    });
    
    const policyConsistencyChart = document.getElementById('policyConsistencyChart');
    if (policyConsistencyChart && typeof Chart !== 'undefined') {
        const ctx = policyConsistencyChart.getContext('2d');
        
        // Destroy existing chart if it exists
        if (window.currentPolicyConsistencyChart) {
            window.currentPolicyConsistencyChart.destroy();
        }
        
        const months = Object.keys(monthlyData).sort();
        const avgScores = months.map(month => {
            const scores = monthlyData[month];
            return scores.reduce((sum, score) => sum + score, 0) / scores.length;
        });
        
        window.currentPolicyConsistencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Agreement Score',
                    data: avgScores,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

/**
 * Render annotator grid for policy
 */
function renderAnnotatorGrid(policy) {
    const grid = document.getElementById('annotatorGrid');
    
    if (policy.annotators.length === 0) {
        grid.innerHTML = '<p class="no-data">No annotators have uploaded data for this policy yet.</p>';
        return;
    }
    
    grid.innerHTML = policy.annotators.map(annotator => {
        const annotatorAnnotations = policy.annotations.filter(ann => ann.studentId === annotator.name || ann.studentId === annotator.email);
        const labelCounts = {};
        annotatorAnnotations.forEach(ann => {
            labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
        });
        
        const avgConfidence = annotatorAnnotations.length > 0 ?
            annotatorAnnotations.reduce((sum, ann) => sum + parseFloat(ann.confidence), 0) / annotatorAnnotations.length : 0;
        
        return `
            <div class="annotator-card">
                <div class="annotator-header">
                    <div class="annotator-avatar">${annotator.name[0]}</div>
                    <div class="annotator-info">
                        <h4>${annotator.name}</h4>
                        <p>${annotator.university}</p>
                    </div>
                    <div class="annotator-score">${avgConfidence.toFixed(1)}%</div>
                </div>
                <div class="annotator-stats">
                    <div class="stat-item">
                        <strong>${annotatorAnnotations.length}</strong>
                        <span>Annotations</span>
                    </div>
                    <div class="stat-item">
                        <strong>${Object.keys(labelCounts).length}</strong>
                        <span>Parameters</span>
                    </div>
                    <div class="stat-item">
                        <strong>${annotator.totalLabels || 0}</strong>
                        <span>Total Labels</span>
                    </div>
                </div>
                <div class="annotator-labels">
                    ${Object.entries(labelCounts).slice(0, 3).map(([label, count]) => 
                        `<span class="label-tag" style="background-color: ${window.labelColors[label]}">${label}: ${count}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render comparison results
 */
function renderComparisonResults(policy) {
    const results = document.getElementById('comparisonResults');
    const annotations = policy.annotations;
    
    if (annotations.length === 0) {
        results.innerHTML = '<p class="no-data">No annotations available for comparison.</p>';
        return;
    }
    
    // Group annotations by text segment (if available) or by parameter
    const comparisonData = analyzeAnnotationAgreement(annotations);
    
    results.innerHTML = `
        <div class="comparison-summary">
            <h4>Agreement Analysis</h4>
            <p>Based on ${annotations.length} annotations from ${policy.annotators.length} annotators</p>
        </div>
        <div class="agreement-breakdown">
            ${Object.entries(comparisonData.parameterAgreement).map(([param, agreement]) => `
                <div class="agreement-item">
                    <span class="parameter-name">${param}</span>
                    <div class="agreement-bar">
                        <div class="agreement-fill" style="width: ${agreement}%; background-color: ${window.labelColors[param]}"></div>
                    </div>
                    <span class="agreement-score">${agreement.toFixed(1)}%</span>
                </div>
            `).join('')}
        </div>
        <div class="gold-standard-preview" id="goldStandardPreview">
            <!-- Gold standard results will appear here -->
        </div>
    `;
}

/**
 * Analyze annotation agreement for comparison
 */
function analyzeAnnotationAgreement(annotations) {
    const parameterAgreement = {};
    const parameterCounts = {};
    
    // Calculate agreement per parameter
    annotations.forEach(ann => {
        if (!parameterAgreement[ann.label]) {
            parameterAgreement[ann.label] = 0;
            parameterCounts[ann.label] = 0;
        }
        parameterAgreement[ann.label] += parseFloat(ann.confidence);
        parameterCounts[ann.label]++;
    });
    
    // Calculate averages
    Object.keys(parameterAgreement).forEach(param => {
        parameterAgreement[param] = parameterAgreement[param] / parameterCounts[param];
    });
    
    return { parameterAgreement, parameterCounts };
}

/**
 * Modal and Form Handlers
 */

/**
 * Show new policy modal
 */
function showNewPolicyModal() {
    document.getElementById('newPolicyModal').style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Clear form data
    if (modalId === 'newPolicyModal') {
        document.getElementById('policyNameInput').value = '';
        document.getElementById('companyInput').value = '';
        document.getElementById('jurisdictionInput').value = '';
        document.getElementById('policyDescription').value = '';
        document.getElementById('policyUrl').value = '';
    }
}

/**
 * Create new policy
 */
function createNewPolicy(event) {
    event.preventDefault();
    
    const policyData = {
        title: document.getElementById('policyNameInput').value,
        company: document.getElementById('companyInput').value,
        jurisdiction: document.getElementById('jurisdictionInput').value,
        description: document.getElementById('policyDescription').value,
        url: document.getElementById('policyUrl').value
    };
    
    try {
        const newPolicy = policyManager.createPolicy(policyData);
        closeModal('newPolicyModal');
        showSuccess(`Policy "${newPolicy.title}" created successfully!`);
        renderPolicyGrid();
        updateOverallStats();
        
        // Optionally switch to the new policy detail view
        setTimeout(() => {
            showPolicyDetail(newPolicy.id);
        }, 1000);
        
    } catch (error) {
        showError('Failed to create policy. Please try again.');
        console.error('Error creating policy:', error);
    }
}

/**
 * Upload to policy modal
 */
function uploadToPolicyModal(policyId = null) {
    currentPolicyId = policyId || currentPolicyId;
    document.getElementById('uploadToPolicyModal').style.display = 'flex';
}

/**
 * Handle file upload for policy
 */
function handlePolicyFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentPolicyId) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processPolicyAnnotations(data);
        } catch (error) {
            showError('Invalid JSON file. Please check your Label Studio export.');
        }
    };
    reader.readAsText(file);
}

/**
 * Process JSON paste for policy
 */
function processPolicyJSONPaste() {
    const jsonText = document.getElementById('policyJsonPaste').value.trim();
    if (!jsonText || !currentPolicyId) {
        showError('Please paste JSON data and ensure a policy is selected.');
        return;
    }
    
    try {
        const data = JSON.parse(jsonText);
        processPolicyAnnotations(data);
    } catch (error) {
        showError('Invalid JSON format. Please check your data.');
    }
}

/**
 * Process annotations for current policy
 */
function processPolicyAnnotations(data) {
    if (!currentPolicyId) {
        showError('No policy selected for upload.');
        return;
    }
    
    showLoading();
    
    // Use existing Label Studio processing logic
    try {
        const processedData = processLabelStudioDataForPolicy(data);
        
        if (processedData.annotations.length === 0) {
            showError('No valid annotations found in the uploaded data.');
            hideLoading();
            return;
        }
        
        // Get current user info
        const currentUser = window.UserAuth.getCurrentUser();
        const annotatorInfo = {
            id: currentUser.id,
            name: `${currentUser.firstName} ${currentUser.lastName}`,
            email: currentUser.email,
            university: currentUser.university,
            totalLabels: processedData.annotations.length
        };
        
        // Add annotations to policy
        const success = policyManager.addAnnotationsToPolicy(
            currentPolicyId, 
            processedData.annotations, 
            annotatorInfo
        );
        
        if (success) {
            closeModal('uploadToPolicyModal');
            showSuccess(`Successfully uploaded ${processedData.annotations.length} annotations!`);
            
            // Refresh current view
            if (currentView === 'detail') {
                const policy = policyManager.getPolicyById(currentPolicyId);
                renderPolicyDetail(policy);
            } else {
                renderPolicyGrid();
                updateOverallStats();
            }
        } else {
            showError('Failed to upload annotations to policy.');
        }
        
    } catch (error) {
        showError('Error processing annotations: ' + error.message);
        console.error('Error processing annotations:', error);
    }
    
    hideLoading();
}

/**
 * Export policy data
 */
function exportPolicyData(policyId = null) {
    const targetPolicyId = policyId || currentPolicyId;
    const policy = policyManager.getPolicyById(targetPolicyId);
    
    if (!policy) {
        showError('Policy not found.');
        return;
    }
    
    const exportData = {
        policy: {
            title: policy.title,
            company: policy.company,
            jurisdiction: policy.jurisdiction,
            description: policy.description,
            createdAt: policy.createdAt
        },
        statistics: policy.stats,
        annotators: policy.annotators,
        annotations: policy.annotations,
        exportedAt: new Date().toISOString(),
        exportedBy: window.UserAuth.getCurrentUser()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${policy.title.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Policy data exported successfully!');
}

/**
 * Delete policy confirmation
 */
function deletePolicyConfirm(policyId) {
    const policy = policyManager.getPolicyById(policyId);
    if (!policy) return;
    
    if (confirm(`Are you sure you want to delete "${policy.title}"? This action cannot be undone.`)) {
        policyManager.deletePolicy(policyId);
        showSuccess('Policy deleted successfully.');
        
        if (currentPolicyId === policyId) {
            showPolicyList();
        } else {
            renderPolicyGrid();
            updateOverallStats();
        }
    }
}

/**
 * Generate gold standard
 */
function generateGoldStandard() {
    if (!currentPolicyId) return;
    
    const policy = policyManager.getPolicyById(currentPolicyId);
    const annotations = policy.annotations;
    
    if (annotations.length === 0) {
        showError('No annotations available to generate gold standard.');
        return;
    }
    
    // Simple gold standard generation based on majority voting
    const goldStandard = generateGoldStandardFromAnnotations(annotations);
    
    const preview = document.getElementById('goldStandardPreview');
    preview.innerHTML = `
        <div class="gold-standard-results">
            <h4>🏆 Generated Gold Standard</h4>
            <p>Based on ${annotations.length} annotations from ${policy.annotators.length} annotators</p>
            <div class="gold-standard-list">
                ${goldStandard.map(item => `
                    <div class="gold-item">
                        <span class="gold-parameter" style="background-color: ${window.labelColors[item.parameter]}">${item.parameter}</span>
                        <span class="gold-confidence">Confidence: ${item.confidence}%</span>
                        <span class="gold-count">(${item.count} votes)</span>
                    </div>
                `).join('')}
            </div>
            <button class="primary-btn" onclick="exportGoldStandard()">Export Gold Standard</button>
        </div>
    `;
}

/**
 * Generate gold standard from annotations
 */
function generateGoldStandardFromAnnotations(annotations) {
    const parameterVotes = {};
    
    // Count votes for each parameter
    annotations.forEach(ann => {
        if (!parameterVotes[ann.label]) {
            parameterVotes[ann.label] = {
                votes: 0,
                totalConfidence: 0
            };
        }
        parameterVotes[ann.label].votes++;
        parameterVotes[ann.label].totalConfidence += parseFloat(ann.confidence);
    });
    
    // Generate gold standard
    const goldStandard = Object.entries(parameterVotes).map(([parameter, data]) => ({
        parameter,
        count: data.votes,
        confidence: (data.totalConfidence / data.votes).toFixed(1)
    }));
    
    // Sort by confidence and vote count
    goldStandard.sort((a, b) => (b.confidence * b.count) - (a.confidence * a.count));
    
    return goldStandard;
}

/**
 * Utility functions
 */

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Initialize policy management when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for authentication to be ready
    setTimeout(() => {
        if (window.UserAuth && window.UserAuth.isLoggedIn()) {
            showPolicyList();
        }
    }, 500);
});

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        const modalId = event.target.id;
        closeModal(modalId);
    }
});