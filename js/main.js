// Main Application Logic for Privacy Policy Labeling Analysis Platform

/**
 * Global state management
 */
window.labelingData = {
    uploadedFiles: [],      // Store individual JSON files
    policies: {},           // Organize by policy name
    students: [],           // List of all students
    currentPolicy: null,    // Currently viewed policy
    hoverState: null        // Current hover information
};

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('GKCCI Privacy Policy Analysis Platform initializing...');
    
    // Check authentication first
    if (!checkAuthentication()) {
        return; // Will redirect to login
    }
    
    // Initialize user interface
    initializeUserInterface();
    
    // Initialize file upload functionality
    setupFileUpload();
    
    // Initialize policy browser
    initializePolicyBrowser();
    
    // Initialize interactive text viewer
    initializeTextViewer();
    
    // Initialize IoU calculator
    initializeIoUCalculator();
    
    // Initialize event listeners
    setupEventListeners();
    
    // Load user-specific data
    loadUserData();
    
    console.log('Platform initialization complete');
});

/**
 * Setup individual JSON file upload system
 */
function setupFileUpload() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleMultipleFileUpload(files);
        }
    });
    
    // File input change handler
    fileInput.addEventListener('change', function(e) {
        handleMultipleFileUpload(e.target.files);
    });
}

/**
 * Handle multiple JSON file uploads (one per student per policy)
 */
function handleMultipleFileUpload(files) {
    const jsonFiles = Array.from(files).filter(file => 
        file.name.toLowerCase().endsWith('.json')
    );
    
    if (jsonFiles.length === 0) {
        showError('Please upload JSON files exported from Label Studio');
        return;
    }
    
    let processedCount = 0;
    let successCount = 0;
    
    jsonFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // Parse filename for student and policy info
                const fileInfo = parseFileName(file.name);
                
                // Process Label Studio JSON format
                const processedData = processLabelStudioJSON(jsonData, fileInfo);
                
                if (processedData) {
                    // Store the uploaded file data
                    window.labelingData.uploadedFiles.push({
                        filename: file.name,
                        student: fileInfo.student,
                        policy: fileInfo.policy,
                        timestamp: new Date().toISOString(),
                        data: processedData
                    });
                    
                    // Organize data by policy
                    organizePolicyData(processedData, fileInfo);
                    
                    successCount++;
                }
                
            } catch (error) {
                console.error('Error parsing JSON file:', file.name, error);
                showError(`Error parsing ${file.name}: Invalid JSON format`);
            }
            
            processedCount++;
            
            // Update UI when all files are processed
            if (processedCount === jsonFiles.length) {
                updatePolicyBrowser();
                showUploadSummary(successCount, jsonFiles.length);
                saveUserData();
            }
        };
        
        reader.readAsText(file);
    });
}

/**
 * Parse filename to extract student and policy information
 * Expected format: [StudentName]_[PolicyName]_[Date].json
 */
function parseFileName(filename) {
    const parts = filename.replace('.json', '').split('_');
    
    return {
        student: parts[0] || 'Unknown',
        policy: parts[1] || 'Unknown Policy',
        date: parts[2] || new Date().toISOString().split('T')[0],
        original: filename
    };
}

/**
 * Process Label Studio JSON export format
 */
function processLabelStudioJSON(jsonData, fileInfo) {
    try {
        // Handle different Label Studio export formats
        const tasks = jsonData.tasks || jsonData || [];
        
        const processedAnnotations = [];
        
        tasks.forEach(task => {
            const taskData = task.data || task;
            const annotations = task.annotations || [];
            
            annotations.forEach(annotation => {
                const results = annotation.result || [];
                
                results.forEach(result => {
                    processedAnnotations.push({
                        taskId: task.id || Math.random(),
                        text: taskData.text || taskData.content || '',
                        student: fileInfo.student,
                        policy: fileInfo.policy,
                        label: extractLabelFromResult(result),
                        textRange: extractTextRangeFromResult(result, taskData.text),
                        confidence: result.value.confidence || 1.0,
                        timestamp: annotation.created_at || new Date().toISOString()
                    });
                });
            });
        });
        
        return processedAnnotations;
        
    } catch (error) {
        console.error('Error processing Label Studio JSON:', error);
        return null;
    }
}

