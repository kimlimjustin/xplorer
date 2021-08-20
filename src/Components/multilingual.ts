import fs from 'fs';
import path from 'path';
import storage from 'electron-json-storage-sync';

/**
 * Translate a source into user's preferenced language
 * @param {string} source - The source you want to be translated
 * @returns {string} translated string
 */
const Translate = (source: string): string => {
    // Read available language
    const files = fs.readdirSync(path.join(__dirname, '../Locales'));
    const lang = storage.get('preference')?.data?.language
        ? storage.get('preference')?.data?.language
        : navigator.language;
    for (const file of files) {
        // Check if the inputed lang available
        if (file.indexOf(lang) !== -1) {
            // Read the language file
            const langSrc = fs.readFileSync(
                path.join(__dirname, '../Locales/', file),
                'utf-8'
            );
            // Replace all text
            Object.keys(JSON.parse(langSrc)).forEach((key) => {
                source = source.replace(
                    new RegExp(key, 'g'),
                    JSON.parse(langSrc)[key]
                );
            });
            // Return translated text
            return source;
        }
    }
    return source; // Return translated text
};

export default Translate;
