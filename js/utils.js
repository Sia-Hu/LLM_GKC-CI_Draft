// Updated Utility Functions for Privacy Policy Dashboard

/**
 * GKCCI Framework Parameters with colors
 */
if (typeof window.gkcciParameters === 'undefined') {
    window.gkcciParameters = {
        'Sender': '#FF6B6B',
        'Subject': '#4ECDC4', 
        'Information Type': '#45B7D1',
        'Recipient': '#96CEB4',
        'Aim': '#FFEAA7',
        'Condition': '#DDA0DD',
        'Modalities': '#98D8C8',
        'Consequence': '#F7DC6F'
    };
}

/**
 * Initialize labeling data structure if not exists
 */
if (typeof window.labelingData === 'undefined') {
    window.labelingData = {
        students: [],
        labels: [],
        projects: [],
        annotations: []
    };
}

/**
 * Policy management functions
 */
window.PolicyManager = {
    
    /**
     * Get all policies from localStorage
     */
    getAllPolicies: function() {
        return JSON.parse(localStorage.getItem('gkcci_policy_documents') || '{}');
    },
    
    /**
     * Get specific policy data
     */
    getPolicy: function(policyName) {
        const policies = this.getAllPolicies();
        return policies[policyName] || null;
    },
    
    /**
     * Save policy data to localStorage
     */
    savePolicy: function(policyName, policyData) {
        const policies = this.getAllPolicies();
        policies[policyName] = policyData;
        localStorage.setItem('gkcci_policy_documents', JSON.stringify(policies));
    },
    
    /**
     * Check if student has required information
     */
    validateStudentInfo: function() {
        const name = document.getElementById('studentName')?.value?.trim();
        const policy = document.getElementById('policyName')?.value?.trim();
        
        return {
            isValid: !!(name && policy),
            name: name,
            policy: policy,
            email: document.getElementById('studentEmail')?.value?.trim(),
            university: document.getElementById('university')?.value
        };
    },
    
    /**
     * Get policy statistics
     */
    getPolicyStats: function(policyName) {
        const policy = this.getPolicy(policyName);
        if (!policy) return null;
        
        const contributors = Object.keys(policy.contributors).length;
        const totalAnnotations = policy.totalAnnotations || 0;
        const avgAnnotationsPerContributor = contributors > 0 ? Math.round(totalAnnotations / contributors) : 0;
        
        return {
            contributors: contributors,
            totalAnnotations: totalAnnotations,
            avgAnnotationsPerContributor: avgAnnotationsPerContributor,
            createdAt: policy.createdAt,
            lastUpdated: policy.lastUpdated,
            contributorDetails: policy.contributors
        };
    },
    
    /**
     * Get all contributors across all policies
     */
    getAllContributors: function() {
        const policies = this.getAllPolicies();
        const contributors = new Set();
        
        Object.values(policies).forEach(policy => {
            Object.keys(policy.contributors).forEach(contributor => {
                contributors.add(contributor);
            });
        });
        
        return Array.from(contributors);
    },
    
    /**
     * Search policies by name
     */
    searchPolicies: function(searchTerm) {
        const policies = this.getAllPolicies();
        const term = searchTerm.toLowerCase();
        
        return Object.keys(policies).filter(policyName => 
            policyName.toLowerCase().includes(term)
        );
    }
};

/**
 * UI Helper Functions
 */
