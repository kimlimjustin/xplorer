const path = require('path')
const fs = require('fs');
const Translate = require('./multilingual');
const getIcon = require('../Functions/Icon/icon');

const Favorites = (callback) => {
    let result = `<section class="home-section">
        <h2 class="section-title">Favorites</h2>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'desktop')}" alt="Desktop icon" class="favorite-icon">Desktop</h3>
        </div>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'document')}" alt="Document icon" class="favorite-icon">Documents</h3>
        </div>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'download')}" alt="Download icon" class="favorite-icon">Downloads</h3>
        </div>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'picture')}" alt="Pictures icon" class="favorite-icon">Pictures</h3>
        </div>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'music')}" alt="Music icon" class="favorite-icon">Music</h3>
        </div>
        <div class="favorite" data-tilt>
            <h3 class="favorite-title"><img src="${getIcon('favorites', 'video')}" alt="Video icon" class="favorite-icon">Videos</h3>
        </div></section>
        `;
    Translate(result, navigator.language, result => {
        callback(result)
    })
}
module.exports = Favorites