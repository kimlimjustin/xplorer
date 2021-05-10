const updateTheme = require("../Functions/Theme/updateTheme");
const remote = require('@electron/remote');
const Tab = () => {
    // Closing tab
    document.querySelectorAll(".tab").forEach(tab => {
        const closeTab = document.createElement("span");
        closeTab.innerHTML = "&times;"
        closeTab.classList.add("close-tab-btn");
        // Listen to close tab button
        closeTab.addEventListener("click", e => {
            e.stopPropagation()
            // Close the window if user close the only tab
            if(document.querySelectorAll(".tab").length === 1){
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            }else{
                tab.parentElement.removeChild(tab)
            }
        })
        tab.appendChild(closeTab)

    })

    const createNewTabElement = document.querySelector(".create-new-tab")
    //  Function to create new tab
    const createNewTab = e => {
        const newTab = document.createElement("div");
        newTab.classList.add('tab');
        newTab.innerHTML = "Home<span class='close-tab-btn'>&times;</span>";
        // Listen to close tab button
        newTab.querySelector(".close-tab-btn").addEventListener("click", e => {
            e.stopPropagation()
            // Close the window if user close the only tab
            if(document.querySelectorAll(".tab").length === 1){
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            }else{
                newTab.parentElement.removeChild(newTab)
            }
        })
        createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement) // Insert the new tab
        newTab.parentNode.scrollLeft = window.pageXOffset + newTab.getBoundingClientRect().left + newTab.offsetWidth // Scroll the tabs scrollbar
        updateTheme() // Update the theme

        // Scroll the tab to the right end
        newTab.parentNode.scrollLeft = newTab.parentNode.scrollWidth
    }

    // Create a new tab event
    createNewTabElement.addEventListener('click',createNewTab)
    // Add new tab shortcut
    const shortcut = e => {
        if(e.ctrlKey && e.key === "t"){
            createNewTab()
            updateTheme()
        }
    }
    document.addEventListener("keyup", shortcut, false)

    // Scroll the tabs
    document.querySelector(".tabs-manager").addEventListener("wheel", e => {
        e.deltaY > 0 ? document.querySelector(".tabs-manager").scrollLeft += 25 : document.querySelector(".tabs-manager").scrollLeft -= 25;
    })
}

module.exports = Tab