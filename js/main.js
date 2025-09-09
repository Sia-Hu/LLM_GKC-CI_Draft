// Main Application Logic for Privacy Policy Dashboard

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('GKCCI Privacy Policy Dashboard initializing...');
    
    // Check authentication first
    if (!checkAuthentication()) {
        return; // Will redirect to login
    }
    
    // Initialize user interface
    initializeUserInterface();
    
    // Initialize drag and drop functionality
    setupDragAndDrop();
    
    // Initialize event listeners
    setupEventListeners();
    
    // Initialize date inputs with current date
    initializeDateInputs();
    
    // Initialize enhanced features
    initializeEnhancedApp();
    
    // Load user-specific data
    loadUserData();
    
    // Generate sample data on first load if no user data exists
    setTimeout(() => {
        if (!hasUserData()) {
            generateSampleData();
        }
    }, 500);
    
    console.log('Dashboard initialization complete');
});

/**
 * Check if user is authenticated
 */
function checkAuthentication() {
    // Import auth functions
    if (typeof window.UserAuth === 'undefined') {
        // Load auth script if not already loaded
        const script = document.createElement('script');
        script.src = 'js/auth.js';
        script.onload = function() {
            if (!window.UserAuth.requireAuth()) {
                return false;
            }
        };
        document.head.appendChild(script);
        return false;
    }
    
    return window.UserAuth.requireAuth();
}

/**
 * Initialize user interface with current user info
 */
function initializeUserInterface() {
    if (typeof window.UserAuth !== 'undefined' && window.UserAuth.isLoggedIn()) {
        const user = window.UserAuth.getCurrentUser();
        
        // Update user info in header
        document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('userRole').textContent = `${user.role} at ${user.university}`;
        
        // Set user avatar with initials
        const avatar = document.getElementById('userAvatar');
        avatar.textContent = `${user.firstName[0]}${user.lastName[0]}`;
        
        // Update page title
        document.title = `GKCCI Dashboard - ${user.firstName} ${user.lastName}`;
    }
}

/**
 * Toggle user dropdown menu
 */
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.user-menu')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

/**
 * User menu functions
 */
function showProfile() {
    const user = window.UserAuth.getCurrentUser();
    alert(`Profile Information:\n\nName: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nUniversity: ${user.university}\nRole: ${user.role}\nAccount Created: ${new Date(user.createdAt).toLocaleDateString()}`);
}

function showMyData() {
    const userData = getUserSpecificData();
    const totalAnnotations = userData.annotations?.length || 0;
    const totalUploads = userData.uploads?.length || 0;
    const lastUpload = userData.uploads?.length > 0 ? 
        new Date(userData.uploads[userData.uploads.length - 1].timestamp).toLocaleDateString() : 'Never';
    
    alert(`Your Data Summary:\n\nTotal Annotations: ${totalAnnotations}\nFiles Uploaded: ${totalUploads}\nLast Upload: ${lastUpload}\n\nUse the Export button to download your data.`);
}

function showSettings() {
    const newEmail = prompt('Update Email Address:', window.UserAuth.getCurrentUser().email);
    if (newEmail && newEmail !== window.UserAuth.getCurrentUser().email) {
        // In a real app, you'd validate and update this
        alert('Email update feature coming soon!');
    }
}

function showHelp() {
    alert('GKCCI Dashboard Help:\n\n1. Upload JSON: Use the upload section to add your Label Studio exports\n2. View Analytics: Charts show your annotation consistency and patterns\n3. Compare Data: See how your annotations compare with other annotators\n4. Export Results: Download your analysis for research papers\n5. Collaborate: Work with other law students to create gold standard data\n\nFor technical support: support@gkcci-project.org');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Save any pending data before logout
        saveUserData();
        window.UserAuth.logout();
    }
}

/**
 * User-specific data management
 */
function getUserDataKey() {
    const user = window.UserAuth.getCurrentUser();
    return `gkcci_data_${user.id}`;
}

function getUserSpecificData() {
    const key = getUserDataKey();
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {
        annotations: [],
        uploads: [],
        projects: [],
        settings: {}
    };
}