/**
 * Extract label information from Label Studio result
 */
function extractLabelFromResult(result) {
    if (result.value.choices && result.value.choices.length > 0) {
        return result.value.choices[0];
    }
    
    if (result.value.text) {
        return result.value.text;
    }
    
    return result.value.label || 'Unknown';
}

/**
 * Extract text range information from Label Studio result
 */
function extractTextRangeFromResult(result, fullText) {
    if (result.value.start !== undefined && result.value.end !== undefined) {
        return {
            start: result.value.start,
            end: result.value.end,
            text: fullText ? fullText.substring(result.value.start, result.value.end) : ''
        };
    }
    
    return {
        start: 0,
        end: fullText ? fullText.length : 0,
        text: fullText || ''
    };
}

/**
 * Organize uploaded data by policy for easy access
 */
function organizePolicyData(annotations, fileInfo) {
    if (!window.labelingData.policies[fileInfo.policy]) {
        window.labelingData.policies[fileInfo.policy] = {
            name: fileInfo.policy,
            students: {},
            fullText: '',
            annotations: []
        };
    }
    
    const policy = window.labelingData.policies[fileInfo.policy];
    
    // Store student's annotations for this policy
    policy.students[fileInfo.student] = annotations;
    
    // Extract full text from first annotation
    if (annotations.length > 0 && !policy.fullText) {
        policy.fullText = annotations[0].text;
    }
    
    // Add all annotations to policy
    policy.annotations.push(...annotations);
    
    // Update students list
    if (!window.labelingData.students.includes(fileInfo.student)) {
        window.labelingData.students.push(fileInfo.student);
    }
}

/**
 * Initialize hierarchical policy browser
 */
function initializePolicyBrowser() {
    const browserContainer = document.getElementById('policyBrowser');
    if (!browserContainer) return;
    
    // Create browser structure
    browserContainer.innerHTML = `
        <div class="browser-header">
            <h3>Policy Browser</h3>
            <div class="browser-stats" id="browserStats"></div>
        </div>
        <div class="policy-tree" id="policyTree"></div>
    `;
}

/**
 * Update policy browser with current data
 */
function updatePolicyBrowser() {
    const policyTree = document.getElementById('policyTree');
    const browserStats = document.getElementById('browserStats');
    
    if (!policyTree) return;
    
    const policies = window.labelingData.policies;
    const policyNames = Object.keys(policies);
    
    // Update stats
    if (browserStats) {
        const totalPolicies = policyNames.length;
        const totalStudents = window.labelingData.students.length;
        const totalFiles = window.labelingData.uploadedFiles.length;
        
        browserStats.innerHTML = `
            ${totalPolicies} policies | ${totalStudents} students | ${totalFiles} files uploaded
        `;
    }
    
    // Build tree structure
    let treeHTML = '';
    
    policyNames.forEach(policyName => {
        const policy = policies[policyName];
        const studentNames = Object.keys(policy.students);
        const completionRate = (studentNames.length / window.labelingData.students.length * 100).toFixed(1);
        
        treeHTML += `
            <div class="policy-node">
                <div class="policy-header" onclick="togglePolicyNode('${policyName}')">
                    <span class="policy-icon">📄</span>
                    <span class="policy-name">${policyName}</span>
                    <span class="completion-badge">${completionRate}%</span>
                </div>
                <div class="student-list" id="students-${policyName}">
                    ${studentNames.map(studentName => `
                        <div class="student-item" onclick="openPolicyViewer('${policyName}', '${studentName}')">
                            <span class="student-icon">👤</span>
                            <span class="student-name">${studentName}</span>
                            <span class="annotation-count">${policy.students[studentName].length} labels</span>
                        </div>
                    `).join('')}
                    <div class="view-all-button" onclick="openPolicyViewer('${policyName}', 'all')">
                        <span class="view-icon">👁️</span>
                        View All Annotations
                    </div>
                </div>
            </div>
        `;
    });
    
    policyTree.innerHTML = treeHTML || '<div class="no-data">No policies uploaded yet</div>';
}

/**
 * Toggle policy node expansion
 */
