// Chart Management for Privacy Policy Dashboard

// Global chart instances
let labelChart = null;
let consistencyChart = null;

/**
 * Initialize all charts when the page loads
 */
function initializeCharts() {
    initializeLabelChart();
    initializeConsistencyChart();
}

/**
 * Initialize the label distribution donut chart
 */
function initializeLabelChart() {
    const canvas = document.getElementById('labelChart');
    if (!canvas) {
        console.error('Label chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    
    labelChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 0,
                hoverOffset: 10,
                hoverBorderWidth: 3,
                hoverBorderColor: '#fff'
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
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            }
        }
    });
}

/**
 * Initialize the consistency/agreement line chart
 */
function initializeConsistencyChart() {
    const canvas = document.getElementById('consistencyChart');
    if (!canvas) {
        console.error('Consistency chart canvas not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    
    consistencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Agreement Score',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Agreement: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

/**
 * Update the label distribution chart with current data
 */
function updateLabelChart() {
    if (!labelChart || !window.labelingData.annotations) return;

    const labelCounts = {};
    
    // Count occurrences of each label
    window.labelingData.annotations.forEach(annotation => {
        const label = annotation.label;
        labelCounts[label] = (labelCounts[label] || 0) + 1;
    });

    // Sort labels by count (descending)
    const sortedLabels = Object.entries(labelCounts)
        .sort(([,a], [,b]) => b - a)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    const labels = Object.keys(sortedLabels);
    const data = Object.values(sortedLabels);
    const colors = labels.map(label => window.labelColors[label] || '#999999');

    // Update chart data
    labelChart.data.labels = labels;
    labelChart.data.datasets[0].data = data;
    labelChart.data.datasets[0].backgroundColor = colors;
    
    labelChart.update('active');
}

/**
 * Update the consistency chart with agreement data over time
 */
function updateConsistencyChart() {
    if (!consistencyChart || !window.labelingData.annotations) return;

    const monthlyAgreement = {};
    
    // Group annotations by month and calculate average confidence
    window.labelingData.annotations.forEach(annotation => {
        const date = new Date(annotation.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyAgreement[monthKey]) {
            monthlyAgreement[monthKey] = [];
        }
        monthlyAgreement[monthKey].push(parseFloat(annotation.confidence));
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyAgreement).sort();
    
    // Calculate average agreement for each month
    const agreementScores = sortedMonths.map(month => {
        const scores = monthlyAgreement[month];
        return (scores.reduce((sum, score) => sum + score, 0) / scores.length);
    });

    // Format month labels for display
    const monthLabels = sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    // Update chart data
    consistencyChart.data.labels = monthLabels;
    consistencyChart.data.datasets[0].data = agreementScores;
    
    consistencyChart.update('active');
}

/**
 * Update consistency metrics displayed in the dashboard
 */
function updateMetrics() {
    const annotations = window.labelingData.annotations;
    if (!annotations || annotations.length === 0) {
        // Set default values when no data
        updateMetricElement('overallAgreement', '0%');
        updateMetricElement('kappaScore', '0.00');
        updateMetricElement('totalLabels', '0');
        updateMetricElement('activeAnnotators', '0');
        return;
    }

    // Calculate overall agreement (average confidence)
    const totalLabels = annotations.length;
    const avgConfidence = annotations.reduce((sum, ann) => sum + parseFloat(ann.confidence), 0) / totalLabels;
    
    // Count unique annotators
    const activeAnnotators = new Set(annotations.map(ann => ann.studentId)).size;
    
    // Calculate Cohen's Kappa (simplified approximation)
    const kappaScore = calculateKappa(annotations);
    
    // Update the displayed metrics
    updateMetricElement('overallAgreement', avgConfidence.toFixed(1) + '%');
    updateMetricElement('kappaScore', kappaScore);
    updateMetricElement('totalLabels', totalLabels.toLocaleString());
    updateMetricElement('activeAnnotators', activeAnnotators.toString());
}

/**
 * Helper function to update a metric element safely
 * @param {string} elementId - ID of the element to update
 * @param {string} value - New value to display
 */
function updateMetricElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Update student performance details
 */
function updateStudentDetails() {
    const studentDetails = document.getElementById('studentDetails');
    if (!studentDetails || !window.labelingData.students) return;

    studentDetails.innerHTML = '';

    // If no students, show empty state
    if (window.labelingData.students.length === 0) {
        studentDetails.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No student data available. Please load some data first.</p>';
        return;
    }

    window.labelingData.students.forEach(student => {
        // Find annotations for this student
        const studentAnnotations = window.labelingData.annotations.filter(ann => {
            return ann.studentId === student.id || 
                   ann.studentId === student.name || 
                   ann.studentId === student.email;
        });

        // Count labels for this student
        const labelCounts = {};
        studentAnnotations.forEach(ann => {
            labelCounts[ann.label] = (labelCounts[ann.label] || 0) + 1;
        });

        // Calculate average confidence for this student
        const avgConfidence = studentAnnotations.length > 0 ? 
            studentAnnotations.reduce((sum, ann) => sum + parseFloat(ann.confidence), 0) / studentAnnotations.length : 0;

        // Create student row element
        const row = document.createElement('div');
        row.className = 'student-row';
        
        // Get top 3 labels for this student
        const topLabels = Object.entries(labelCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        row.innerHTML = `
            <div class="student-name">${student.name}</div>
            <div class="label-distribution">
                ${topLabels.map(([label, count]) => 
                    `<span class="label-pill" style="background-color: ${window.labelColors[label] || '#999'}">${label}: ${count}</span>`
                ).join('')}
                ${topLabels.length === 0 ? '<span style="color: #999;">No labels yet</span>' : ''}
            </div>
            <div class="agreement-score">${avgConfidence.toFixed(1)}%</div>
        `;
        
        studentDetails.appendChild(row);
    });
}

/**
 * Update all visualizations (called after data changes)
 */
function updateVisualizations() {
    updateLabelChart();
    updateConsistencyChart();
    updateMetrics();
    updateStudentDetails();
}

/**
 * Create a simple bar chart for comparing students (future enhancement)
 * @param {string} canvasId - ID of the canvas element
 * @param {Array} students - Array of student data
 */
function createStudentComparisonChart(canvasId, students) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !students || students.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    // Prepare data for student comparison
    const studentNames = students.map(s => s.name.split(' ')[0]); // First names only
    const studentScores = students.map(s => parseFloat(s.accuracy));
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: studentNames,
            datasets: [{
                label: 'Accuracy Score',
                data: studentScores,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: '#667eea',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Accuracy: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Resize charts when window size changes
 */
function handleChartResize() {
    if (labelChart) labelChart.resize();
    if (consistencyChart) consistencyChart.resize();
}

/**
 * Destroy charts when cleaning up
 */
function destroyCharts() {
    if (labelChart) {
        labelChart.destroy();
        labelChart = null;
    }
    if (consistencyChart) {
        consistencyChart.destroy();
        consistencyChart = null;
    }
}

// Event listeners for responsive design
window.addEventListener('resize', debounce(handleChartResize, 300));

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Chart.js to be available
    if (typeof Chart !== 'undefined') {
        initializeCharts();
    } else {
        // If Chart.js isn't loaded yet, wait for it
        const checkChart = setInterval(() => {
            if (typeof Chart !== 'undefined') {
                clearInterval(checkChart);
                initializeCharts();
            }
        }, 100);
    }
});