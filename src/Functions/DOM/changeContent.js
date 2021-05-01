// Function to change main element content
const changeContent = newElement => {
    newElement.id = "main";
    const mainElement = document.body.querySelector("#main");
    mainElement.parentElement.replaceChild(newElement, mainElement);
}

module.exports = changeContent