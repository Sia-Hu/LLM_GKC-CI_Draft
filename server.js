const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const { addGlobalOffsets } = require('./js/offsetConverter');


const app = express();
const PORT = process.env.PORT || 8001;

// Data storage path
const DATA_DIR = path.join(__dirname, 'data');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Middleware
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await ensureDirectoryExists(UPLOADS_DIR);
            cb(null, UPLOADS_DIR);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${sanitizedName}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Utility functions
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
        } else {
            throw error;
        }
    }
}

async function loadPolicies() {
    try {
        await ensureDirectoryExists(DATA_DIR);
        const data = await fs.readFile(POLICIES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return empty object
            return {};
        }
        throw error;
    }
}

async function savePolicies(policies) {
    await ensureDirectoryExists(DATA_DIR);
    await fs.writeFile(POLICIES_FILE, JSON.stringify(policies, null, 2));
}

function countAnnotations(data) {
    let count = 0;
    if (Array.isArray(data)) {
        data.forEach(item => {
            if (item.annotations && Array.isArray(item.annotations)) {
                count += item.annotations.length;
            } else if (item.result) {
                count++;
            }
        });
    } else if (data.annotations && Array.isArray(data.annotations)) {
        count = data.annotations.length;
    }
    return count;
}

// Helper function to sanitize folder names
function sanitizeFolderName(name) {
    return name.replace(/[^a-zA-Z0-9\-_\s]/g, '_').replace(/\s+/g, '_');
}

// API Routes

// Get all policies
app.get('/api/policies', async (req, res) => {
    try {
        const policies = await loadPolicies();
        res.json(policies);
    } catch (error) {
        console.error('Error loading policies:', error);
        res.status(500).json({ error: 'Failed to load policies' });
    }
});

// Get specific policy
app.get('/api/policies/:policyName', async (req, res) => {
    try {
        const policies = await loadPolicies();
        const policyName = decodeURIComponent(req.params.policyName);
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        res.json(policy);
    } catch (error) {
        console.error('Error loading policy:', error);
        res.status(500).json({ error: 'Failed to load policy' });
    }
});

// Delete specific policies
app.delete('/api/policies/:policyName', async (req, res) => {
    const policyName = decodeURIComponent(req.params.policyName).trim();
    console.log(`Delete request received for: "${policyName}"`);

    if (!policyName) {
        return res.status(400).json({ error: 'Policy name is required' });
    }

    try {
        // Step 1: Delete the physical project directory
        const policyDir = path.join(DATA_DIR, 'projects', policyName);
        console.log('Attempting to delete directory:', policyDir);
        
        try {
            const stat = await fs.stat(policyDir);
            if (stat.isDirectory()) {
                await fs.rm(policyDir, { recursive: true, force: true });
                console.log(`Successfully deleted project directory: "${policyName}"`);
            }
        } catch (dirError) {
            console.log(`Project directory not found or already deleted: ${policyDir}`);
        }

        // Step 2: Remove from policies.json metadata
        const policies = await loadPolicies();
        if (policies[policyName]) {
            delete policies[policyName];
            await savePolicies(policies);
            console.log(`Removed "${policyName}" from policies.json`);
        } else {
            console.log(`"${policyName}" not found in policies.json metadata`);
        }

        // Step 3: Respond with success
        res.json({ 
            success: true, 
            message: `Policy "${policyName}" deleted successfully` 
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ 
            error: 'Failed to delete policy', 
            details: error.message 
        });
    }
});

// Upload annotation file
app.post('/api/upload', upload.single('annotationFile'), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    const { studentName, studentEmail, university, policyName } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!studentName || !policyName) {
      return res.status(400).json({ error: 'Student name and policy name are required' });
    }

    // Ensure hierarchical folder
    const policyDir = path.join(DATA_DIR, 'projects', policyName);
    await ensureDirectoryExists(policyDir);

    // Move uploaded file from /uploads to /projects/<policyName>
    const finalPath = path.join(policyDir, req.file.filename);
    await fs.rename(req.file.path, finalPath);

    // Count annotations
    const fileContent = await fs.readFile(finalPath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    if (Array.isArray(jsonData)) {
        jsonData.forEach(task => addGlobalOffsets(task));
    } else {
        addGlobalOffsets(jsonData);
    }
    const annotationCount = countAnnotations(jsonData);
    await fs.writeFile(finalPath, JSON.stringify(jsonData, null, 2))
    // Update policies.json
    const policies = await loadPolicies();
    const isNewPolicy = !policies[policyName];
    if (isNewPolicy) {
      policies[policyName] = {
        createdAt: new Date().toISOString(),
        contributors: {},
        totalAnnotations: 0
      };
    }
    if (!policies[policyName].contributors[studentName]) {
      policies[policyName].contributors[studentName] = {
        uploads: [],
        email: studentEmail || '',
        university: university || '',
        totalAnnotations: 0
      };
    }

    // Add upload record
    policies[policyName].contributors[studentName].uploads.push({
      filename: req.file.originalname,
      storedAs: req.file.filename,
      filePath: finalPath,
      annotationCount,
      uploadedAt: new Date().toISOString(),
      source: 'upload'
    });

    policies[policyName].contributors[studentName].totalAnnotations += annotationCount;
    policies[policyName].totalAnnotations += annotationCount;
    policies[policyName].lastUpdated = new Date().toISOString();

    await savePolicies(policies);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      isNewPolicy,
      annotationCount,
      policyName
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process upload', details: err.message });
  }
});

