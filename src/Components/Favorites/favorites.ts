import Translate from "../I18n/i18n";
import fileIcon from "../Files/File Icon/fileIcon";
import getPath from "platform-folders"

/**
 * Create favorites section
 * @returns {string} Favorites section HTML code
 */
const Favorites = ():string => {
    const result = `<section class="home-section">
        <h2 class="section-title">${Translate("Favorites")}</h2>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("desktop")}">
            <h3 class="favorite-title"><img src="${fileIcon('desktop', "favorites", false)}" alt="Desktop icon" class="favorite-icon">${Translate("Desktop")}</h3>
        </div>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("documents")}">
            <h3 class="favorite-title"><img src="${fileIcon('document', "favorites", false)}" alt="Document icon" class="favorite-icon">${Translate("Documents")}</h3>
        </div>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("downloads")}">
            <h3 class="favorite-title"><img src="${fileIcon('download', "favorites", false)}" alt="Download icon" class="favorite-icon">${Translate("Downloads")}</h3>
        </div>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("pictures")}">
            <h3 class="favorite-title"><img src="${fileIcon('picture', "favorites", false)}" alt="Pictures icon" class="favorite-icon">${Translate("Pictures")}</h3>
        </div>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("music")}">
            <h3 class="favorite-title"><img src="${fileIcon('music', "favorites", false)}" alt="Music icon" class="favorite-icon">${Translate("Music")}</h3>
        </div>
        <div class="favorite file card-hover-effect" data-tilt data-listenOpen data-isdir="true" data-path="${getPath("videos")}">
            <h3 class="favorite-title"><img src="${fileIcon('video', "favorites", false)}" alt="Video icon" class="favorite-icon">${Translate("Videos")}</h3>
        </div></section>
        `;
    return result;
}
export default Favorites