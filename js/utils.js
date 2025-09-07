// Utility Functions for Privacy Policy Dashboard

/**
 * Global data structure for the application
 */
window.labelingData = {
    students: [],
    labels: [],
    projects: [],
    annotations: []
};

/**
 * Color scheme for different label types
 */
window.labelColors = {
    'Personal Data Collection': '#FF6B6B',
    'Data Sharing': '#4ECDC4',
    'User Rights': '#45B7D1',
    'Data Retention': '#96CEB4',
    'Security Measures': '#FFEAA7',
    'Third Party': '#DDA0DD',
    'Cookies': '#98D8C8',
    'Contact Info': '#F7DC6F',
    'Data Processing': '#FF8A80',
    'User Consent': '#A5D6A7',
    'Data Transfer': '#FFCC80',
    'Privacy Rights': '#CE93D8'
};

/**
 * Utility function to show status messages
 * @param {string} message - Main status message
 * @param {string} details - Additional details
 */
function showStatus(message, details = '') {
    const statusDiv = document.getElementById('uploadStatus');
    if (!statusDiv) return;
    
    const statusText = statusDiv.querySelector('.status-text');
    const statusDetails = statusDiv.querySelector('.status-details');
    
    if (statusText) statusText.textContent = message;
    if (statusDetails) statusDetails.textContent = details;
    statusDiv.style.display = 'block';
}

/**
 * Hide status messages
 */
