// Migration script to reorganize existing flat file structure to hierarchical
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const OLD_UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const NEW_PROJECTS_DIR = path.join(DATA_DIR, 'projects');

function sanitizeFolderName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
}

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

async function migratePolicyData() {
    console.log('Starting migration to hierarchical file structure...');
    
    try {
        // Load existing policies
        const data = await fs.readFile(POLICIES_FILE, 'utf8');
        const policies = JSON.parse(data);
        
        console.log(`Found ${Object.keys(policies).length} policies to migrate`);
        
        // Create projects directory
        await ensureDirectoryExists(NEW_PROJECTS_DIR);
        
        // Process each policy
        for (const [policyName, policyData] of Object.entries(policies)) {
            console.log(`\nMigrating policy: ${policyName}`);
            
            // Create policy directory
            const sanitizedPolicyName = sanitizeFolderName(policyName);
            const policyDir = path.join(NEW_PROJECTS_DIR, sanitizedPolicyName);
            await ensureDirectoryExists(policyDir);
            
            // Migrate files for each contributor
            for (const [studentName, contributor] of Object.entries(policyData.contributors)) {
                console.log(`  Migrating ${contributor.uploads.length} uploads for ${studentName}`);
                
                for (let i = 0; i < contributor.uploads.length; i++) {
                    const upload = contributor.uploads[i];
                    
                    if (upload.filePath && upload.storedAs) {
                        try {
                            // Check if old file exists
                            await fs.access(upload.filePath);
                            
                            // Create new filename with hierarchy
                            const newFilename = upload.storedAs;
                            const newFilePath = path.join(policyDir, newFilename);
                            
                            // Copy file to new location
                            const fileContent = await fs.readFile(upload.filePath);
                            await fs.writeFile(newFilePath, fileContent);
                            
                            // Update upload record
                            upload.filePath = newFilePath;
                            upload.relativePath = path.join(sanitizedPolicyName, newFilename);
                            
                            console.log(`    Moved: ${upload.filename} -> ${newFilePath}`);
                            
                        } catch (error) {
                            console.warn(`    Warning: Could not migrate ${upload.filename}:`, error.message);
                        }
                    }
                }
            }
        }
        
        // Save updated policies with new file paths
        await fs.writeFile(POLICIES_FILE, JSON.stringify(policies, null, 2));
        console.log('\n✅ Migration completed successfully!');
        
        // Show summary
        console.log('\n📊 Migration Summary:');
        console.log(`- Created projects directory: ${NEW_PROJECTS_DIR}`);
        
        for (const policyName of Object.keys(policies)) {
            const policyDir = path.join(NEW_PROJECTS_DIR, sanitizeFolderName(policyName));
            try {
                const files = await fs.readdir(policyDir);
                console.log(`- ${policyName}: ${files.length} files in ${policyDir}`);
            } catch (error) {
                console.log(`- ${policyName}: Directory not accessible`);
            }
        }
        
        // Offer to clean up old uploads directory
        console.log('\n🗑️  Old uploads directory cleanup:');
        try {
            const oldFiles = await fs.readdir(OLD_UPLOADS_DIR);
            console.log(`- Found ${oldFiles.length} files in old uploads directory: ${OLD_UPLOADS_DIR}`);
            console.log('- You can safely delete this directory after verifying the migration worked correctly');
            console.log('- Command to remove: rm -rf ' + OLD_UPLOADS_DIR);
        } catch (error) {
            console.log('- Old uploads directory not found or already cleaned up');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
if (require.main === module) {
    migratePolicyData().then(() => {
        console.log('\n🎉 Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Test your application to ensure everything works');
        console.log('2. Verify files are in the correct project directories');
        console.log('3. Remove the old uploads directory when satisfied');
        process.exit(0);
    }).catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}

module.exports = { migratePolicyData };