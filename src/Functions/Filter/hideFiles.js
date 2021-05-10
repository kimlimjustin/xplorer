const storage = require('electron-json-storage')
// Function to store user preference to hide files
const hideFiles = (path, callback) => {
    // Check stored preference
    storage.get('hiddenFiles', (err, data) => {
        if(err || !path) return false;
        // Check if no default preference
        else if(!data  || !Object.keys(data).length){
            storage.set('hiddenFiles', {[path]: false})
            // Toggle hidden file on menu
            document.querySelector("#show-hidden-files").checked = false
            callback(true)
        }
        else{
            // Set data based on the opposite of previous preference
            const preference = !data[path]
            // Toggle hidden file on menu
            document.querySelector("#show-hidden-files").checked = data[path]
            storage.set('hiddenFiles', {[path]: preference, default: preference})
            callback(true)
        }
    })
}

module.exports = hideFiles