window.UIHelpers = {
    
    /**
     * Show error message
     */
    showError: function(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #e53e3e, #c53030);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-weight: bold;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 4000);
    },
    
    /**
     * Show success message
     */
    showSuccess: function(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #48bb78, #38a169);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-weight: bold;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    },
    
    /**
     * Show loading status
     */
    showStatus: function(message, icon) {
        const status = document.getElementById('uploadStatus');
        if (status) {
            const iconElement = status.querySelector('.status-icon');
            const textElement = status.querySelector('.status-text');
            
            if (iconElement) iconElement.textContent = icon || '⏳';
            if (textElement) textElement.textContent = message;
            
            status.style.display = 'block';
        }
    },
    
    /**
     * Hide loading status
     */
    hideStatus: function() {
        const status = document.getElementById('uploadStatus');
        if (status) status.style.display = 'none';
    },
    
    /**
     * Update upload section visibility
     */
    updateUploadVisibility: function() {
        const validation = window.PolicyManager.validateStudentInfo();
        
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const uploadInterface = document.getElementById('uploadInterface');
        
        if (uploadPlaceholder && uploadInterface) {
            uploadPlaceholder.style.display = validation.isValid ? 'none' : 'block';
            uploadInterface.style.display = validation.isValid ? 'block' : 'none';
        }
        
        // Update validation indicators
        this.updateValidationIndicators(validation);
    },
    
    /**
     * Update validation check marks
     */
    updateValidationIndicators: function(validation) {
        const nameCheck = document.getElementById('nameCheck');
        const policyCheck = document.getElementById('policyCheck');
        const universityCheck = document.getElementById('universityCheck');
        
        if (nameCheck) nameCheck.textContent = validation.name ? '✅' : '❌';
        if (policyCheck) policyCheck.textContent = validation.policy ? '✅' : '❌';
        if (universityCheck) universityCheck.textContent = validation.university ? '✅' : '❓';
    }
};

/**
 * Data Processing Functions
 */
window.DataProcessor = {
    
    /**
     * Process Label Studio JSON export
     */
    processLabelStudioData: function(data) {
        let tasks = [];
        
        if (Array.isArray(data)) {
            tasks = data;
        } else if (data.tasks) {
            tasks = data.tasks;
        } else if (data.results) {
            tasks = data.results;
        } else {
            tasks = [data];
        }
        
        const annotations = [];
        const annotators = new Set();
        const labelTypes = new Set();
        const validLabels = ['Sender', 'Subject', 'Information Type', 'Recipient', 'Aim', 'Condition', 'Modalities', 'Consequence'];
        
        tasks.forEach((task, taskIndex) => {
            if (task.annotations && Array.isArray(task.annotations)) {
                task.annotations.forEach((annotation) => {
                    let annotatorName = 'Unknown_Annotator';
                    const completedBy = annotation.completed_by;
                    
                    if (typeof completedBy === 'object' && completedBy !== null) {
                        annotatorName = completedBy.email || completedBy.username || 
                                     completedBy.first_name || `User_${completedBy.id}`;
                    } else if (typeof completedBy === 'number') {
                        annotatorName = `Law_Student_${completedBy}`;
                    } else if (typeof completedBy === 'string') {
                        annotatorName = completedBy;
                    }
                    
                    annotators.add(annotatorName);
                    
                    if (annotation.result && Array.isArray(annotation.result)) {
                        annotation.result.forEach((result) => {
                            if (result.value && result.value.labels && Array.isArray(result.value.labels)) {
                                result.value.labels.forEach(label => {
                                    if (validLabels.includes(label)) {
                                        labelTypes.add(label);
                                        annotations.push({
                                            id: `${taskIndex}_${annotation.id}_${result.id || Math.random()}_${label}`,
                                            taskId: task.id || taskIndex,
                                            annotationId: annotation.id,
                                            studentId: annotatorName,
                                            label: label,
                                            confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                            timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                            startOffset: result.value.start,
                                            endOffset: result.value.end
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        return {
            annotations: annotations,
            annotators: Array.from(annotators),
            labelTypes: Array.from(labelTypes),
            taskCount: tasks.length
        };
    },
    
    /**
     * Count annotations in data
     */
    countAnnotations: function(data) {
        let count = 0;
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.annotations && Array.isArray(item.annotations)) {
                    count += item.annotations.length;
                } else if (item.result) {
                    count++;
                }
            });
        }
        return count;
    }
};

/**
 * Get color for GKCCI parameter
 */
function getGKCCIColor(parameter) {
    return window.gkcciParameters[parameter] || '#999999';
}

/**
 * Calculate GKCCI parameter distribution
 */
function calculateGKCCIDistribution(annotations) {
    const distribution = {};
    Object.keys(window.gkcciParameters).forEach(param => {
        distribution[param] = 0;
    });
    
    if (annotations && Array.isArray(annotations)) {
        annotations.forEach(ann => {
            if (distribution.hasOwnProperty(ann.label)) {
                distribution[ann.label]++;
            }
        });
    }
    
    return distribution;
}

/**
 * Filter annotations by policy
 */
function filterAnnotationsByPolicy(annotations, policyName) {
    if (!annotations || policyName === 'all') return annotations;
    
    return annotations.filter(ann => ann.project === policyName);
}

/**
 * Filter annotations by student
 */
function filterAnnotationsByStudent(annotations, studentName) {
    if (!annotations || studentName === 'all') return annotations;
    
    return annotations.filter(ann => 
        ann.studentId === studentName || 
        ann.studentEmail === studentName
    );
}

/**
 * Debounce function for search/filter inputs
 */
function createDebounce(func, wait) {
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
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

/**
 * Format time ago
 */
function timeAgo(dateString) {
    if (!dateString) return 'Unknown';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return formatDate(dateString);
    } catch (error) {
        return 'Unknown';
    }
}

/**
 * Generate sample GKCCI privacy policy text
 */
function generateSampleGKCCIText() {
    const samples = [
        "We (Sender) collect your email address (Information Type) about user accounts (Subject) and send it to marketing partners (Recipient) for promotional campaigns (Aim) under user consent (Condition) with automated processing (Modalities) resulting in targeted advertisements (Consequence).",
        "The platform (Sender) processes location data (Information Type) regarding user movements (Subject) and shares it with analytics services (Recipient) for business intelligence (Aim) when users opt-in (Condition) via secure APIs (Modalities) enabling personalized recommendations (Consequence).",
        "Your app (Sender) collects usage analytics (Information Type) about user behavior (Subject) and transmits them to research institutions (Recipient) for academic studies (Aim) under anonymization procedures (Condition) with statistical analysis (Modalities) resulting in research publications (Consequence)."
    ];
    return samples[Math.floor(Math.random() * samples.length)];
}

/**
 * Initialize utility functions
 */
function initializeUtilities() {
    console.log('GKCCI utility functions initialized');
    console.log('Available GKCCI parameters:', Object.keys(window.gkcciParameters));
    
    // Add global error handler for debugging
    window.addEventListener('error', function(event) {
        console.error('JavaScript Error:', event.error);
    });
}

// Auto-initialize when script loads
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUtilities);
    } else {
        initializeUtilities();
    }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PolicyManager: window.PolicyManager,
        UIHelpers: window.UIHelpers,
        DataProcessor: window.DataProcessor,
        getGKCCIColor,
        calculateGKCCIDistribution,
        filterAnnotationsByPolicy,
        filterAnnotationsByStudent,
        createDebounce,
        formatDate,
        timeAgo,
        generateSampleGKCCIText
    };
}