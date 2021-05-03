const storage = require('electron-json-storage')
// Function to store user preference to hide files
const hideFiles = (path, callback) => {
    // Check stored preference
    storage.get('hiddenFiles', (err, data) => {
        if(err || !path) return false;
        // Check if no default preference
        else if(!data  || !Object.keys(data).length){
            storage.set('hiddenFiles', {[path]: false})
            callback(true)
        }
        else{
            // Set data based on the opposite of previous preference
            const preference = !data[path]
            storage.set('hiddenFiles', {[path]: preference})
            callback(true)
        }
    })
}

module.exports = hideFiles