// Upload annotation data via JSON paste
app.post('/api/upload-json', async (req, res) => {
    try {
        const { studentName, studentEmail, university, policyName, jsonData } = req.body;
        
        if (!studentName || !policyName || !jsonData) {
            return res.status(400).json({ error: 'Student name, policy name, and JSON data are required' });
        }

        let annotationData;
        try {
            annotationData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid JSON data' });
        }
        if (Array.isArray(annotationData)) {
            annotationData.forEach(task => addGlobalOffsets(task));
        } else {
            addGlobalOffsets(annotationData);
        }

        const annotationCount = countAnnotations(annotationData);
        
        // Load existing policies
        const policies = await loadPolicies();
        const isNewPolicy = !policies[policyName];
        
        // Initialize policy if it doesn't exist
        if (!policies[policyName]) {
            policies[policyName] = {
                createdAt: new Date().toISOString(),
                contributors: {},
                totalAnnotations: 0
            };
        }
        
        // Initialize contributor if they don't exist
        if (!policies[policyName].contributors[studentName]) {
            policies[policyName].contributors[studentName] = {
                uploads: [],
                email: studentEmail || '',
                university: university || '',
                totalAnnotations: 0
            };
        }
        
        // Save the JSON data to a file
        const timestamp = Date.now();
        const filename = `pasted_json_${timestamp}.json`;
        const filepath = path.join(UPLOADS_DIR, filename);
        
        await ensureDirectoryExists(UPLOADS_DIR);
        await fs.writeFile(filepath, JSON.stringify(annotationData, null, 2));
        
        // Add the upload record
        policies[policyName].contributors[studentName].uploads.push({
            filename: 'Pasted JSON Data',
            storedAs: filename,
            annotationCount: annotationCount,
            uploadedAt: new Date().toISOString(),
            filePath: filepath,
            source: 'paste'
        });
        
        // Update totals
        policies[policyName].contributors[studentName].totalAnnotations += annotationCount;
        policies[policyName].totalAnnotations += annotationCount;
        policies[policyName].lastUpdated = new Date().toISOString();
        
        // Save updated policies
        await savePolicies(policies);
        
        res.json({
            success: true,
            message: 'JSON data processed successfully',
            isNewPolicy,
            annotationCount,
            policyName,
            filename: 'Pasted JSON Data'
        });
        
    } catch (error) {
        console.error('Error processing JSON paste:', error);
        res.status(500).json({ error: 'Failed to process JSON data' });
    }
});

// Get policy files
app.get('/api/policies/:policyName/files', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        console.log(`Loading files for policy: ${policyName}`);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            console.log(`Policy not found: ${policyName}`);
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        // Check old flat structure since you don't have projects folder yet
        const oldUploadsDir = path.join(DATA_DIR, 'uploads');
        
        let files = [];
        let directory = oldUploadsDir;
        
        try {
            await fs.access(oldUploadsDir);
            const allFiles = await fs.readdir(oldUploadsDir);
            
            // Filter files that belong to this policy based on the database
            const policyFiles = [];
            Object.values(policy.contributors).forEach(contributor => {
                contributor.uploads.forEach(upload => {
                    if (upload.storedAs) {
                        policyFiles.push(upload.storedAs);
                    }
                });
            });
            
            files = allFiles.filter(file => policyFiles.includes(file));
            console.log(`Found ${files.length} files for policy in uploads directory`);
            
        } catch (dirError) {
            console.log(`Uploads directory not found`);
            return res.json({
                policyName,
                directory: oldUploadsDir,
                files: []
            });
        }
        
        const fileDetails = [];
        for (const filename of files) {
            try {
                const filePath = path.join(directory, filename);
                const stats = await fs.stat(filePath);
                fileDetails.push({
                    name: filename,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            } catch (fileError) {
                console.error(`Error processing file ${filename}:`, fileError);
            }
        }
        
        console.log(`Successfully processed ${fileDetails.length} files`);
        res.json({
            policyName,
            directory,
            files: fileDetails
        });
        
    } catch (error) {
        console.error('Error listing policy files:', error);
        res.status(500).json({ 
            error: 'Failed to list policy files',
            details: error.message 
        });
    }
});

