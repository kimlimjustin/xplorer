const path = require('path')
const os = require('os');
const Translate = require('./multilingual');
const getPreview = require('../Functions/preview/preview');

/**
 * Create favorites section
 * @returns {string} Favorites section HTML code
 */
const Favorites = () => {
    let result = `<section class="home-section">
        <h2 class="section-title">${Translate("Favorites")}</h2>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Desktop'))}">
            <h3 class="favorite-title"><img src="${getPreview('desktop', category = "favorites", HTMLFormat = false)}" alt="Desktop icon" class="favorite-icon">${Translate("Desktop")}</h3>
        </div>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Documents'))}">
            <h3 class="favorite-title"><img src="${getPreview('document', category = "favorites", HTMLFormat = false)}" alt="Document icon" class="favorite-icon">${Translate("Documents")}</h3>
        </div>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Downloads'))}">
            <h3 class="favorite-title"><img src="${getPreview('download', category = "favorites", HTMLFormat = false)}" alt="Download icon" class="favorite-icon">${Translate("Downloads")}</h3>
        </div>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Pictures'))}">
            <h3 class="favorite-title"><img src="${getPreview('picture', category = "favorites", HTMLFormat = false)}" alt="Pictures icon" class="favorite-icon">${Translate("Pictures")}</h3>
        </div>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Music'))}">
            <h3 class="favorite-title"><img src="${getPreview('music', category = "favorites", HTMLFormat = false)}" alt="Music icon" class="favorite-icon">${Translate("Music")}</h3>
        </div>
        <div class="favorite card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${escape(path.join(os.homedir(), 'Videos'))}">
            <h3 class="favorite-title"><img src="${getPreview('video', category = "favorites", HTMLFormat = false)}" alt="Video icon" class="favorite-icon">${Translate("Videos")}</h3>
        </div></section>
        `;
    return result;
}
module.exports = Favorites