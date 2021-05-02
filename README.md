<div align="center">
<img height=100 src="https://repository-images.githubusercontent.com/360936748/2ce1b700-aa8e-11eb-877b-c12abc599979"/></div>
<p align="center"><b>Xplorer</b></p>

<p align="center">
  <strong>A customizable, modern and cross-platform file explorer.</strong>
</p>

---
# Xplorer

## What is Xplorer?
Xplorer is a modern file explorer that supports multiple platform built on the top of JavaScript. Xplorer is currently on development progress. Suggest improvement on Xplorer [here](https://github.com/kimlimjustin/xplorer/discussions/2).

## Structure
```
.
├── LICENSE             // License
├── package.json        // Dependencies list
├── README.md           // Read Me file
├── build               // Sources for compiling app
├── dist                // Compiling app output
├── node_modules        // Dependencies
└── src                 // Source code of the Xplorer
    ├── Components      // Components of Xplorer
    ├── config          // JSON files of user preferences
    ├── Functions       // Function that frequently being called
    │   ├── DOM         // Function that change DOM property
    │   ├── Math        // Math Functions
    │   └── Theme       // Function that change Xplorer theme
    ├── icon            // Icon inside Xplorer
    ├── Languages       // Multilingual resources for Xplorer
    ├── node-disk-info  // Detect user's node disk
    └── public          // Basic HTML and CSS files
```
## Local Setup
- Download and install [node js](https://nodejs.org/en/).
- Clone this repository
- Install dependencies by running `npm install` command.
- Start development by running `npm start` command.

## LICENSE
Apache
