const { showNotification, readFile } = require('@xplorer/extension-sdk');

function activate() {
    console.log('Test Fixture Extension activated');
    showNotification('Test extension loaded successfully');
}

function deactivate() {
    console.log('Test Fixture Extension deactivated');
}

function sayHello() {
    showNotification('Hello from test extension!');
    return { message: 'Hello World' };
}

function processFile(filePath) {
    try {
        const content = readFile(filePath);
        return {
            status: 'success',
            fileSize: content.length,
            lineCount: content.split('\n').length,
            processed: true
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message,
            processed: false
        };
    }
}

module.exports = {
    activate,
    deactivate,
    sayHello,
    processFile
};