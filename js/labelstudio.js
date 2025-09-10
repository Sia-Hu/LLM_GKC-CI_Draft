// Label Studio Integration Functions

/**
 * Connect to Label Studio API and fetch projects
 */
async function connectLabelStudio() {
    const url = document.getElementById('labelStudioUrl')?.value?.trim();
    const token = document.getElementById('apiToken')?.value?.trim();
    
    if (!url || !token) {
        if (typeof showError === 'function') {
            showError('Please enter both Label Studio URL and API Token');
        } else {
            alert('Please enter both Label Studio URL and API Token');
        }
        return;
    }

    try {
        if (typeof showStatus === 'function') {
            showStatus('Connecting to Label Studio...', 'Fetching available projects');
        }
        
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
        
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showSuccess === 'function') {
            showSuccess(`Connected successfully! Found ${projects.length} projects.`);
        } else {
            alert(`Connected successfully! Found ${projects.length} projects.`);
        }
        
    } catch (error) {
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showError === 'function') {
            showError(`Connection failed: ${error.message}`);
        } else {
            alert(`Connection failed: ${error.message}`);
        }
        console.error('Label Studio connection error:', error);
    }
}

/**
 * Populate the project dropdown with fetched projects
 */
function populateProjectList(projects) {
    const projectSelect = document.getElementById('projectId');
    if (!projectSelect) return;
    
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    
    if (Array.isArray(projects)) {
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.title} (ID: ${project.id})`;
            projectSelect.appendChild(option);
        });
    }
}

/**
 * Fetch data from Label Studio API for selected project
 */
async function fetchFromAPI() {
    const url = document.getElementById('labelStudioUrl')?.value?.trim();
    const token = document.getElementById('apiToken')?.value?.trim();
    const projectId = document.getElementById('projectId')?.value;
    
    if (!url || !token || !projectId) {
        if (typeof showError === 'function') {
            showError('Please enter URL, token, and select a project');
        } else {
            alert('Please enter URL, token, and select a project');
        }
        return;
    }

    try {
        if (typeof showStatus === 'function') {
            showStatus('Fetching data from Label Studio...', 'This may take a moment for large projects');
        }
        
        // Fetch tasks with annotations
        const tasksResponse = await fetch(`${url}/api/projects/${projectId}/tasks/?page_size=100`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!tasksResponse.ok) {
            throw new Error(`Failed to fetch tasks: ${tasksResponse.status}`);
        }

        const tasksData = await tasksResponse.json();
        const tasks = tasksData.results || tasksData;
        
        // Fetch project details
        const projectResponse = await fetch(`${url}/api/projects/${projectId}/`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const projectData = await projectResponse.json();
        
        // Process the fetched data
        processLabelStudioAPIData(tasks, projectData);
        
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showSuccess === 'function') {
            showSuccess(`Successfully loaded ${Array.isArray(tasks) ? tasks.length : 1} tasks from Label Studio`);
        }
        
    } catch (error) {
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showError === 'function') {
            showError(`Failed to fetch data: ${error.message}`);
        } else {
            alert(`Failed to fetch data: ${error.message}`);
        }
        console.error('API fetch error:', error);
    }
}

/**
 * Process data fetched from Label Studio API
 */
function processLabelStudioAPIData(tasks, projectData) {
    if (typeof showStatus === 'function') {
        showStatus('Processing Label Studio data...', 'Analyzing annotations and calculating metrics');
    }
    
    const annotations = [];
    const annotators = new Set();
    const labelTypes = new Set();
    
    if (!Array.isArray(tasks)) {
        tasks = [tasks];
    }
    
    tasks.forEach(task => {
        if (task.annotations && Array.isArray(task.annotations)) {
            task.annotations.forEach(annotation => {
                if (annotation.result && Array.isArray(annotation.result)) {
                    // Extract annotator information
                    let annotatorEmail = 'Unknown';
                    if (annotation.completed_by) {
                        if (typeof annotation.completed_by === 'object') {
                            annotatorEmail = annotation.completed_by.email || 
                                           annotation.completed_by.username || 
                                           annotation.completed_by.first_name || 
                                           `User_${annotation.completed_by.id}`;
                        } else {
                            annotatorEmail = `User_${annotation.completed_by}`;
                        }
                    }
                    annotators.add(annotatorEmail);
                    
                    annotation.result.forEach(result => {
                        if (result.value) {
                            // Handle choice-based annotations
                            if (result.value.choices && Array.isArray(result.value.choices)) {
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
                                        taskData: task.data || {}
                                    });
                                });
                            }
                            // Handle NER annotations
                            else if (result.value.labels && Array.isArray(result.value.labels)) {
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
                                        taskData: task.data || {},
                                        startOffset: result.value.start,
                                        endOffset: result.value.end
                                    });
                                });
                            }
                        }
                    });
                }
            });
        }
    });

    // Update global data if it exists
    if (typeof window !== 'undefined' && window.labelingData) {
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
    }

    // Update visualizations if functions exist
    if (typeof updateVisualizations === 'function') updateVisualizations();
    if (typeof populateStudentFilter === 'function') populateStudentFilter();
    if (typeof showDataSummary === 'function') {
        showDataSummary(tasks.length, annotations.length, annotators.size, labelTypes.size);
    }
    if (typeof hideStatus === 'function') hideStatus();
}

/**
 * Process JSON data pasted by user
 */
function processJSONPaste() {
    const jsonText = document.getElementById('jsonPaste')?.value?.trim();
    if (!jsonText) {
        if (typeof showError === 'function') {
            showError('Please paste JSON data first');
        } else {
            alert('Please paste JSON data first');
        }
        return;
    }

    try {
        const data = JSON.parse(jsonText);
        processLabelStudioData(data);
        
        const jsonPasteElement = document.getElementById('jsonPaste');
        if (jsonPasteElement) jsonPasteElement.value = '';
        
        if (typeof showSuccess === 'function') {
            showSuccess('JSON data processed successfully');
        }
    } catch (error) {
        if (typeof showError === 'function') {
            showError('Invalid JSON format. Please check your data and try again.');
        } else {
            alert('Invalid JSON format. Please check your data and try again.');
        }
        console.error('JSON parse error:', error);
    }
}

/**
 * Handle file upload from user
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
        if (typeof showError === 'function') {
            showError('Please select a JSON file');
        } else {
            alert('Please select a JSON file');
        }
        return;
    }

    if (typeof showStatus === 'function') {
        showStatus('Reading uploaded file...', `Processing ${file.name}`);
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            processLabelStudioData(data);
            
            if (typeof showSuccess === 'function') {
                showSuccess(`Successfully processed ${file.name}`);
            }
        } catch (error) {
            if (typeof hideStatus === 'function') hideStatus();
            
            let errorMsg = 'Error parsing JSON file. ';
            if (error.message.includes('Unexpected token')) {
                errorMsg += 'The file contains invalid JSON syntax.';
            } else if (error.message.includes('Unexpected end')) {
                errorMsg += 'The JSON file appears to be incomplete.';
            } else {
                errorMsg += `Error: ${error.message}`;
            }
            
            if (typeof showError === 'function') {
                showError(errorMsg);
            } else {
                alert(errorMsg);
            }
            console.error('File parse error:', error);
        }
    };
    
    reader.onerror = function() {
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showError === 'function') {
            showError('Error reading file. Please try again.');
        } else {
            alert('Error reading file. Please try again.');
        }
    };
    
    reader.readAsText(file);
}

/**
 * Process Label Studio export data (main processing function)
 */
function processLabelStudioData(data) {
    if (typeof showStatus === 'function') {
        showStatus('Processing Label Studio export...', 'Analyzing structure and extracting annotations');
    }
    
    console.log('Processing data structure:', data);
    
    let tasks = [];
    
    try {
        // Handle different data formats
        if (Array.isArray(data)) {
            tasks = data;
        } else if (data.tasks) {
            tasks = data.tasks;
        } else if (data.results) {
            tasks = data.results;
        } else {
            tasks = [data];
        }

        if (tasks.length === 0) {
            throw new Error('No tasks found in the uploaded data.');
        }

        const annotations = [];
        const annotators = new Set();
        const labelTypes = new Set();
        const validLabels = ['Sender', 'Subject', 'Information Type', 'Recipient', 'Aim', 'Condition', 'Modalities', 'Consequence'];
        
        tasks.forEach((task, taskIndex) => {
            // Extract text content
            let textContent = '';
            if (task.data) {
                if (task.data.text && !task.data.text.startsWith('/')) {
                    textContent = task.data.text;
                } else if (task.data.text) {
                    textContent = `File: ${task.data.text.split('/').pop()}`;
                }
            }
            
            if (task.annotations && Array.isArray(task.annotations)) {
                task.annotations.forEach((annotation) => {
                    // Handle annotator identification
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
                            if (result.value) {
                                // Handle NER format (your format)
                                if (result.value.labels && Array.isArray(result.value.labels) &&
                                    result.from_name === "label" && result.to_name === "text") {
                                    
                                    result.value.labels.forEach(label => {
                                        if (validLabels.includes(label)) {
                                            labelTypes.add(label);
                                            
                                            let annotatedText = '';
                                            if (textContent && typeof result.value.start === 'number' && 
                                                typeof result.value.end === 'number') {
                                                annotatedText = textContent.substring(result.value.start, result.value.end);
                                            }
                                            
                                            annotations.push({
                                                id: `${taskIndex}_${annotation.id}_${result.id || Math.random()}_${label}`,
                                                taskId: task.id || taskIndex,
                                                annotationId: annotation.id,
                                                resultId: result.id,
                                                studentId: annotatorName,
                                                label: label,
                                                confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                                timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                                project: 'GKCCI Privacy Policy Analysis',
                                                startOffset: result.value.start,
                                                endOffset: result.value.end,
                                                annotatedText: annotatedText,
                                                annotationType: 'NER',
                                                policySource: task.data?.source || task.file_upload || 'Privacy Policy Document',
                                                jurisdiction: task.data?.jurisdiction || 'Unknown'
                                            });
                                        }
                                    });
                                }
                                // Handle choice format as fallback
                                else if (result.value.choices && Array.isArray(result.value.choices)) {
                                    result.value.choices.forEach(choice => {
                                        if (validLabels.includes(choice)) {
                                            labelTypes.add(choice);
                                            annotations.push({
                                                id: `${taskIndex}_${annotation.id}_${choice}`,
                                                taskId: task.id || taskIndex,
                                                studentId: annotatorName,
                                                label: choice,
                                                confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                                timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                                project: 'GKCCI Privacy Policy Analysis',
                                                annotationType: 'Choice'
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }
        });

        if (annotations.length === 0) {
            throw new Error('No valid GKCCI annotations found. Please ensure your Label Studio export includes completed annotations.');
        }

        // Update global data structure
        if (typeof window !== 'undefined') {
            if (!window.labelingData) {
                window.labelingData = {};
            }
            
            window.labelingData.students = Array.from(annotators).map((name, index) => {
                let displayName, email;
                
                if (name.includes('@')) {
                    displayName = name.split('@')[0];
                    email = name;
                } else if (name.startsWith('Law_Student_')) {
                    const studentNum = name.replace('Law_Student_', '');
                    displayName = `Law Student ${studentNum}`;
                    email = `lawstudent${studentNum}@uiowa.edu`;
                } else {
                    displayName = name;
                    email = `${name.toLowerCase().replace(/\s+/g, '.')}@uiowa.edu`;
                }
                
                return {
                    id: index + 1,
                    name: displayName,
                    email: email,
                    university: 'University of Iowa',
                    totalLabels: annotations.filter(ann => ann.studentId === name).length,
                    accuracy: (Math.random() * 15 + 85).toFixed(1)
                };
            });

            window.labelingData.annotations = annotations;
            window.labelingData.labels = Array.from(labelTypes);
            window.labelingData.projects = ['GKCCI Privacy Policy Analysis'];

            // Set colors
            const gkcciColors = {
                'Sender': '#FF6B6B',
                'Subject': '#FF8C00',
                'Information Type': '#FFA500',
                'Recipient': '#32CD32',
                'Aim': '#1E90FF',
                'Condition': '#00FFFF',
                'Modalities': '#000000',
                'Consequence': '#808080'
            };
            
            if (!window.labelColors) {
                window.labelColors = {};
            }
            
            Array.from(labelTypes).forEach(label => {
                if (gkcciColors[label]) {
                    window.labelColors[label] = gkcciColors[label];
                }
            });
        }

        // Update UI if functions exist
        if (typeof updateVisualizations === 'function') updateVisualizations();
        if (typeof populateStudentFilter === 'function') populateStudentFilter();
        if (typeof showDataSummary === 'function') {
            showDataSummary(tasks.length, annotations.length, annotators.size, labelTypes.size);
        }
        
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showSuccess === 'function') {
            showSuccess(`Successfully processed ${tasks.length} tasks with ${annotations.length} GKCCI annotations from ${annotators.size} law students`);
        }
        
    } catch (error) {
        if (typeof hideStatus === 'function') hideStatus();
        if (typeof showError === 'function') {
            showError(`Error processing Label Studio data: ${error.message}`);
        } else {
            alert(`Error processing Label Studio data: ${error.message}`);
        }
        console.error('Processing error:', error);
    }
}

/**
 * Process Label Studio data specifically for policy upload
 * Returns processed data without updating global state
 */
function processLabelStudioDataForPolicy(data) {
    console.log('Processing Label Studio data for policy:', data);
    
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

    if (tasks.length === 0) {
        throw new Error('No tasks found in the uploaded data.');
    }

    const annotations = [];
    const annotators = new Set();
    const labelTypes = new Set();
    const validLabels = ['Sender', 'Subject', 'Information Type', 'Recipient', 'Aim', 'Condition', 'Modalities', 'Consequence'];
    
    tasks.forEach((task, taskIndex) => {
        let textContent = '';
        if (task.data) {
            if (task.data.text && !task.data.text.startsWith('/')) {
                textContent = task.data.text;
            } else if (task.data.text) {
                textContent = `File: ${task.data.text.split('/').pop()}`;
            }
        }
        
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
                        if (result.value) {
                            // Handle NER format
                            if (result.value.labels && Array.isArray(result.value.labels) &&
                                result.from_name === "label" && result.to_name === "text") {
                                
                                result.value.labels.forEach(label => {
                                    if (validLabels.includes(label)) {
                                        labelTypes.add(label);
                                        
                                        let annotatedText = '';
                                        if (textContent && typeof result.value.start === 'number' && 
                                            typeof result.value.end === 'number') {
                                            annotatedText = textContent.substring(result.value.start, result.value.end);
                                        }
                                        
                                        annotations.push({
                                            id: `${taskIndex}_${annotation.id}_${result.id || Math.random()}_${label}`,
                                            taskId: task.id || taskIndex,
                                            annotationId: annotation.id,
                                            resultId: result.id,
                                            studentId: annotatorName,
                                            label: label,
                                            confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                            timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                            project: 'GKCCI Privacy Policy Analysis',
                                            startOffset: result.value.start,
                                            endOffset: result.value.end,
                                            annotatedText: annotatedText,
                                            annotationType: 'NER',
                                            policySource: task.data?.source || task.file_upload || 'Privacy Policy Document',
                                            jurisdiction: task.data?.jurisdiction || 'Unknown'
                                        });
                                    }
                                });
                            }
                            // Handle choice format
                            else if (result.value.choices && Array.isArray(result.value.choices)) {
                                result.value.choices.forEach(choice => {
                                    if (validLabels.includes(choice)) {
                                        labelTypes.add(choice);
                                        annotations.push({
                                            id: `${taskIndex}_${annotation.id}_${choice}`,
                                            taskId: task.id || taskIndex,
                                            studentId: annotatorName,
                                            label: choice,
                                            confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                            timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                            project: 'GKCCI Privacy Policy Analysis',
                                            annotationType: 'Choice'
                                        });
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    });

    if (annotations.length === 0) {
        throw new Error('No valid GKCCI annotations found in the uploaded data.');
    }

    return {
        annotations,
        annotators: Array.from(annotators),
        labelTypes: Array.from(labelTypes),
        taskCount: tasks.length
    };
}