function togglePolicyNode(policyName) {
    const studentList = document.getElementById(`students-${policyName}`);
    if (studentList) {
        studentList.style.display = studentList.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Open policy viewer for specific policy and student(s)
 */
function openPolicyViewer(policyName, studentName) {
    window.labelingData.currentPolicy = {
        name: policyName,
        student: studentName
    };
    
    const policy = window.labelingData.policies[policyName];
    if (!policy) return;
    
    // Show policy viewer container
    const viewerContainer = document.getElementById('policyViewer');
    if (viewerContainer) {
        viewerContainer.style.display = 'block';
        renderPolicyText(policy, studentName);
        updateIoUCalculator();
    }
    
    // Update UI to show current policy
    showPolicyViewerTab();
}

/**
 * Initialize interactive text viewer
 */
function initializeTextViewer() {
    const viewerContainer = document.getElementById('policyViewer');
    if (!viewerContainer) return;
    
    viewerContainer.innerHTML = `
        <div class="viewer-header">
            <h3 id="policyTitle">Policy Viewer</h3>
            <div class="viewer-controls">
                <select id="studentFilter" onchange="filterAnnotations()">
                    <option value="all">All Students</option>
                </select>
                <button onclick="closePolicyViewer()">Close</button>
            </div>
        </div>
        <div class="text-display" id="textDisplay">
            Select a policy from the browser to view annotations
        </div>
        <div class="hover-info" id="hoverInfo"></div>
    `;
}

/**
 * Render policy text with interactive annotations
 */
function renderPolicyText(policy, selectedStudent) {
    const textDisplay = document.getElementById('textDisplay');
    const policyTitle = document.getElementById('policyTitle');
    const studentFilter = document.getElementById('studentFilter');
    
    if (!textDisplay || !policy.fullText) return;
    
    // Update title
    if (policyTitle) {
        policyTitle.textContent = `Policy: ${policy.name}`;
    }
    
    // Update student filter
    if (studentFilter) {
        const studentOptions = ['<option value="all">All Students</option>'];
        Object.keys(policy.students).forEach(studentName => {
            const selected = selectedStudent === studentName ? 'selected' : '';
            studentOptions.push(`<option value="${studentName}" ${selected}>${studentName}</option>`);
        });
        studentFilter.innerHTML = studentOptions.join('');
    }
    
    // Create interactive text with hover functionality
    const annotatedText = createAnnotatedText(policy, selectedStudent);
    textDisplay.innerHTML = annotatedText;
    
    // Add hover event listeners
    setupTextHoverEvents();
}

/**
 * Create text with annotation overlays
 */
function createAnnotatedText(policy, selectedStudent) {
    let text = policy.fullText;
    const annotations = getFilteredAnnotations(policy, selectedStudent);
    
    // Sort annotations by start position (reverse order for correct insertion)
    annotations.sort((a, b) => b.textRange.start - a.textRange.start);
    
    // Insert span tags for each annotation
    annotations.forEach((annotation, index) => {
        const range = annotation.textRange;
        const before = text.substring(0, range.start);
        const annotatedPart = text.substring(range.start, range.end);
        const after = text.substring(range.end);
        
        const spanClass = `annotation annotation-${annotation.student.replace(/\s+/g, '-')}`;
        const dataAttributes = `
            data-student="${annotation.student}"
            data-label="${annotation.label}"
            data-confidence="${annotation.confidence}"
            data-timestamp="${annotation.timestamp}"
        `;
        
        text = before + `<span class="${spanClass}" ${dataAttributes}>${annotatedPart}</span>` + after;
    });
    
    return text;
}

/**
 * Get filtered annotations based on selected student
 */
function getFilteredAnnotations(policy, selectedStudent) {
    if (selectedStudent === 'all') {
        return policy.annotations;
    }
    
    return policy.students[selectedStudent] || [];
}

/**
 * Setup hover events for annotated text
 */
function setupTextHoverEvents() {
    const annotations = document.querySelectorAll('.annotation');
    const hoverInfo = document.getElementById('hoverInfo');
    
    annotations.forEach(annotation => {
        annotation.addEventListener('mouseenter', function(e) {
            const student = e.target.dataset.student;
            const label = e.target.dataset.label;
            const confidence = e.target.dataset.confidence;
            const timestamp = new Date(e.target.dataset.timestamp).toLocaleDateString();
            
            if (hoverInfo) {
                hoverInfo.innerHTML = `
                    <div class="hover-card">
                        <div class="hover-student">Student: ${student}</div>
                        <div class="hover-label">Label: ${label}</div>
                        <div class="hover-confidence">Confidence: ${confidence}</div>
                        <div class="hover-timestamp">Date: ${timestamp}</div>
                    </div>
                `;
                hoverInfo.style.display = 'block';
                
                // Position hover info near cursor
                const rect = e.target.getBoundingClientRect();
                hoverInfo.style.left = (rect.left + 10) + 'px';
                hoverInfo.style.top = (rect.bottom + 5) + 'px';
            }
        });
        
        annotation.addEventListener('mouseleave', function() {
            if (hoverInfo) {
                hoverInfo.style.display = 'none';
            }
        });
        
        // Add selection functionality for IoU calculation
        annotation.addEventListener('click', function(e) {
            toggleTextSelection(e.target);
        });
    });
}

/**
 * Initialize Intersection over Union (IoU) calculator
 */
function initializeIoUCalculator() {
    const calculatorContainer = document.getElementById('iouCalculator');
    if (!calculatorContainer) return;
    
    calculatorContainer.innerHTML = `
        <div class="calculator-header">
            <h3>IoU Agreement Analysis</h3>
            <div class="selection-info" id="selectionInfo">
                Select text ranges to calculate agreement
            </div>
        </div>
        <div class="calculator-controls">
            <button onclick="calculateSelectedIoU()">Calculate IoU</button>
            <button onclick="clearSelection()">Clear Selection</button>
            <select id="granularitySelect">
                <option value="word">Word Level</option>
                <option value="sentence">Sentence Level</option>
                <option value="paragraph">Paragraph Level</option>
            </select>
        </div>
        <div class="iou-results" id="iouResults"></div>
    `;
}

/**
 * Calculate IoU for selected text ranges
 */
function calculateSelectedIoU() {
    const selectedElements = document.querySelectorAll('.annotation.selected');
    if (selectedElements.length === 0) {
        showError('Please select text ranges first');
        return;
    }
    
    // Group annotations by text range
    const rangeGroups = groupAnnotationsByRange(selectedElements);
    
    // Calculate IoU for each range group
    const iouScores = [];
    
    rangeGroups.forEach(group => {
        const iou = calculateIoUForGroup(group);
        iouScores.push({
            text: group.text,
            score: iou,
            studentCount: group.students.size,
            labels: group.labels
        });
    });
    
    // Display results
    displayIoUResults(iouScores);
}

/**
 * Group annotations by overlapping text ranges
 */
function groupAnnotationsByRange(selectedElements) {
    const groups = [];
    
    // For simplicity, group by exact text matches
    // In a more sophisticated version, you'd handle overlapping ranges
    const textGroups = {};
    
    selectedElements.forEach(element => {
        const text = element.textContent.trim();
        const student = element.dataset.student;
        const label = element.dataset.label;
        
        if (!textGroups[text]) {
            textGroups[text] = {
                text: text,
                students: new Set(),
                labels: new Set(),
                annotations: []
            };
        }
        
        textGroups[text].students.add(student);
        textGroups[text].labels.add(label);
        textGroups[text].annotations.push({
            student: student,
            label: label,
            element: element
        });
    });
    
    return Object.values(textGroups);
}

/**
 * Calculate IoU score for a group of annotations
 */
function calculateIoUForGroup(group) {
    if (group.students.size <= 1) return 1.0;
    
    // Simple IoU calculation based on label agreement
    const labelCounts = {};
    group.annotations.forEach(ann => {
        labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
    });
    
    // Find the most common label
    const maxCount = Math.max(...Object.values(labelCounts));
    const totalCount = group.annotations.length;
    
    // IoU = intersection / union = agreements / total
    return maxCount / totalCount;
}

/**
 * Display IoU calculation results
 */
function displayIoUResults(iouScores) {
    const resultsContainer = document.getElementById('iouResults');
    if (!resultsContainer) return;
    
    if (iouScores.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No IoU scores to display</div>';
        return;
    }
    
    const resultsHTML = iouScores.map(result => {
        const scoreColor = result.score >= 0.8 ? '#28a745' : 
                          result.score >= 0.6 ? '#ffc107' : '#dc3545';
        
        return `
            <div class="iou-result-item">
                <div class="result-text">"${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"</div>
                <div class="result-metrics">
                    <span class="iou-score" style="color: ${scoreColor}">
                        IoU: ${result.score.toFixed(3)}
                    </span>
                    <span class="student-count">${result.studentCount} students</span>
                    <span class="label-variety">${result.labels.size} unique labels</span>
                </div>
            </div>
        `;
    }).join('');
    
    const averageIoU = iouScores.reduce((sum, result) => sum + result.score, 0) / iouScores.length;
    
    resultsContainer.innerHTML = `
        <div class="results-summary">
            <strong>Average IoU: ${averageIoU.toFixed(3)}</strong>
            (${iouScores.length} text ranges analyzed)
        </div>
        <div class="results-list">
            ${resultsHTML}
        </div>
    `;
}

/**
 * Toggle text selection for IoU calculation
 */
function toggleTextSelection(element) {
    element.classList.toggle('selected');
    updateSelectionInfo();
}

/**
 * Update selection information display
 */
function updateSelectionInfo() {
    const selectedCount = document.querySelectorAll('.annotation.selected').length;
    const selectionInfo = document.getElementById('selectionInfo');
    
    if (selectionInfo) {
        if (selectedCount === 0) {
            selectionInfo.textContent = 'Select text ranges to calculate agreement';
        } else {
            selectionInfo.textContent = `${selectedCount} text ranges selected`;
        }
    }
}

/**
 * Clear all text selections
 */
function clearSelection() {
    document.querySelectorAll('.annotation.selected').forEach(element => {
        element.classList.remove('selected');
    });
    updateSelectionInfo();
    
    const resultsContainer = document.getElementById('iouResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
}

/**
 * Show upload summary after processing files
 */
function showUploadSummary(successCount, totalCount) {
    const message = `Successfully processed ${successCount} of ${totalCount} files`;
    
    if (successCount === totalCount) {
        showSuccess(message);
    } else {
        showWarning(message + '. Some files may have had errors.');
    }
    
    // Update dashboard stats
    updateDashboardStats();
}

/**
 * Update main dashboard statistics
 */
function updateDashboardStats() {
    const totalPolicies = Object.keys(window.labelingData.policies).length;
    const totalStudents = window.labelingData.students.length;
    const totalFiles = window.labelingData.uploadedFiles.length;
    
    // Update stats display if elements exist
    const statsElements = {
        totalPolicies: document.getElementById('totalPolicies'),
        totalStudents: document.getElementById('totalStudents'),
        totalFiles: document.getElementById('totalFiles')
    };
    
    if (statsElements.totalPolicies) statsElements.totalPolicies.textContent = totalPolicies;
    if (statsElements.totalStudents) statsElements.totalStudents.textContent = totalStudents;
    if (statsElements.totalFiles) statsElements.totalFiles.textContent = totalFiles;
}

/**
 * Export analysis results
 */
function exportAnalysisResults() {
    const exportData = {
        timestamp: new Date().toISOString(),
        project: 'GKCCI Privacy Policy Analysis',
        summary: {
            totalPolicies: Object.keys(window.labelingData.policies).length,
            totalStudents: window.labelingData.students.length,
            totalFiles: window.labelingData.uploadedFiles.length
        },
        policies: window.labelingData.policies,
        uploadedFiles: window.labelingData.uploadedFiles.map(file => ({
            filename: file.filename,
            student: file.student,
            policy: file.policy,
            timestamp: file.timestamp,
            annotationCount: file.data ? file.data.length : 0
        }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GKCCI_Analysis_Export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Analysis results exported successfully!');
}

// Utility functions for UI feedback
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 300px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Keep the existing authentication and user management functions
// ... (include all the checkAuthentication, initializeUserInterface, etc. functions from the original)

// Update keyboard shortcuts for new functionality
function handleKeyboardShortcuts(e) {
    // Ctrl+E or Cmd+E: Export results
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportAnalysisResults();
    }
    
    // Ctrl+U or Cmd+U: Focus upload area
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.click();
    }
    
    // Ctrl+I or Cmd+I: Calculate IoU for selection
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        calculateSelectedIoU();
    }
    
    // Escape: Clear selection
    if (e.key === 'Escape') {
        clearSelection();
    }
}