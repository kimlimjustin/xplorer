function isElementInViewport (el) { // Check if element in viewport
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}
// Function to change main element content
const changeContent = (newElement, autoScroll = true) => {
    newElement.id = "main";
    const mainElement = document.body.querySelector("#main");
    let _scrollTop = mainElement.scrollTop;
    mainElement.parentElement.replaceChild(newElement, mainElement);
    if (autoScroll) newElement.scrollTop = _scrollTop
    
    // Only show image when its visible to reduce latency
    newElement.querySelectorAll("img").forEach(img => {
        if (!img.src && img.dataset.src) {
            let _detectImg = setInterval(() => {
                if (isElementInViewport(img)) {
                    img.src = img.dataset.src
                    clearInterval(_detectImg)
                } else {
                    img.removeAttribute("src")
                }
            }, 1000);
        }
    })
}

module.exports = changeContent