// Delete specific file from a policy
app.delete('/api/policies/:policyName/files/:fileName', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const fileName = decodeURIComponent(req.params.fileName);
        
        console.log(`Deleting file ${fileName} from policy ${policyName}`);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        // Find the file in the policy data and remove it
        let fileFound = false;
        let studentToUpdate = null;
        let uploadIndex = -1;
        
        for (const [studentName, contributor] of Object.entries(policy.contributors)) {
            const uploadIdx = contributor.uploads.findIndex(upload => upload.storedAs === fileName);
            if (uploadIdx !== -1) {
                fileFound = true;
                studentToUpdate = studentName;
                uploadIndex = uploadIdx;
                break;
            }
        }
        
        if (!fileFound) {
            return res.status(404).json({ error: 'File not found in policy data' });
        }
        
        const upload = policy.contributors[studentToUpdate].uploads[uploadIndex];
        
        // Try to delete the actual file
        const oldFilePath = path.join(DATA_DIR, 'uploads', fileName);
        const newFilePath = path.join(DATA_DIR, 'projects', sanitizeFolderName(policyName), fileName);
        
        let fileDeleted = false;
        
        // Try old structure first
        try {
            await fs.unlink(oldFilePath);
            fileDeleted = true;
            console.log(`Deleted file from old structure: ${oldFilePath}`);
        } catch (oldError) {
            // Try new structure
            try {
                await fs.unlink(newFilePath);
                fileDeleted = true;
                console.log(`Deleted file from new structure: ${newFilePath}`);
            } catch (newError) {
                console.warn(`Could not delete physical file: ${fileName}`);
                // Continue anyway to clean up the database record
            }
        }
        
        // Update the policy data
        const annotationCount = upload.annotationCount || 0;
        
        // Remove the upload from contributor
        policy.contributors[studentToUpdate].uploads.splice(uploadIndex, 1);
        policy.contributors[studentToUpdate].totalAnnotations -= annotationCount;
        
        // Update policy totals
        policy.totalAnnotations -= annotationCount;
        policy.lastUpdated = new Date().toISOString();
        
        // If contributor has no more uploads, remove them
        if (policy.contributors[studentToUpdate].uploads.length === 0) {
            delete policy.contributors[studentToUpdate];
        }
        
        // If no contributors left, we could optionally delete the entire policy
        if (Object.keys(policy.contributors).length === 0) {
            delete policies[policyName];
            console.log(`Policy ${policyName} removed as it has no contributors`);
        }
        
        // Save updated policies
        await savePolicies(policies);
        
        res.json({ 
            success: true, 
            message: `File ${fileName} deleted successfully`,
            fileDeleted: fileDeleted,
            totalAnnotations: policy.totalAnnotations || 0,
            remainingContributors: Object.keys(policy.contributors || {}).length
        });
        
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Delete individual file from a specific contributor (hierarchical structure)
app.delete('/api/policies/:policyName/contributors/:contributor/files/:fileName', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const contributor = decodeURIComponent(req.params.contributor);
        const fileName = decodeURIComponent(req.params.fileName);
        
        console.log(`Deleting file ${fileName} from contributor ${contributor} in policy ${policyName}`);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        if (!policy.contributors[contributor]) {
            return res.status(404).json({ error: 'Contributor not found' });
        }
        
        // Find the upload to delete
        const uploads = policy.contributors[contributor].uploads;
        const uploadIndex = uploads.findIndex(upload => upload.storedAs === fileName);
        
        if (uploadIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const upload = uploads[uploadIndex];
        const annotationCount = upload.annotationCount || 0;
        
        // Try to delete the physical file from multiple possible locations
        const possiblePaths = [
            path.join(DATA_DIR, 'projects', sanitizeFolderName(policyName), fileName),
            path.join(DATA_DIR, 'uploads', fileName),
            upload.filePath // Original path if stored
        ];
        
        let fileDeleted = false;
        for (const filePath of possiblePaths) {
            if (filePath) {
                try {
                    await fs.unlink(filePath);
                    fileDeleted = true;
                    console.log(`Successfully deleted file: ${filePath}`);
                    break;
                } catch (error) {
                    // Continue to next path
                }
            }
        }
        
        if (!fileDeleted) {
            console.warn(`Could not delete physical file: ${fileName}`);
        }
        
        // Remove the upload from contributor
        uploads.splice(uploadIndex, 1);
        
        // Update contributor totals
        policy.contributors[contributor].totalAnnotations -= annotationCount;
        
        // Update policy totals
        policy.totalAnnotations -= annotationCount;
        policy.lastUpdated = new Date().toISOString();
        
        // If contributor has no more uploads, remove them
        if (uploads.length === 0) {
            delete policy.contributors[contributor];
            console.log(`Removed contributor ${contributor} (no files remaining)`);
        }
        
        // If no contributors left, remove the policy
        if (Object.keys(policy.contributors).length === 0) {
            delete policies[policyName];
            console.log(`Removed policy ${policyName} (no contributors remaining)`);
        }
        
        // Save updated policies
        await savePolicies(policies);
        
        res.json({
            success: true,
            message: `File deleted successfully`,
            fileDeleted: fileDeleted,
            remainingFiles: uploads.length,
            remainingContributors: Object.keys(policy.contributors || {}).length
        });
        
    } catch (error) {
        console.error('Error deleting contributor file:', error);
        res.status(500).json({ 
            error: 'Failed to delete file', 
            details: error.message 
        });
    }
});

