// Charts.js - Policy-Focused Dashboard Charts

(function() {
    'use strict';
    
    // Chart instances storage
    const chartInstances = {};
    
    // GKCCI Parameters with colors
    const GKCCI_COLORS = {
        'Sender': '#FF6B6B',
        'Subject': '#4ECDC4', 
        'Information Type': '#45B7D1',
        'Recipient': '#96CEB4',
        'Aim': '#FFEAA7',
        'Condition': '#DDA0DD',
        'Modalities': '#98D8C8',
        'Consequence': '#F7DC6F'
    };
    
    // Initialize charts when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Only initialize if Chart.js is available
        if (typeof Chart !== 'undefined') {
            setupChartDefaults();
            console.log('Charts.js initialized for policy dashboard');
        } else {
            console.warn('Chart.js library not loaded');
        }
    });
    
    function setupChartDefaults() {
        Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        Chart.defaults.color = '#333';
        Chart.defaults.plugins.legend.position = 'bottom';
        Chart.defaults.plugins.legend.labels.padding = 20;
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
    }
    
    function createGKCCIParameterChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        const labels = Object.keys(GKCCI_COLORS);
        const values = labels.map(label => data[label] || 0);
        const colors = labels.map(label => GKCCI_COLORS[label]);
        
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff',
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
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                elements: {
                    arc: {
                        borderWidth: 2
                    }
                }
            }
        });
        
        return chartInstances[canvasId];
    }
    
    function createTimelineChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Annotations Over Time',
                    data: data.values || [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            color: '#e1e5e9'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        border: {
                            color: '#e1e5e9'
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#667eea'
                    }
                }
            }
        });
        
        return chartInstances[canvasId];
    }
    
    function createStudentContributionChart(canvasId, studentData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        const students = Object.keys(studentData);
        const contributions = students.map(student => studentData[student]);
        
        // Generate colors for students
        const colors = students.map((_, index) => {
            const hue = (index * 137.508) % 360; // Golden angle approximation
            return `hsl(${hue}, 70%, 60%)`;
        });
        
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: students,
                datasets: [{
                    label: 'Annotations',
                    data: contributions,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color.replace('60%', '40%')),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            color: '#e1e5e9'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        border: {
                            color: '#e1e5e9'
                        }
                    }
                }
            }
        });
        
        return chartInstances[canvasId];
    }
    
    function createAgreementChart(canvasId, agreementData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart if it exists
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        // Generate sample agreement data if none provided
        const defaultData = Object.keys(GKCCI_COLORS).map(() => Math.random() * 30 + 70);
        
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(GKCCI_COLORS),
                datasets: [{
                    label: 'Inter-Annotator Agreement',
                    data: agreementData || defaultData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `Agreement: ${context.parsed.r.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
        
        return chartInstances[canvasId];
    }
    
    // Utility function to destroy all charts
    function destroyAllCharts() {
        Object.values(chartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        Object.keys(chartInstances).forEach(key => {
            delete chartInstances[key];
        });
    }
    
    // Utility function to resize all charts
    function resizeAllCharts() {
        Object.values(chartInstances).forEach(chart => {
            if (chart) chart.resize();
        });
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        setTimeout(resizeAllCharts, 100);
    });
    
    // Public API
    window.PolicyCharts = {
        createGKCCIParameterChart: createGKCCIParameterChart,
        createTimelineChart: createTimelineChart,
        createStudentContributionChart: createStudentContributionChart,
        createAgreementChart: createAgreementChart,
        destroyAllCharts: destroyAllCharts,
        resizeAllCharts: resizeAllCharts,
        getChartInstance: function(canvasId) {
            return chartInstances[canvasId];
        }
    };
    
})();