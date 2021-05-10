const fs = require('fs');
const path = require("path");

const Translate = async (source, lang, callback) => {
    // Read available language
    const files = await fs.readdirSync(path.join(__dirname, "../Languages"))
    let _returned = false; // Temp variable to check if this function returned something inside that loop.
    for (const file of files){
        // Check if the inputed lang available
        if(file.indexOf(lang) !== -1){
            // Read the language file
            const langSrc = await fs.readFileSync(path.join(__dirname, "../Languages/", file))
            // Replace all text
            Object.keys(JSON.parse(langSrc)).forEach(key => {
                source = source.replace(new RegExp(key, 'g'), JSON.parse(langSrc)[key])
            })
            // Return translated text
            callback(source)
            break
            
        }
    }
    if(!_returned) callback(source) // Return translated text
}

module.exports = Translate