// Function to change main element content
const changeContent = (newElement, autoScroll = true) => {
    newElement.id = "main";
    const mainElement = document.body.querySelector("#main");
    let _scrollTop = mainElement.scrollTop;
    mainElement.parentElement.replaceChild(newElement, mainElement);
    if(autoScroll) newElement.scrollTop = _scrollTop
}

module.exports = changeContent