function saveUserData() {
    const key = getUserDataKey();
    const userData = {
        annotations: window.labelingData.annotations || [],
        students: window.labelingData.students || [],
        labels: window.labelingData.labels || [],
        projects: window.labelingData.projects || [],
        uploads: getUserSpecificData().uploads || [],
        lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem(key, JSON.stringify(userData));
}

function loadUserData() {
    const userData = getUserSpecificData();
    
    if (userData.annotations && userData.annotations.length > 0) {
        window.labelingData = {
            annotations: userData.annotations,
            students: userData.students || [],
            labels: userData.labels || [],
            projects: userData.projects || []
        };
        
        updateVisualizations();
        populateStudentFilter();
        
        if (userData.annotations.length > 0) {
            showDataSummary(
                userData.uploads?.length || 0,
                userData.annotations.length,
                userData.students?.length || 0,
                userData.labels?.length || 0
            );
        }
    }
}

function hasUserData() {
    const userData = getUserSpecificData();
    return userData.annotations && userData.annotations.length > 0;
}

function addUserUpload(filename, annotationCount) {
    const userData = getUserSpecificData();
    if (!userData.uploads) userData.uploads = [];
    
    userData.uploads.push({
        filename: filename,
        timestamp: new Date().toISOString(),
        annotationCount: annotationCount
    });
    
    const key = getUserDataKey();
    localStorage.setItem(key, JSON.stringify(userData));
}

/**
 * Setup drag and drop functionality for file uploads
 */
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    if (!uploadArea) return;
    
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
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.files = files;
                handleFileUpload({ target: { files: files } });
            }
        }
    });
}

/**
 * Setup event listeners for various UI components
 */
function setupEventListeners() {
    // Filter event listeners
    const projectSelect = document.getElementById('projectSelect');
    const studentFilter = document.getElementById('studentFilter');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (projectSelect) {
        projectSelect.addEventListener('change', applyFilters);
    }
    
    if (studentFilter) {
        studentFilter.addEventListener('change', applyFilters);
    }
    
    if (startDate) {
        startDate.addEventListener('change', applyFilters);
    }
    
    if (endDate) {
        endDate.addEventListener('change', applyFilters);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Initialize date inputs with appropriate default values
 */
function initializeDateInputs() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate && !startDate.value) {
        // Set to beginning of current year
        const currentYear = new Date().getFullYear();
        startDate.value = `${currentYear}-01-01`;
    }
    
    if (endDate && !endDate.value) {
        // Set to current date
        const today = new Date();
        endDate.value = today.toISOString().split('T')[0];
    }
}

/**
 * Apply filters to the data visualization
 */
function applyFilters() {
    const projectFilter = document.getElementById('projectSelect')?.value || 'all';
    const studentFilter = document.getElementById('studentFilter')?.value || 'all';
    const startDateFilter = document.getElementById('startDate')?.value;
    const endDateFilter = document.getElementById('endDate')?.value;
    
    // Filter annotations based on selected criteria
    let filteredAnnotations = [...window.labelingData.annotations];
    
    // Apply project filter
    if (projectFilter !== 'all') {
        filteredAnnotations = filteredAnnotations.filter(ann => 
            ann.project.toLowerCase().includes(projectFilter.toLowerCase())
        );
    }
    
    // Apply student filter
    if (studentFilter !== 'all') {
        const selectedStudent = window.labelingData.students.find(s => s.id == studentFilter);
        if (selectedStudent) {
            filteredAnnotations = filteredAnnotations.filter(ann => 
                ann.studentId === selectedStudent.id || 
                ann.studentId === selectedStudent.name ||
                ann.studentId === selectedStudent.email
            );
        }
    }
    
    // Apply date range filter
    if (startDateFilter) {
        const startDate = new Date(startDateFilter);
        filteredAnnotations = filteredAnnotations.filter(ann => 
            new Date(ann.timestamp) >= startDate
        );
    }
    
    if (endDateFilter) {
        const endDate = new Date(endDateFilter + 'T23:59:59');
        filteredAnnotations = filteredAnnotations.filter(ann => 
            new Date(ann.timestamp) <= endDate
        );
    }
    
    // Temporarily update the global data with filtered results
    const originalAnnotations = window.labelingData.annotations;
    window.labelingData.annotations = filteredAnnotations;
    
    // Update visualizations with filtered data
    updateVisualizations();
    
    // Restore original data
    window.labelingData.annotations = originalAnnotations;
    
    // Show filter status
    showFilterStatus(filteredAnnotations.length, originalAnnotations.length);
}

/**
 * Show filter status to user
 * @param {number} filteredCount - Number of annotations after filtering
 * @param {number} totalCount - Total number of annotations
 */