function hideStatus() {
    const statusDiv = document.getElementById('uploadStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

/**
 * Show data summary
 * @param {number} taskCount - Number of tasks
 * @param {number} annotationCount - Number of annotations
 * @param {number} annotatorCount - Number of annotators
 * @param {number} labelTypeCount - Number of label types
 */
function showDataSummary(taskCount, annotationCount, annotatorCount, labelTypeCount) {
    const elements = {
        taskCount: document.getElementById('taskCount'),
        annotationCount: document.getElementById('annotationCount'),
        annotatorCount: document.getElementById('annotatorCount'),
        labelTypeCount: document.getElementById('labelTypeCount'),
        dataSummary: document.getElementById('dataSummary')
    };
    
    if (elements.taskCount) elements.taskCount.textContent = taskCount.toLocaleString();
    if (elements.annotationCount) elements.annotationCount.textContent = annotationCount.toLocaleString();
    if (elements.annotatorCount) elements.annotatorCount.textContent = annotatorCount;
    if (elements.labelTypeCount) elements.labelTypeCount.textContent = labelTypeCount;
    if (elements.dataSummary) elements.dataSummary.style.display = 'block';
}

/**
 * Generate random sample data for testing
 */
function generateSampleData() {
    const students = [
        'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim',
        'Jessica Taylor', 'Robert Wilson', 'Amanda Davis', 'James Anderson',
        'Lisa Parker', 'Thomas Brown', 'Maria Garcia', 'Ryan Miller'
    ];

    const labelTypes = Object.keys(window.labelColors);
    const projects = ['Privacy Policy Analysis', 'GDPR Compliance Review', 'Terms of Service Study', 'CCPA Analysis'];

    // Create student records
    window.labelingData.students = students.map((name, index) => ({
        id: index + 1,
        name: name,
        email: `${name.toLowerCase().replace(' ', '.')}@uiowa.edu`,
        university: 'University of Iowa',
        totalLabels: Math.floor(Math.random() * 300) + 100,
        accuracy: (Math.random() * 20 + 80).toFixed(1)
    }));

    window.labelingData.labels = labelTypes;
    window.labelingData.projects = projects;

    // Generate sample annotations
    window.labelingData.annotations = [];
    for (let i = 0; i < 1500; i++) {
        window.labelingData.annotations.push({
            id: i + 1,
            studentId: Math.floor(Math.random() * students.length) + 1,
            label: labelTypes[Math.floor(Math.random() * labelTypes.length)],
            confidence: (Math.random() * 30 + 70).toFixed(1),
            timestamp: generateRandomDate().toISOString(),
            project: projects[Math.floor(Math.random() * projects.length)],
            taskData: {
                text: generateSamplePrivacyText()
            },
            // Add GKCCI-specific metadata
            policySource: ['Company Website', 'Mobile App', 'Terms of Service', 'Cookie Policy'][Math.floor(Math.random() * 4)],
            jurisdiction: ['US', 'EU', 'UK', 'CA'][Math.floor(Math.random() * 4)]
        });
    }

    updateVisualizations();
    populateStudentFilter();
    showDataSummary(
        Math.floor(window.labelingData.annotations.length / 3),
        window.labelingData.annotations.length,
        window.labelingData.students.length,
        labelTypes.length
    );
}

/**
 * Generate a random date within the last year
 * @returns {Date} Random date
 */
function generateRandomDate() {
    const start = new Date(2024, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate sample privacy policy text
 * @returns {string} Sample text
 */
function generateSamplePrivacyText() {
    const samples = [
        "We collect personal information when you register for our services...",
        "Your data may be shared with third-party partners for marketing purposes...",
        "You have the right to request deletion of your personal data...",
        "We retain your information for as long as necessary to provide our services...",
        "We implement appropriate security measures to protect your data...",
        "Cookies are used to enhance your browsing experience...",
        "You can contact us at privacy@company.com for any privacy-related inquiries...",
        "We may transfer your data to servers located outside your country...",
        "By using our service, you consent to our data processing practices...",
        "We process your data based on legitimate business interests..."
    ];
    return samples[Math.floor(Math.random() * samples.length)];
}

/**
 * Export results as JSON file
 */
function exportResults() {
    const results = {
        exportDate: new Date().toISOString(),
        summary: {
            totalLabels: window.labelingData.annotations.length,
            activeAnnotators: window.labelingData.students.length,
            overallAgreement: document.getElementById('overallAgreement')?.textContent || 'N/A',
            kappaScore: document.getElementById('kappaScore')?.textContent || 'N/A'
        },
        students: window.labelingData.students,
        annotations: window.labelingData.annotations,
        projects: window.labelingData.projects,
        labelTypes: window.labelingData.labels
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labeling_analysis_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Clear all data
 */
function clearData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        window.labelingData = {
            students: [],
            labels: [],
            projects: [],
            annotations: []
        };
        
        updateVisualizations();
        
        const dataSummary = document.getElementById('dataSummary');
        if (dataSummary) dataSummary.style.display = 'none';
        
        const studentFilter = document.getElementById('studentFilter');
        if (studentFilter) studentFilter.innerHTML = '<option value="all">All Students</option>';
        
        alert('Data cleared successfully.');
    }
}

/**
 * Populate student filter dropdown
 */
function populateStudentFilter() {
    const studentFilter = document.getElementById('studentFilter');
    if (!studentFilter) return;
    
    studentFilter.innerHTML = '<option value="all">All Students</option>';
    
    window.labelingData.students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = student.name;
        studentFilter.appendChild(option);
    });
}

/**
 * Calculate Cohen's Kappa (simplified approximation)
 * @param {Array} annotations - Array of annotations
 * @returns {number} Kappa score
 */
function calculateKappa(annotations) {
    // This is a simplified calculation
    // In a real implementation, you'd need pairs of annotations for the same task
    const avgAgreement = annotations.reduce((sum, ann) => sum + parseFloat(ann.confidence), 0) / annotations.length;
    const expectedAgreement = 1 / window.labelingData.labels.length; // Random chance
    return ((avgAgreement / 100 - expectedAgreement) / (1 - expectedAgreement)).toFixed(2);
}

/**
 * Assign colors to new labels dynamically
 * @param {Array} labels - Array of label names
 */
function assignLabelColors(labels) {
    const defaultColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', 
        '#98D8C8', '#F7DC6F', '#FF8A80', '#A5D6A7', '#FFCC80', '#CE93D8',
        '#90CAF9', '#A5D6A7', '#FFAB91', '#F8BBD9', '#C5E1A5', '#FFE082'
    ];
    
    labels.forEach((label, index) => {
        if (!window.labelColors[label]) {
            window.labelColors[label] = defaultColors[index % defaultColors.length];
        }
    });
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Debounce function for search/filter inputs
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.container');
    if (container && container.firstChild) {
        container.insertBefore(errorDiv, container.firstChild);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

/**
 * Show success message
 * @param {string} message - Success message
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    
    const container = document.querySelector('.container');
    if (container && container.firstChild) {
        container.insertBefore(successDiv, container.firstChild);
        setTimeout(() => successDiv.remove(), 3000);
    }
}