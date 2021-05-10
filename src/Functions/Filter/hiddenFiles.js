const storage = require('electron-json-storage')

// Check user preference to show or hidden file
const checkUserPreference = (path, callback) => {
    // Get user preference from the storage
    storage.get('hiddenFiles', (err, data) => {
        // If user has no preference theme
        if(!data || !Object.keys(data).length || Object.keys(data).indexOf(path) === -1){
            if(data && Object.keys(data).indexOf("default") !== -1) callback(data.default) // _Check if there's user default preference
            else callback(true) // Else send true if need to filter hidden files as default
        }else{
            if(data[path]) callback(true)
            else callback(false)
        }
    })
}

// Function to filter hidden files
const filterHidden = (files, path, callback) => {
    checkUserPreference(path, result => {
        result ? callback(files.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item.filename))): callback(files)
    })
}

module.exports = filterHidden