function showFilterStatus(filteredCount, totalCount) {
    // Remove existing filter status
    const existingStatus = document.querySelector('.filter-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    if (filteredCount < totalCount) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'filter-status';
        statusDiv.style.cssText = `
            background: rgba(102, 126, 234, 0.1);
            border: 1px solid #667eea;
            color: #667eea;
            padding: 10px 15px;
            border-radius: 5px;
            margin: 10px 0;
            text-align: center;
            font-size: 0.9em;
        `;
        statusDiv.textContent = `Showing ${filteredCount} of ${totalCount} GKCCI annotations (filtered)`;
        
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.parentNode.insertBefore(statusDiv, dashboard);
        }
    }
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardShortcuts(e) {
    // Ctrl+E or Cmd+E: Export results
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportResults();
    }
    
    // Ctrl+R or Cmd+R: Refresh/regenerate sample data
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        generateSampleData();
    }
    
    // Ctrl+U or Cmd+U: Focus upload area
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.click();
    }
    
    // Escape: Clear filters
    if (e.key === 'Escape') {
        clearFilters();
    }
}

/**
 * Clear all filters and show all data
 */
function clearFilters() {
    const projectSelect = document.getElementById('projectSelect');
    const studentFilter = document.getElementById('studentFilter');
    
    if (projectSelect) projectSelect.value = 'all';
    if (studentFilter) studentFilter.value = 'all';
    
    // Remove filter status
    const filterStatus = document.querySelector('.filter-status');
    if (filterStatus) {
        filterStatus.remove();
    }
    
    updateVisualizations();
}

/**
 * Download sample data file for testing
 */
