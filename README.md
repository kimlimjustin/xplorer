<div align="center">
<img height=100 src="https://repository-images.githubusercontent.com/360936748/a0855a00-bb4a-11eb-8e22-5f868d7b5f66" />
<h2>Xplorer</h2>
</div>

<p align="center"><span>A customizable, modern and cross-platform file explorer.</span></p>

---

## What is Xplorer?
Xplorer is a modern file explorer that supports multiple platform built on the top of JavaScript. Xplorer is currently on development progress. Suggest improvement on Xplorer [here](https://github.com/kimlimjustin/xplorer/discussions/2).

## Structure
```
.
├── build               // Icon sources for building app
├── lib                 // Library needed for xplorer app
│   └── node-disk-info  // Detect user's node disk
│   |   ├── classes
│   |   ├── platforms
│   |   └── utils
│   └── tilt            // Tilt effect of card
└── src                 // Source code of the Xplorer
    ├── Components      // Components of Xplorer
    ├── config          // JSON files of user preferences
    ├── Functions       // Functions that frequently being called
    │   ├── DOM         // Functions that change DOM property
    │   ├── Files       // Functions to deal with file
    │   ├── Filter      // Functions to filter files and directories
    │   ├── Math        // Math functions
    │   ├── preview     // Functions to show preview of a file
    │   ├── tab         // Functions to handle with tab
    │   └── Theme       // Functions that change Xplorer theme
    ├── icon            // Icon used inside Xplorer
    │   ├── extension   // Icon for an extension of a file
    │   ├── folder      // Icon for a folder
    │   └── sidebar     // Icon for the sidebar
    ├── Languages       // Multilingual resources for Xplorer
    └── public          // Basic HTML and CSS files
```
## Local Setup
- Download and install [node js](https://nodejs.org/en/).
- Clone this repository
- Install dependencies by running `npm install` command.
- Start development by running `npm start` command.

## LICENSE
[Apache-2.0](https://github.com/kimlimjustin/xplorer/blob/master/LICENSE)
