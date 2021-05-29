const ContextMenu = element => {
    element.addEventListener("contextmenu", e => {
        const contextMenu = document.querySelector(".contextmenu");
        contextMenu.style.left = e.pageX + "px";
        contextMenu.style.top = e.pageY + "px";
        if (contextMenu.offsetHeight + e.pageY > window.innerHeight) contextMenu.style.top = e.pageY - contextMenu.offsetHeight + "px";

        contextMenu.innerHTML = `<span>Open</span><span>Cut</span><span>Copy</span><span>Copy Location</span><span>Create Shortcut<span>Rename</span><span>Delete</span><span>Pin to Sidebar</span><span>Properties</span>`

        const exitContextMenu = () => {
            contextMenu.style.left = "-100vw";
            contextMenu.style.top = "-100vh";
            document.body.removeEventListener("click", exitContextMenu)
        }
        document.body.addEventListener("click", exitContextMenu)
    })
}
module.exports = ContextMenu