function downloadSampleData() {
    const sampleData = {
        tasks: [
            {
                id: 1,
                data: {
                    text: "We collect personal information including your name, email address, and phone number when you create an account with our service."
                },
                annotations: [
                    {
                        id: 1,
                        completed_by: { email: "student1@uiowa.edu" },
                        result: [
                            {
                                value: {
                                    choices: ["Personal Data Collection"]
                                },
                                from_name: "label",
                                to_name: "text"
                            }
                        ],
                        created_at: "2024-01-15T10:30:00Z"
                    }
                ]
            },
            {
                id: 2,
                data: {
                    text: "Your information may be shared with trusted third-party partners for marketing and promotional purposes."
                },
                annotations: [
                    {
                        id: 2,
                        completed_by: { email: "student2@uiowa.edu" },
                        result: [
                            {
                                value: {
                                    choices: ["Data Sharing", "Third Party"]
                                },
                                from_name: "label",
                                to_name: "text"
                            }
                        ],
                        created_at: "2024-01-15T11:15:00Z"
                    }
                ]
            }
        ]
    };
    
    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-labelstudio-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Toggle between light and dark themes (future enhancement)
 */
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * Load saved theme preference
 */
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

/**
 * Print dashboard (remove unnecessary elements)
 */
function printDashboard() {
    const printWindow = window.open('', '_blank');
    const currentContent = document.documentElement.outerHTML;
    
    printWindow.document.write(currentContent);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Check for browser compatibility and show warnings if needed
 */
function checkBrowserCompatibility() {
    // Check for modern browser features
    const hasModernFeatures = 
        typeof fetch !== 'undefined' &&
        typeof Promise !== 'undefined' &&
        typeof Array.from !== 'undefined';
    
    if (!hasModernFeatures) {
        showError('Your browser may not support all features. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
    }
    
    // Check for Chart.js
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet, charts will initialize when available');
    }
}

/**
 * Initialize keyboard shortcuts help
 */
function initializeKeyboardShortcuts() {
    // Create help overlay for keyboard shortcuts
    const helpDiv = document.createElement('div');
    helpDiv.id = 'keyboard-help';
    helpDiv.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #667eea;
        border-radius: 15px;
        padding: 30px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        max-width: 400px;
        font-family: 'Segoe UI', sans-serif;
    `;
    
    helpDiv.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #333;">Keyboard Shortcuts</h3>
        <div style="line-height: 1.8;">
            <strong>Ctrl/Cmd + E:</strong> Export results<br>
            <strong>Ctrl/Cmd + R:</strong> Generate sample data<br>
            <strong>Ctrl/Cmd + U:</strong> Upload file<br>
            <strong>Escape:</strong> Clear filters<br>
            <strong>F1:</strong> Show/hide this help
        </div>
        <button onclick="toggleKeyboardHelp()" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        ">Close</button>
    `;
    
    document.body.appendChild(helpDiv);
}

/**
 * Toggle keyboard shortcuts help
 */
function toggleKeyboardHelp() {
    const helpDiv = document.getElementById('keyboard-help');
    if (helpDiv) {
        helpDiv.style.display = helpDiv.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Handle advanced filtering with GKCCI-specific options
 */
function setupAdvancedFiltering() {
    // Add jurisdiction filter
    const controlGroup = document.querySelector('.control-group');
    if (controlGroup && !document.getElementById('jurisdictionFilter')) {
        const jurisdictionFilter = document.createElement('select');
        jurisdictionFilter.id = 'jurisdictionFilter';
        jurisdictionFilter.innerHTML = `
            <option value="all">All Jurisdictions</option>
            <option value="US">United States</option>
            <option value="EU">European Union</option>
            <option value="UK">United Kingdom</option>
            <option value="CA">Canada</option>
        `;
        
        const label = document.createElement('label');
        label.textContent = 'Jurisdiction:';
        label.setAttribute('for', 'jurisdictionFilter');
        
        controlGroup.appendChild(label);
        controlGroup.appendChild(jurisdictionFilter);
        
        jurisdictionFilter.addEventListener('change', applyAdvancedFilters);
    }
}

/**
 * Apply advanced filters including jurisdiction
 */
function applyAdvancedFilters() {
    applyFilters(); // Call the existing filter function
    
    const jurisdictionFilter = document.getElementById('jurisdictionFilter')?.value || 'all';
    
    if (jurisdictionFilter !== 'all') {
        // Additional jurisdiction-specific filtering
        let filteredAnnotations = window.labelingData.annotations.filter(ann => 
            ann.jurisdiction === jurisdictionFilter || 
            (ann.taskData && ann.taskData.jurisdiction === jurisdictionFilter)
        );
        
        // Update visualizations with jurisdiction-filtered data
        const originalAnnotations = window.labelingData.annotations;
        window.labelingData.annotations = filteredAnnotations;
        updateVisualizations();
        window.labelingData.annotations = originalAnnotations;
    }
}

/**
 * Generate detailed report for GKCCI research
 */
function generateGKCCIReport() {
    const annotations = window.labelingData.annotations;
    const students = window.labelingData.students;
    
    if (!annotations || annotations.length === 0) {
        showError('No data available to generate report. Please load annotation data first.');
        return;
    }

    // Calculate GKCCI-specific metrics
    const parameterCounts = {};
    const studentPerformance = {};
    const jurisdictionAnalysis = {};
    
    // Analyze each annotation
    annotations.forEach(ann => {
        // Count parameter usage
        parameterCounts[ann.label] = (parameterCounts[ann.label] || 0) + 1;
        
        // Track student performance
        if (!studentPerformance[ann.studentId]) {
            studentPerformance[ann.studentId] = {
                total: 0,
                avgConfidence: 0,
                parameters: {}
            };
        }
        studentPerformance[ann.studentId].total++;
        studentPerformance[ann.studentId].avgConfidence += parseFloat(ann.confidence);
        studentPerformance[ann.studentId].parameters[ann.label] = 
            (studentPerformance[ann.studentId].parameters[ann.label] || 0) + 1;
        
        // Jurisdiction analysis
        const jurisdiction = ann.jurisdiction || ann.taskData?.jurisdiction || 'Unknown';
        if (!jurisdictionAnalysis[jurisdiction]) {
            jurisdictionAnalysis[jurisdiction] = {};
        }
        jurisdictionAnalysis[jurisdiction][ann.label] = 
            (jurisdictionAnalysis[jurisdiction][ann.label] || 0) + 1;
    });
    
    // Calculate averages
    Object.keys(studentPerformance).forEach(studentId => {
        const perf = studentPerformance[studentId];
        perf.avgConfidence = (perf.avgConfidence / perf.total).toFixed(1);
    });
    
    // Generate report
    const report = {
        reportDate: new Date().toISOString(),
        project: "GKCCI Privacy Policy Analysis",
        collaboration: "Colgate University × University of Iowa",
        summary: {
            totalAnnotations: annotations.length,
            totalStudents: students.length,
            annotationPeriod: {
                start: annotations.length > 0 ? 
                    annotations.reduce((min, ann) => ann.timestamp < min ? ann.timestamp : min, annotations[0].timestamp) : null,
                end: annotations.length > 0 ? 
                    annotations.reduce((max, ann) => ann.timestamp > max ? ann.timestamp : max, annotations[0].timestamp) : null
            }
        },
        gkcciParameters: {
            distribution: parameterCounts,
            mostUsed: Object.keys(parameterCounts).reduce((a, b) => parameterCounts[a] > parameterCounts[b] ? a : b, ''),
            leastUsed: Object.keys(parameterCounts).reduce((a, b) => parameterCounts[a] < parameterCounts[b] ? a : b, ''),
            coverage: Object.keys(parameterCounts).length
        },
        studentAnalysis: studentPerformance,
        jurisdictionalAnalysis: jurisdictionAnalysis,
        qualityMetrics: {
            overallAgreement: document.getElementById('overallAgreement')?.textContent || 'N/A',
            cohensKappa: document.getElementById('kappaScore')?.textContent || 'N/A',
            annotationDensity: (annotations.length / students.length).toFixed(1)
        }
    };
    
    // Download report
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GKCCI_Report_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('GKCCI research report generated and downloaded successfully!');
}

/**
 * Add GKCCI report button to controls
 */
function addGKCCIReportButton() {
    const controlGroup = document.querySelector('.control-group:last-child');
    if (controlGroup && !document.getElementById('gkcciReportBtn')) {
        const reportBtn = document.createElement('button');
        reportBtn.id = 'gkcciReportBtn';
        reportBtn.textContent = 'Generate GKCCI Report';
        reportBtn.onclick = generateGKCCIReport;
        controlGroup.appendChild(reportBtn);
    }
}

/**
 * Setup real-time data refresh (for live Label Studio connection)
 */
function setupRealTimeRefresh() {
    let refreshInterval = null;
    
    // Add refresh toggle button
    const controlGroup = document.querySelector('.control-group:last-child');
    if (controlGroup && !document.getElementById('refreshToggle')) {
        const refreshToggle = document.createElement('button');
        refreshToggle.id = 'refreshToggle';
        refreshToggle.textContent = 'Enable Auto-Refresh';
        refreshToggle.onclick = function() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
                refreshToggle.textContent = 'Enable Auto-Refresh';
                refreshToggle.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
            } else {
                // Check if we have API connection details
                const url = document.getElementById('labelStudioUrl')?.value;
                const token = document.getElementById('apiToken')?.value;
                const projectId = document.getElementById('projectId')?.value;
                
                if (url && token && projectId) {
                    refreshInterval = setInterval(() => {
                        fetchFromAPI();
                    }, 30000); // Refresh every 30 seconds
                    
                    refreshToggle.textContent = 'Disable Auto-Refresh';
                    refreshToggle.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                    showSuccess('Auto-refresh enabled (30 second intervals)');
                } else {
                    showError('Please connect to Label Studio first before enabling auto-refresh');
                }
            }
        };
        controlGroup.appendChild(refreshToggle);
    }
}

/**
 * Enhanced error handling for the application
 */
function setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        showError(`An unexpected error occurred: ${e.message}`);
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        showError('A network or processing error occurred. Please try again.');
    });
}

