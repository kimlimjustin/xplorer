const { updateTheme } = require('../Functions/Theme/theme');
const remote = require('@electron/remote');
const storage = require('electron-json-storage-sync');
const { openDir } = require("../Functions/Files/open");

const Tab = () => {
    let tabsInfo = { focus: "1", tabs: { 1: "Home" }, focusHistory: [1], latestIndex: 1 } // default tabs information
    // Store default tabs information into local storage
    storage.set("tabs", tabsInfo)

    // Add close tab button
    document.querySelectorAll(".tab").forEach((tab, index) => {
        const closeTab = document.createElement("span");
        closeTab.innerHTML = "&times;"
        tab.dataset.tabIndex = index + 1
        closeTab.classList.add("close-tab-btn");
        // Listen to close tab button
        closeTab.addEventListener("click", e => {
            e.stopPropagation()
            // Close the window if user close the only tab
            if (document.querySelectorAll(".tab").length === 1) {
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            } else {
                tab.parentElement.removeChild(tab)
                tabsInfo.focusHistory = tabsInfo.focusHistory.filter(tabIndex => tabIndex !== index + 1)
                tabsInfo.focus = tabsInfo.focusHistory[tabsInfo.focusHistory.length - 1]
                delete tabsInfo.tabs[index + 1]
                storage.set("tabs", tabsInfo)
            }
        })
        tab.appendChild(closeTab)

        tab.addEventListener("click", () => {
            const tabs = storage.get('tabs')?.data
            tabs.focus = index + 1
            tabs.focusHistory.push(index + 1)
            storage.set('tabs', tabs)
            openDir(tabs.tabs[index + 1])
        })

    })

    const createNewTabElement = document.querySelector(".create-new-tab")
    //  Function to create new tab
    const createNewTab = e => {
        tabsInfo = storage.get("tabs")?.data // Fetch latest tabs information

        const newTab = document.createElement("div");
        newTab.classList.add('tab');
        newTab.innerHTML = "<span id='tab-position'>Home</span><span class='close-tab-btn'>&times;</span>";
        tabsInfo.latestIndex += 1
        newTab.dataset.tabIndex = tabsInfo.latestIndex
        newTab.id = `tab${tabsInfo.latestIndex}`

        updateTheme() // Update the theme
        // Listen to close tab button
        newTab.querySelector(".close-tab-btn").addEventListener("click", e => {
            e.stopPropagation()
            // Close the window if user close the only tab
            if (document.querySelectorAll(".tab").length === 1) {
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            } else {
                tabsInfo.focusHistory = tabsInfo.focusHistory.filter(tabIndex => String(tabIndex) !== String(newTab.dataset.tabIndex))
                if (String(tabsInfo.focus) === String(newTab.dataset.tabIndex)) tabsInfo.focus = tabsInfo.focusHistory[tabsInfo.focusHistory.length - 1]
                delete tabsInfo.tabs[newTab.dataset.tabIndex]
                storage.set("tabs", tabsInfo)
                newTab.parentElement.removeChild(newTab)
            }
        })
        createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement) // Insert the new tab
        newTab.parentNode.scrollLeft = window.pageXOffset + newTab.getBoundingClientRect().left + newTab.offsetWidth // Scroll the tabs scrollbar

        // Scroll the tab to the right end
        newTab.parentNode.scrollLeft = newTab.parentNode.scrollWidth

        // Edit tabs information
        tabsInfo.tabs[String(tabsInfo.latestIndex)] = "Home"
        tabsInfo.focus = tabsInfo.latestIndex
        tabsInfo.focusHistory.push(tabsInfo.latestIndex)
        storage.set('tabs', tabsInfo)
        openDir("Home")

        newTab.addEventListener("click", () => {
            const tabs = storage.get('tabs')?.data
            tabs.focus = newTab.dataset.tabIndex
            tabs.focusHistory.push(parseInt(newTab.dataset.tabIndex))
            storage.set('tabs', tabs)
            openDir(tabs.tabs[newTab.dataset.tabIndex])
        })
    }

    // Create a new tab event
    createNewTabElement.addEventListener('click', createNewTab)
    // Add new tab shortcut
    const shortcut = e => {
        if (e.ctrlKey && e.key === "t") { // Shortcut for new tab
            createNewTab()
            updateTheme()
        } else if (e.ctrlKey && e.key === "w") { // Shortcut for exit tab
            const tabs = storage.get('tabs')?.data
            if (Object.keys(tabs.tabs).length === 1) {
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            } else {

            }
        }
    }
    document.addEventListener("keyup", shortcut, false)

    // Scroll the tabs
    document.querySelector(".tabs-manager").addEventListener("wheel", e => {
        e.deltaY > 0 ? document.querySelector(".tabs-manager").scrollLeft += 25 : document.querySelector(".tabs-manager").scrollLeft -= 25;
    })
}

module.exports = Tab