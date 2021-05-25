const fs = require('fs');
const path = require("path");
const storage = require('electron-json-storage-sync');

const Translate = (source) => {
    // Read available language
    const files = fs.readdirSync(path.join(__dirname, "../Languages"))
    let _returned = false; // Temp variable to check if this function returned something inside that loop.
    let lang = storage.get('preference')?.data?.language ? storage.get('preference')?.data?.language : navigator.language;
    for (const file of files){
        // Check if the inputed lang available
        if(file.indexOf(lang) !== -1){
            // Read the language file
            const langSrc = fs.readFileSync(path.join(__dirname, "../Languages/", file))
            // Replace all text
            Object.keys(JSON.parse(langSrc)).forEach(key => {
                source = source.replace(new RegExp(key, 'g'), JSON.parse(langSrc)[key])
            })
            // Return translated text
            return source
            
        }
    }
    return source // Return translated text
}

module.exports = Translate