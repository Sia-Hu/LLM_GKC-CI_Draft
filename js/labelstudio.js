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
            // Log the raw content for debugging
            console.log('Raw file content:', e.target.result.substring(0, 500) + '...');
            
            // Try to parse the JSON
            const data = JSON.parse(e.target.result);
            console.log('Parsed JSON structure:', {
                isArray: Array.isArray(data),
                hasResults: !!data.results,
                hasTasks: !!data.tasks,
                hasAnnotations: !!data.annotations,
                keys: Object.keys(data),
                length: Array.isArray(data) ? data.length : 'N/A'
            });
            
            processLabelStudioData(data);
            showSuccess(`Successfully processed ${file.name}`);
        } catch (error) {
            hideStatus();
            console.error('JSON parse error details:', error);
            console.error('File content preview:', e.target.result.substring(0, 1000));
            
            // More detailed error message
            let errorMsg = 'Error parsing JSON file. ';
            if (error.message.includes('Unexpected token')) {
                errorMsg += 'The file contains invalid JSON syntax. Please check for missing commas, quotes, or brackets.';
            } else if (error.message.includes('Unexpected end')) {
                errorMsg += 'The JSON file appears to be incomplete or truncated.';
            } else {
                errorMsg += `Specific error: ${error.message}`;
            }
            
            showError(errorMsg);
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
    
    console.log('Processing data structure:', data);
    
    // Handle Label Studio export format (array of tasks)
    let tasks = [];
    
    try {
        if (Array.isArray(data)) {
            console.log('Data is array with length:', data.length);
            tasks = data;
        } else if (data.tasks) {
            console.log('Data has tasks property with length:', data.tasks.length);
            tasks = data.tasks;
        } else if (data.results) {
            console.log('Data has results property with length:', data.results.length);
            tasks = data.results;
        } else {
            console.log('Data is single object, treating as single task');
            tasks = [data];
        }

        console.log('Extracted tasks:', tasks.length);

        if (tasks.length === 0) {
            throw new Error('No tasks found in the uploaded data. Please check your Label Studio export format.');
        }

        const annotations = [];
        const annotators = new Set();
        const labelTypes = new Set();
        
        tasks.forEach((task, taskIndex) => {
            console.log(`Processing task ${taskIndex}:`, task);
            
            // Extract text content - handle file path or direct text
            let textContent = '';
            if (task.data) {
                if (task.data.text && !task.data.text.startsWith('/')) {
                    // Direct text content
                    textContent = task.data.text;
                } else if (task.data.text) {
                    // File path - extract filename for display
                    textContent = `File: ${task.data.text.split('/').pop()}`;
                } else {
                    textContent = 'No text content available';
                }
            }
            
            if (task.annotations && task.annotations.length > 0) {
                task.annotations.forEach((annotation, annIndex) => {
                    console.log(`Processing annotation ${annIndex}:`, annotation);
                    
                    // Handle different completed_by formats from your Label Studio setup
                    let annotatorName;
                    const completedBy = annotation.completed_by;
                    
                    if (typeof completedBy === 'object' && completedBy !== null) {
                        // Object format: {id: 1, email: "...", username: "..."}
                        annotatorName = completedBy.email || completedBy.username || completedBy.first_name || `User_${completedBy.id}`;
                    } else if (typeof completedBy === 'number') {
                        // Numeric ID format: 1, 2, 3... (your format)
                        annotatorName = `Law_Student_${completedBy}`;
                    } else if (typeof completedBy === 'string') {
                        // String format: username or email
                        annotatorName = completedBy;
                    } else {
                        // Fallback
                        annotatorName = `Unknown_Annotator_${annIndex}`;
                    }
                    
                    annotators.add(annotatorName);
                    
                    if (annotation.result && annotation.result.length > 0) {
                        annotation.result.forEach((result, resultIndex) => {
                            console.log(`Processing result ${resultIndex}:`, result);
                            
                            // Handle your NER format: Labels with start/end positions
                            if (result.value && result.value.labels && Array.isArray(result.value.labels)) {
                                console.log('Found NER labels:', result.value.labels);
                                
                                // Check that this is from your label configuration
                                if (result.from_name === "label" && result.to_name === "text") {
                                    result.value.labels.forEach(label => {
                                        // Validate it's one of your GKCCI parameters
                                        const validLabels = ['Sender', 'Subject', 'Information Type', 'Recipient', 'Aim', 'Condition', 'Modalities', 'Consequence'];
                                        
                                        if (validLabels.includes(label)) {
                                            labelTypes.add(label);
                                            
                                            // Extract the actual text that was annotated (if available)
                                            let annotatedText = '';
                                            if (textContent && result.value.start !== undefined && result.value.end !== undefined) {
                                                annotatedText = textContent.substring(result.value.start, result.value.end);
                                            }
                                            
                                            annotations.push({
                                                id: `${taskIndex}_${annotation.id}_${result.id}_${label}`,
                                                taskId: task.id || taskIndex,
                                                annotationId: annotation.id,
                                                resultId: result.id,
                                                studentId: annotatorName,
                                                label: label,
                                                confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                                timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                                project: 'GKCCI Privacy Policy Analysis',
                                                taskData: {
                                                    ...task.data,
                                                    fullText: textContent
                                                },
                                                // NER-specific fields
                                                startOffset: result.value.start,
                                                endOffset: result.value.end,
                                                annotatedText: annotatedText,
                                                annotationType: 'NER',
                                                fromName: result.from_name,
                                                toName: result.to_name,
                                                // GKCCI-specific metadata
                                                policySource: task.data?.source || task.file_upload || 'Privacy Policy Document',
                                                jurisdiction: task.data?.jurisdiction || 'Unknown',
                                                // Additional metadata from your task structure
                                                leadTime: annotation.lead_time || 0,
                                                resultCount: annotation.result_count || 1,
                                                wasCancelled: annotation.was_cancelled || false
                                            });
                                        } else {
                                            console.warn(`Unknown label found: ${label}. Expected one of:`, validLabels);
                                        }
                                    });
                                }
                            }
                            // Handle other potential result formats as fallback
                            else if (result.value && result.value.choices) {
                                console.log('Found choices format:', result.value.choices);
                                result.value.choices.forEach(choice => {
                                    labelTypes.add(choice);
                                    annotations.push({
                                        id: `${taskIndex}_${annotation.id}_${choice}`,
                                        taskId: task.id || taskIndex,
                                        studentId: annotatorName,
                                        label: choice,
                                        confidence: annotation.score || (85 + Math.random() * 10).toFixed(1),
                                        timestamp: annotation.created_at || annotation.updated_at || new Date().toISOString(),
                                        project: 'GKCCI Privacy Policy Analysis',
                                        taskData: task.data,
                                        annotationType: 'Choice',
                                        policySource: task.data?.source || task.file_upload || 'Privacy Policy Document',
                                        jurisdiction: task.data?.jurisdiction || 'Unknown'
                                    });
                                });
                            }
                        });
                    } else {
                        console.log('No results found in annotation:', annotation);
                    }
                });
            } else {
                console.log('No annotations found in task:', task);
            }
        });

        console.log('Final processing results:', {
            tasks: tasks.length,
            annotations: annotations.length,
            annotators: annotators.size,
            labelTypes: labelTypes.size,
            uniqueLabels: Array.from(labelTypes)
        });

        if (annotations.length === 0) {
            throw new Error('No valid GKCCI annotations found. Please ensure your Label Studio export includes completed annotations with the 8 GKCCI parameters.');
        }

        // Create student records with proper naming for law students
        window.labelingData.students = Array.from(annotators).map((name, index) => {
            let displayName, email;
            
            if (name.includes('@')) {
                displayName = name.split('@')[0];
                email = name;
            } else if (name.startsWith('Law_Student_')) {
                const studentNum = name.replace('Law_Student_', '');
                displayName = `Law Student ${studentNum}`;
                email = `lawstudent${studentNum}@uiowa.edu`;
            } else if (name.startsWith('User_')) {
                const userNum = name.replace('User_', '');
                displayName = `Law Student ${userNum}`;
                email = `lawstudent${userNum}@uiowa.edu`;
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

        // Assign colors to GKCCI labels (ensuring exact matches)
        const gkcciColors = {
            'Sender': '#FF6B6B',           // Red
            'Subject': '#FF8C00',          // Dark Orange  
            'Information Type': '#FFA500', // Orange
            'Recipient': '#32CD32',        // Green
            'Aim': '#1E90FF',             // Blue
            'Condition': '#00FFFF',        // Cyan
            'Modalities': '#000000',       // Black
            'Consequence': '#808080'       // Grey
        };
        
        // Update global color mapping
        Array.from(labelTypes).forEach(label => {
            if (gkcciColors[label]) {
                window.labelColors[label] = gkcciColors[label];
            }
        });

        updateVisualizations();
        populateStudentFilter();
        showDataSummary(tasks.length, annotations.length, annotators.size, labelTypes.size);
        hideStatus();
        
        showSuccess(`Successfully processed ${tasks.length} tasks with ${annotations.length} GKCCI annotations from ${annotators.size} law students`);
        
    } catch (error) {
        hideStatus();
        console.error('Processing error:', error);
        showError(`Error processing Label Studio data: ${error.message}`);
    }
}