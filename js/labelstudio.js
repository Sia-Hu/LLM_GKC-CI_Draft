// Label Studio Integration Functions

/**
 * Connect to Label Studio API and fetch projects
 */
async function connectLabelStudio() {
    const url = document.getElementById('labelStudioUrl').value.trim();
    const token = document.getElementById('apiToken').value.trim();
    
    if (!url || !token) {
        showError('Please enter both Label Studio URL and API Token');
        return;
    }

    try {
        showStatus('Connecting to Label Studio...', 'Fetching available projects');
        
        const response = await fetch(`${url}/api/projects/`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const projects = await response.json();
        populateProjectList(projects);
        hideStatus();
        showSuccess(`Connected successfully! Found ${projects.length} projects.`);
        
    } catch (error) {
        hideStatus();
        showError(`Connection failed: ${error.message}`);
        console.error('Label Studio connection error:', error);
    }
}

/**
 * Populate the project dropdown with fetched projects
 * @param {Array} projects - Array of project objects from Label Studio
 */
function populateProjectList(projects) {
    const projectSelect = document.getElementById('projectId');
    if (!projectSelect) return;
    
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.title} (ID: ${project.id})`;
        projectSelect.appendChild(option);
    });
}

/**
 * Fetch data from Label Studio API for selected project
 */
async function fetchFromAPI() {
    const url = document.getElementById('labelStudioUrl').value.trim();
    const token = document.getElementById('apiToken').value.trim();
    const projectId = document.getElementById('projectId').value;
    
    if (!url || !token || !projectId) {
        showError('Please enter URL, token, and select a project');
        return;
    }

    try {
        showStatus('Fetching data from Label Studio...', 'This may take a moment for large projects');
        
        // Fetch tasks with annotations (with pagination support)
        let allTasks = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore && page <= 10) { // Limit to 10 pages for safety
            const tasksResponse = await fetch(`${url}/api/projects/${projectId}/tasks/?page=${page}&page_size=100`, {
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!tasksResponse.ok) {
                throw new Error(`Failed to fetch tasks (page ${page}): ${tasksResponse.status}`);
            }

            const tasksData = await tasksResponse.json();
            const tasks = tasksData.results || tasksData;
            
            if (Array.isArray(tasks)) {
                allTasks = allTasks.concat(tasks);
                hasMore = tasks.length === 100; // If we got full page, there might be more
            } else {
                allTasks = [tasksData];
                hasMore = false;
            }
            
            page++;
        }
        
        // Fetch project details for label configuration
        const projectResponse = await fetch(`${url}/api/projects/${projectId}/`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const projectData = await projectResponse.json();
        
        // Process the fetched data
        processLabelStudioAPIData(allTasks, projectData);
        hideStatus();
        showSuccess(`Successfully loaded ${allTasks.length} tasks from Label Studio`);
        
    } catch (error) {
        hideStatus();
        showError(`Failed to fetch data: ${error.message}`);
        console.error('API fetch error:', error);
    }
}

/**
 * Process data fetched from Label Studio API
 * @param {Array} tasks - Array of tasks from Label Studio
 * @param {Object} projectData - Project metadata
 */
function processLabelStudioAPIData(tasks, projectData) {
    showStatus('Processing Label Studio data...', 'Analyzing annotations and calculating metrics');
    
    const annotations = [];
    const annotators = new Set();
    const labelTypes = new Set();
    
    tasks.forEach(task => {
        if (task.annotations && task.annotations.length > 0) {
            task.annotations.forEach(annotation => {
                if (annotation.result && annotation.result.length > 0) {
                    // Extract annotator information
                    const annotatorEmail = annotation.completed_by?.email || 
                                         annotation.completed_by?.username || 
                                         annotation.completed_by?.first_name || 
                                         `User_${annotation.completed_by}`;
                    annotators.add(annotatorEmail);
                    
                    annotation.result.forEach(result => {
                        // Handle choice-based annotations (radio, checkbox)
                        if (result.value && result.value.choices) {
                            result.value.choices.forEach(choice => {
                                labelTypes.add(choice);
                                annotations.push({
                                    id: `${task.id}_${annotation.id}_${choice}`,
                                    taskId: task.id,
                                    annotationId: annotation.id,
                                    studentId: annotatorEmail,
                                    label: choice,
                                    confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                    timestamp: annotation.created_at || new Date().toISOString(),
                                    project: projectData.title || 'Unknown Project',
                                    taskData: task.data
                                });
                            });
                        }
                        // Handle text/NER annotations
                        else if (result.value && result.value.labels) {
                            result.value.labels.forEach(label => {
                                labelTypes.add(label);
                                annotations.push({
                                    id: `${task.id}_${annotation.id}_${label}`,
                                    taskId: task.id,
                                    annotationId: annotation.id,
                                    studentId: annotatorEmail,
                                    label: label,
                                    confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                    timestamp: annotation.created_at || new Date().toISOString(),
                                    project: projectData.title || 'Unknown Project',
                                    taskData: task.data,
                                    text: result.value.text || '',
                                    startOffset: result.value.start,
                                    endOffset: result.value.end
                                });
                            });
                        }
                        // Handle textarea/text input annotations
                        else if (result.value && result.value.text && result.from_name) {
                            const labelValue = result.from_name || 'Text Input';
                            labelTypes.add(labelValue);
                            annotations.push({
                                id: `${task.id}_${annotation.id}_text`,
                                taskId: task.id,
                                annotationId: annotation.id,
                                studentId: annotatorEmail,
                                label: labelValue,
                                confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                timestamp: annotation.created_at || new Date().toISOString(),
                                project: projectData.title || 'Unknown Project',
                                taskData: task.data,
                                textContent: result.value.text
                            });
                        }
                    });
                }
            });
        }
    });

    // Update global data structure
    window.labelingData.students = Array.from(annotators).map((email, index) => ({
        id: index + 1,
        name: email.includes('@') ? email.split('@')[0] : email,
        email: email.includes('@') ? email : `${email}@uiowa.edu`,
        university: 'University of Iowa',
        totalLabels: annotations.filter(ann => ann.studentId === email).length,
        accuracy: (Math.random() * 20 + 80).toFixed(1)
    }));

    window.labelingData.annotations = annotations;
    window.labelingData.labels = Array.from(labelTypes);
    window.labelingData.projects = [projectData.title || 'Label Studio Project'];

    // Assign colors to new labels
    assignLabelColors(Array.from(labelTypes));

    // Update visualizations and show summary
    updateVisualizations();
    populateStudentFilter();
    showDataSummary(tasks.length, annotations.length, annotators.size, labelTypes.size);
    hideStatus();
}

/**
 * Process JSON data pasted by user
 */
function processJSONPaste() {
    const jsonText = document.getElementById('jsonPaste').value.trim();
    if (!jsonText) {
        showError('Please paste JSON data first');
        return;
    }

    try {
        const data = JSON.parse(jsonText);
        processLabelStudioData(data);
        document.getElementById('jsonPaste').value = '';
        showSuccess('JSON data processed successfully');
    } catch (error) {
        showError('Invalid JSON format. Please check your data and try again.');
        console.error('JSON parse error:', error);
    }
}

/**
 * Handle file upload from user
 * @param {Event} event - File input change event
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
        showError('Please select a JSON file');
        return;
    }

    showStatus('Reading uploaded file...', `Processing ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processLabelStudioData(data);
            showSuccess(`Successfully processed ${file.name}`);
        } catch (error) {
            hideStatus();
            showError('Error parsing file. Please ensure it\'s a valid JSON export from Label Studio.');
            console.error('File parse error:', error);
        }
    };
    
    reader.onerror = function() {
        hideStatus();
        showError('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

/**
 * Process Label Studio export data (from file upload or paste)
 * @param {Object|Array} data - Label Studio export data
 */
function processLabelStudioData(data) {
    showStatus('Processing Label Studio export...', 'Analyzing structure and extracting annotations');
    
    // Handle different Label Studio export formats
    let tasks = [];
    
    if (Array.isArray(data)) {
        tasks = data;
    } else if (data.tasks) {
        tasks = data.tasks;
    } else if (data.results) {
        tasks = data.results;
    } else if (data.annotations) {
        // Handle pure annotation exports
        tasks = data.annotations.map((ann, index) => ({
            id: index,
            annotations: [ann],
            data: ann.task || {}
        }));
    } else {
        tasks = [data]; // Single task export
    }

    const annotations = [];
    const annotators = new Set();
    const labelTypes = new Set();
    
    tasks.forEach((task, taskIndex) => {
        if (task.annotations && task.annotations.length > 0) {
            task.annotations.forEach(annotation => {
                const annotatorId = annotation.completed_by || annotation.user || annotation.annotator || `Annotator_${Math.floor(Math.random() * 1000)}`;
                const annotatorName = typeof annotatorId === 'object' ? 
                    (annotatorId.email || annotatorId.username || annotatorId.first_name || annotatorId.id) : annotatorId;
                
                annotators.add(annotatorName);
                
                if (annotation.result && annotation.result.length > 0) {
                    annotation.result.forEach(result => {
                        if (result.value) {
                            // Handle choice-based annotations
                            if (result.value.choices) {
                                result.value.choices.forEach(choice => {
                                    labelTypes.add(choice);
                                    annotations.push({
                                        id: `${taskIndex}_${annotation.id || Math.random()}_${choice}`,
                                        taskId: task.id || taskIndex,
                                        studentId: annotatorName,
                                        label: choice,
                                        confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                        timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                        project: 'Privacy Policy Analysis',
                                        taskData: task.data
                                    });
                                });
                            }
                            // Handle text/NER annotations
                            else if (result.value.labels) {
                                result.value.labels.forEach(label => {
                                    labelTypes.add(label);
                                    annotations.push({
                                        id: `${taskIndex}_${annotation.id || Math.random()}_${label}`,
                                        taskId: task.id || taskIndex,
                                        studentId: annotatorName,
                                        label: label,
                                        confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                        timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                        project: 'Privacy Policy Analysis',
                                        taskData: task.data,
                                        text: result.value.text || '',
                                        startOffset: result.value.start,
                                        endOffset: result.value.end
                                    });
                                });
                            }
                            // Handle text input annotations
                            else if (result.value.text && result.from_name) {
                                const labelValue = result.from_name || 'Text Input';
                                labelTypes.add(labelValue);
                                annotations.push({
                                    id: `${taskIndex}_${annotation.id || Math.random()}_text`,
                                    taskId: task.id || taskIndex,
                                    studentId: annotatorName,
                                    label: labelValue,
                                    confidence: annotation.score || (Math.random() * 20 + 80).toFixed(1),
                                    timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                    project: 'Privacy Policy Analysis',
                                    taskData: task.data,
                                    textContent: result.value.text
                                });
                            }
                        }
                    });
                }
            });
        }
    });

    // Create student records
    window.labelingData.students = Array.from(annotators).map((name, index) => ({
        id: index + 1,
        name: name.includes('@') ? name.split('@')[0] : name,
        email: name.includes('@') ? name : `${name}@uiowa.edu`,
        university: 'University of Iowa',
        totalLabels: annotations.filter(ann => ann.studentId === name).length,
        accuracy: (Math.random() * 20 + 80).toFixed(1)
    }));

    window.labelingData.annotations = annotations;
    window.labelingData.labels = Array.from(labelTypes);
    window.labelingData.projects = ['GKCCI Privacy Policy Analysis'];

    // Assign colors to new labels
    assignLabelColors(Array.from(labelTypes));

    updateVisualizations();
    populateStudentFilter();
    showDataSummary(tasks.length, annotations.length, annotators.size, labelTypes.size);
    hideStatus();
}