// Download individual file from a specific contributor
app.get('/api/policies/:policyName/contributors/:contributor/files/:fileName/download', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const contributor = decodeURIComponent(req.params.contributor);
        const fileName = decodeURIComponent(req.params.fileName);
        
        console.log(`Download request: ${fileName} from ${contributor} in ${policyName}`);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        if (!policy.contributors[contributor]) {
            return res.status(404).json({ error: 'Contributor not found' });
        }
        
        // Find the upload record to get original filename
        const upload = policy.contributors[contributor].uploads.find(
            upload => upload.storedAs === fileName
        );
        
        if (!upload) {
            return res.status(404).json({ error: 'File record not found' });
        }
        
        // Try to find the physical file in multiple locations
        const possiblePaths = [
            path.join(DATA_DIR, 'projects', sanitizeFolderName(policyName), fileName),
            path.join(DATA_DIR, 'uploads', fileName),
            upload.filePath // Original path if stored
        ];
        
        let actualFilePath = null;
        for (const filePath of possiblePaths) {
            if (filePath) {
                try {
                    await fs.access(filePath);
                    actualFilePath = filePath;
                    break;
                } catch (error) {
                    // Continue to next path
                }
            }
        }
        
        if (!actualFilePath) {
            return res.status(404).json({ error: 'Physical file not found' });
        }
        
        // Get original filename for download
        const originalName = upload.filename || upload.originalName || fileName;
        
        // Set appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
        res.setHeader('Content-Type', 'application/json');
        
        // Send the file
        res.sendFile(path.resolve(actualFilePath));
        
        console.log(`Successfully served file: ${originalName}`);
        
    } catch (error) {
        console.error('Error downloading contributor file:', error);
        res.status(500).json({ 
            error: 'Failed to download file', 
            details: error.message 
        });
    }
});

// Get file statistics for a policy (optional - for debugging)
app.get('/api/policies/:policyName/file-stats', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        const stats = {
            policyName,
            totalContributors: Object.keys(policy.contributors).length,
            totalFiles: 0,
            totalAnnotations: policy.totalAnnotations,
            contributors: {}
        };
        
        // Gather contributor statistics
        for (const [contributorName, contributor] of Object.entries(policy.contributors)) {
            stats.contributors[contributorName] = {
                fileCount: contributor.uploads.length,
                totalAnnotations: contributor.totalAnnotations,
                files: contributor.uploads.map(upload => ({
                    filename: upload.filename,
                    storedAs: upload.storedAs,
                    annotationCount: upload.annotationCount,
                    uploadedAt: upload.uploadedAt,
                    source: upload.source
                }))
            };
            stats.totalFiles += contributor.uploads.length;
        }
        
        res.json(stats);
        
    } catch (error) {
        console.error('Error getting file stats:', error);
        res.status(500).json({ error: 'Failed to get file statistics' });
    }
});

