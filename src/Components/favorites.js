const path = require('path')
const fs = require('fs');
const Translate = require('./multilingual');
const Favorites = (callback) => {
    const iconJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/icon.json")));
    
    let result =`<section class="home-section">
        <h2 class="favorites-title">Favorites</h2>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.desktop}`)}" alt="Desktop icon" class="favorite-icon">Desktop</h3>
        </div>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.document}`)}" alt="Document icon" class="favorite-icon">Documents</h3>
        </div>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.download}`)}" alt="Download icon" class="favorite-icon">Downloads</h3>
        </div>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.picture}`)}" alt="Pictures icon" class="favorite-icon">Pictures</h3>
        </div>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.music}`)}" alt="Music icon" class="favorite-icon">Music</h3>
        </div>
        <div class="favorite">
            <h3 class="favorite-title"><img src="${path.join(__dirname,  `../icon/${iconJSON.favorites.video}`)}" alt="Video icon" class="favorite-icon">Videos</h3>
        </div></section>`
    Translate(result, navigator.language, result => {
        callback(result)
    })
}
module.exports =  Favorites