const { updateTheme } = require('../Functions/Theme/theme');
const remote = require('@electron/remote');
const storage = require('electron-json-storage-sync');
const Translate = require('./multilingual');

//  Function to create new tab
const createNewTab = (path) => {
    const createNewTabElement = document.querySelector(".create-new-tab")
    let tabsInfo = storage.get("tabs")?.data // Fetch latest tabs information

    const newTab = document.createElement("div");
    newTab.classList.add('tab');
    newTab.classList.add('tab-hover-effect');
    newTab.innerHTML = `<span id='tab-position'>${Translate("Home")}</span><span class='close-tab-btn'>&times;</span>`;
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
            const tabs = storage.get("tabs")?.data
            tabs.focusHistory = tabs.focusHistory.filter(tabIndex => String(tabIndex) !== String(newTab.dataset.tabIndex))
            if (String(tabsInfo.focus) === String(newTab.dataset.tabIndex)) tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1])
            delete tabs.tabs[newTab.dataset.tabIndex]
            storage.set("tabs", tabs)
            newTab.parentElement.removeChild(newTab)

            const { openDir } = require("../Functions/Files/open");
            openDir(tabs.tabs[tabs.focus].position)
        }
    })
    createNewTabElement.parentElement.insertBefore(newTab, createNewTabElement) // Insert the new tab
    newTab.parentNode.scrollLeft = window.pageXOffset + newTab.getBoundingClientRect().left + newTab.offsetWidth // Scroll the tabs scrollbar

    // Scroll the tab to the right end
    newTab.parentNode.scrollLeft = newTab.parentNode.scrollWidth

    // Edit tabs information
    tabsInfo.tabs[String(tabsInfo.latestIndex)] = { position: path || "Home", history: ["Home"], currentIndex: -1 }
    tabsInfo.focus = String(tabsInfo.latestIndex)
    tabsInfo.focusHistory.push(tabsInfo.latestIndex)
    storage.set('tabs', tabsInfo)

    const { openDir } = require("../Functions/Files/open");
    openDir(path || "Home")

    newTab.addEventListener("click", () => {
        SwitchTab(newTab.dataset.tabIndex)
    })
    return;
}

const SwitchTab = (tabIndex) => {
    const tabs = storage.get('tabs')?.data
    tabs.focus = String(tabIndex)
    tabs.focusHistory.push(parseInt(tabIndex))
    tabs.tabs[tabs.focus].currentIndex -= 1
    storage.set('tabs', tabs)
    const { openDir } = require("../Functions/Files/open");
    openDir(tabs.tabs[tabIndex].position)
}

const Tab = () => {
    let tabsInfo = { focus: "1", tabs: { 1: { position: "Home", history: ["Home"], currentIndex: 0 } }, focusHistory: [1], latestIndex: 1 } // default tabs information
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
                const tabs = storage.get('tabs')?.data
                tabs.focusHistory = tabs.focusHistory.filter(tabIndex => tabIndex !== index + 1)
                tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1])
                delete tabs.tabs[index + 1]
                storage.set("tabs", tabs)

                const { openDir } = require("../Functions/Files/open");
                openDir(tabs.tabs[tabs.focus].position)
            }
        })
        tab.appendChild(closeTab)

        tab.querySelector("#tab-position").innerText = Translate(tab.querySelector("#tab-position").innerText)

        tab.addEventListener("click", () => {
            SwitchTab(index + 1)
        })

    })

    const createNewTabElement = document.querySelector(".create-new-tab")

    // Create a new tab event
    createNewTabElement.addEventListener('click', () => createNewTab())

    // Function to navigate backward
    const goBack = () => {
        const tabs = storage.get('tabs')?.data;
        const { openDir } = require("../Functions/Files/open");
        const _focusingTab = tabs.tabs[tabs.focus]
        if (_focusingTab.currentIndex > 0) {
            tabs.tabs[tabs.focus].currentIndex -= 1
            tabs.tabs[tabs.focus].position = _focusingTab.history[_focusingTab.currentIndex]

            storage.set("tabs", tabs)
            openDir(_focusingTab.history[_focusingTab.currentIndex])
        }
    }

    // Function to navigate forward
    const goForward = () => {
        const tabs = storage.get('tabs')?.data;
        const { openDir } = require("../Functions/Files/open");
        const _focusingTab = tabs.tabs[tabs.focus]
        if (_focusingTab.currentIndex >= 0 && _focusingTab.history?.[_focusingTab.currentIndex + 1]) {
            tabs.tabs[tabs.focus].currentIndex += 1
            tabs.tabs[tabs.focus].position = _focusingTab.history[_focusingTab.currentIndex]

            storage.set("tabs", tabs)
            openDir(_focusingTab.history[_focusingTab.currentIndex])
            storage.set("tabs", tabs)
        }
    }

    // shortcuts for tabs
    const shortcut = e => {
        if (e.ctrlKey && e.key === "t") { // Shortcut for new tab
            createNewTab()
            updateTheme()
        } else if (e.ctrlKey && e.key === "e") { // Shortcut for exit tab
            const tabs = storage.get('tabs')?.data
            if (document.querySelectorAll(".tab").length === 1) {
                const electronWindow = remote.BrowserWindow.getFocusedWindow()
                electronWindow.close()
            } else {
                const tab = document.getElementById(`tab${tabs.focus}`)
                tab.parentElement.removeChild(tab)
                tabs.focusHistory = tabs.focusHistory.filter(tabIndex => String(tabIndex) !== tabs.focus)
                tabs.focus = String(tabs.focusHistory[tabs.focusHistory.length - 1])
                delete tabs.tabs[tabs.focus]
                storage.set("tabs", tabs)
            }
        } else if (e.altKey && e.key === "ArrowLeft") {
            goBack()
        } else if (e.altKey && e.key === "ArrowRight") {
            goForward()
        }
    }
    document.addEventListener("keydown", shortcut, false)

    // Scroll the tabs
    document.querySelector(".tabs-manager").addEventListener("wheel", e => {
        e.deltaY > 0 ? document.querySelector(".tabs-manager").scrollLeft += 25 : document.querySelector(".tabs-manager").scrollLeft -= 25;
    })

    document.getElementById("go-back").addEventListener("click", () => goBack())
    document.getElementById("go-forward").addEventListener("click", () => goForward())
}

module.exports = { Tab, createNewTab }