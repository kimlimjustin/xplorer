const fs = require('fs');
const path = require("path");

const Translate = async (source, lang, callback) => {
    // Read available language
    const files = await fs.readdirSync(path.join(__dirname, "../Languages"))
    files.forEach(file => {
        // Check if the inputed lang available
        if(file.indexOf(lang) !== -1){
            // Read the language file
            fs.readFile(path.join(__dirname, "../Languages/", file), (err, langSrc) => {
                // Replace all text
                Object.keys(JSON.parse(langSrc)).forEach(key => {
                    source = source.replace(new RegExp(key, 'g'), JSON.parse(langSrc)[key])
                })
                // Return translated text
                callback(source)
            })
        }else{
            // Return translated text
            callback(source)
        }
    })
}

module.exports = Translate