// Delete specific contributor from a policy
app.delete('/api/policies/:policyName/contributors/:studentName', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const studentName = decodeURIComponent(req.params.studentName);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        if (!policy.contributors[studentName]) {
            return res.status(404).json({ error: 'Student not found in this policy' });
        }
        
        // Clean up uploaded files for this contributor
        const contributor = policy.contributors[studentName];
        for (const upload of contributor.uploads) {
            if (upload.filePath) {
                try {
                    await fs.unlink(upload.filePath);
                } catch (error) {
                    console.warn(`Could not delete file: ${upload.filePath}`);
                }
            }
        }
        
        // Subtract the contributor's annotations from the total
        policy.totalAnnotations -= contributor.totalAnnotations;
        
        // Remove contributor from policy
        delete policy.contributors[studentName];
        
        // Update policy timestamp
        policy.lastUpdated = new Date().toISOString();
        
        // If no contributors left, we could optionally delete the policy
        if (Object.keys(policy.contributors).length === 0) {
            policy.totalAnnotations = 0;
        }
        
        await savePolicies(policies);
        
        res.json({ 
            success: true, 
            message: `Student ${studentName} removed from policy ${policyName}`,
            remainingContributors: Object.keys(policy.contributors).length,
            totalAnnotations: policy.totalAnnotations
        });
        
    } catch (error) {
        console.error('Error deleting contributor:', error);
        res.status(500).json({ error: 'Failed to delete contributor' });
    }
});

// Delete specific upload from a contributor
app.delete('/api/policies/:policyName/contributors/:studentName/uploads/:uploadIndex', async (req, res) => {
    try {
        const policyName = decodeURIComponent(req.params.policyName);
        const studentName = decodeURIComponent(req.params.studentName);
        const uploadIndex = parseInt(req.params.uploadIndex);
        
        const policies = await loadPolicies();
        const policy = policies[policyName];
        
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        
        if (!policy.contributors[studentName]) {
            return res.status(404).json({ error: 'Student not found in this policy' });
        }
        
        const contributor = policy.contributors[studentName];
        
        if (uploadIndex < 0 || uploadIndex >= contributor.uploads.length) {
            return res.status(404).json({ error: 'Upload not found' });
        }
        
        const upload = contributor.uploads[uploadIndex];
        
        // Clean up the file
        if (upload.filePath) {
            try {
                await fs.unlink(upload.filePath);
            } catch (error) {
                console.warn(`Could not delete file: ${upload.filePath}`);
            }
        }
        
        // Update totals
        contributor.totalAnnotations -= upload.annotationCount;
        policy.totalAnnotations -= upload.annotationCount;
        
        // Remove the upload
        contributor.uploads.splice(uploadIndex, 1);
        
        // If no uploads left for this contributor, remove them
        if (contributor.uploads.length === 0) {
            delete policy.contributors[studentName];
        }
        
        policy.lastUpdated = new Date().toISOString();
        
        await savePolicies(policies);
        
        res.json({ 
            success: true, 
            message: `Upload removed successfully`,
            remainingUploads: contributor.uploads?.length || 0,
            totalAnnotations: policy.totalAnnotations
        });
        
    } catch (error) {
        console.error('Error deleting upload:', error);
        res.status(500).json({ error: 'Failed to delete upload' });
    }
});

// Get specific policy file content
app.get('/api/policy-file/:policyName/:fileName', async (req, res) => {
  try {
    const { policyName, fileName } = req.params;

    // This corrected line now points to the correct directory structure
    const policyDir = path.join(DATA_DIR, 'projects', decodeURIComponent(policyName));

    const filePath = path.join(policyDir, decodeURIComponent(fileName));
    await fs.access(filePath); // Check if file exists before sending
    res.sendFile(filePath);

  } catch (error) {
    console.error(`Error fetching specific policy file: ${error.message}`);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Annotation file not found in the specified path.' });
    } else {
      res.status(500).json({ error: 'Failed to retrieve annotation file.' });
    }
  }
});

// Get project statistics
app.get('/api/stats', async (req, res) => {
    try {
        const policies = await loadPolicies();
        const policyNames = Object.keys(policies);
        
        let totalContributors = new Set();
        let totalAnnotations = 0;
        
        policyNames.forEach(policyName => {
            const policy = policies[policyName];
            Object.keys(policy.contributors).forEach(contributor => {
                totalContributors.add(contributor);
            });
            totalAnnotations += policy.totalAnnotations || 0;
        });
        
        const stats = {
            totalPolicies: policyNames.length,
            totalContributors: totalContributors.size,
            totalAnnotations: totalAnnotations,
            avgAnnotationsPerPolicy: policyNames.length > 0 ? Math.round(totalAnnotations / policyNames.length) : 0
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Serve static files (your HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Data will be stored in:', DATA_DIR);
});

module.exports = app;