/**
 * Initialize application with all enhancements
 */
function initializeEnhancedApp() {
    console.log('Initializing enhanced GKCCI dashboard...');
    
    // Run compatibility check
    checkBrowserCompatibility();
    
    // Setup error handling
    setupErrorHandling();
    
    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();
    
    // Setup advanced filtering
    setTimeout(setupAdvancedFiltering, 1000);
    
    // Add GKCCI report functionality
    setTimeout(addGKCCIReportButton, 1000);
    
    // Setup real-time refresh
    setTimeout(setupRealTimeRefresh, 1000);
    
    console.log('Enhanced dashboard initialization complete');
}

// Enhanced initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('GKCCI Privacy Policy Dashboard initializing...');
    
    // Initialize basic functionality
    setupDragAndDrop();
    setupEventListeners();
    initializeDateInputs();
    
    // Initialize enhanced features
    initializeEnhancedApp();
    
    // Generate sample data after everything is loaded
    setTimeout(() => {
        generateSampleData();
    }, 500);
    
    console.log('Dashboard initialization complete');
});

// Add F1 key handler for help
document.addEventListener('keydown', function(e) {
    if (e.key === 'F1') {
        e.preventDefault();
        if (!document.getElementById('keyboard-help')) {
            initializeKeyboardShortcuts();
        }
        toggleKeyboardHelp();
    }
});

// Update the existing handleKeyboardShortcuts function to include F1
function handleKeyboardShortcuts(e) {
    // Ctrl+E or Cmd+E: Export results
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportResults();
    }
    
    // Ctrl+R or Cmd+R: Refresh/regenerate sample data
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        generateSampleData();
    }
    
    // Ctrl+U or Cmd+U: Focus upload area
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.click();
    }
    
    // Ctrl+G or Cmd+G: Generate GKCCI report
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        generateGKCCIReport();
    }
    
    // Escape: Clear filters
    if (e.key === 'Escape') {
        clearFilters();
    }
    
    // F1: Show keyboard shortcuts help
    if (e.key === 'F1') {
        e.preventDefault();
        if (!document.getElementById('keyboard-help')) {
            initializeKeyboardShortcuts();
        }
        toggleKeyboardHelp();
    }
}