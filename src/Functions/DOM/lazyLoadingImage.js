const storage = require('electron-json-storage-sync');
const lazy_load_frequency = storage.get('preference')?.data?.lazyLoadFrequency || 500
const FETCHED_ICONS = [] // Array of fetch icons

const isElementInViewport = el => { // Check if element in viewport
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

const LAZY_LOAD = () => {
    const MAIN_ELEMENT = document.getElementById("main");
    // Only show image when its visible in viewport to reduce latency
    MAIN_ELEMENT.querySelectorAll("img").forEach(img => {

        (function _detectImg() {
            if (img.dataset.src) {
                if (isElementInViewport(img)) {
                    img.src = img.dataset.src
                    if (FETCHED_ICONS.indexOf(img.dataset.src) === -1) FETCHED_ICONS.push(img.dataset.src)
                    img.removeAttribute("data-src")
                    clearTimeout(_detectImg)
                } else {
                    // Directly show icons if it was fetched before
                    if (FETCHED_ICONS.indexOf(img.dataset.src) !== - 1) {
                        img.src = img.dataset.src
                        clearTimeout(_detectImg)
                    }
                }
            }
            setTimeout(_detectImg, lazy_load_frequency)
        })()
    })
}

module.exports = LAZY_LOAD