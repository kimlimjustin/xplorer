/**
 * Function to create popup window
 * @param {string} frameName - what type of popup you want to create?
 * @returns {any}
 */
const Popup = (frameName) => {
    if (frameName === "new file") {
        window.open("", 'newFile', 'minWidth=200,minHeight=100,frame=true')
    }
}

module.exports = Popup