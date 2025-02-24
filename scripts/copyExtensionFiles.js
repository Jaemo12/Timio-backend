const fs = require('fs');
const path = require('path');

// Define the files to copy
const files = ['content.js', 'background.js', 'manifest.json'];

// Copy each file from extension directory to build directory
files.forEach(file => {
    let sourcePath;
    if (file === 'manifest.json') {
        sourcePath = path.join(__dirname, '..', 'public', file);
    } else {
        sourcePath = path.join(__dirname, '..', 'extension', file);
    }
    const destPath = path.join(__dirname, '..', 'build', file);
    
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${file} to build directory`);
    } else {
        console.error(`Source file ${file} not found`);
    }
});