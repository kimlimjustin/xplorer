// Convert file size into human readable file size
const formatBytes = (bytes, kBlockFormat = false) => { // kBlockFormat = 1024-blocks format byte
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2; // Decimal digit
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[kBlockFormat ? i + 1 : i] 
}

module.exports = formatBytes