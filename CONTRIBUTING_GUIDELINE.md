# Contributing to Xplorer
👍🎉 First off, thanks for taking the time to contribute! 🎉👍

## Code Of Conduct
The code of conduct is described in `CODE_OF_CONDUCT.md`

## Issues
We use GitHub issues to track public bugs. Please ensure your description is clear and has sufficient instructions to be able to reproduce the issue. Report a bug by opening a new issue [here](https://github.com/kimlimjustin/xplorer/issues). Please use [GitHub Discussion](https://github.com/kimlimjustin/xplorer/discussions) instead to suggest a new feature.

## Feature Request
We use [GitHub Discussion](https://github.com/kimlimjustin/xplorer/discussions) to track ideas from users. Suggest a new feature [here](https://github.com/kimlimjustin/xplorer/discussions)!
Great Feature Requests tend to have:
- A quick idea summary.
- What & why you wanted to add the specific feature.
- Additional context like images, links to resources to implement the feature, etc.

## Pull Requests
Pull Requests are the way concrete changes are made to the code, documentation, dependencies, and tools contained in the Xplorer repository. Please make sure to [discuss your feature](#feature-request) before opening a PR.
1. Fork the repo and create your branch.
2. Make changes and ensure your commit message is understandable.
3. Open a [PR](https://github.com/kimlimjustin/xplorer/pulls) and ensure to describe your pull request clearly.

## Multilingual Resources
Multilingual resources are available on [`src/Languages`](https://github.com/kimlimjustin/xplorer/tree/master/src/Languages).
You can add your language by doing these steps:
- Create a new file with `<Language Code>.json` file name format.
- Copy the JSON code from one of those languages available there.
- Paste in your language JSON and edit it.
- Add a value on `availableLanguages` inside `index.json` which your language code as key, and the language name as value.
- Open a [Pull Request.](#pull-requests)


## Structure
```
.
├── build               // Web Assembly builds
├── icons               // Icon sources for building xplorer
├── lib                 // Library needed for xplorer app
│   └── node-disk-info  // Detect user's node disk
│   |   ├── classes
│   |   ├── platforms
│   |   └── utils
│   ├── tilt            // Tilt effect of card
│   └── wasm            // C/C++ programs for wasm
└── src                 // Source code of the Xplorer
│   ├── Components      // Components of Xplorer
│   ├── config          // JSON files of user preferences
│   ├── Functions       // Functions that frequently being called
│   │   ├── DOM         // Functions that change DOM property
│   │   ├── Files       // Functions to deal with file
│   │   ├── Math        // Math functions
│   │   ├── preview     // Functions to show preview of a file
│   │   ├── tab         // Functions to handle with tab
│   │   └── Theme       // Functions that change Xplorer theme
│   ├── icon            // Icon used inside Xplorer
│   │   ├── contextmenu // Icon for context menu's menu
│   │   ├── extension   // Icon for an extension of a file
│   │   ├── folder      // Icon for a folder
│   │   ├── settings    // Icon for settings
│   │   └── sidebar     // Icon for the sidebar
│   ├── Languages       // Multilingual resources for Xplorer
│   └── public          // Basic HTML and CSS files
└── test                // Testing code
```

## Setup Xplorer Locally
#### Prerequisite: 

- [node js]((https://nodejs.org/en/))
- [git](https://git-scm.com/)
- [yarn](https://yarnpkg.com/)
- [gcc compiler](https://gcc.gnu.org/)

#### Install dependencies
- Install dependencies by running `yarn` command.

#### Run
- Run Xplorer locally by running `yarn start` command

#### Commands available
- `yarn`              - Install dependencies
- `yarn start`        - Running Xplorer locally
- `yarn build`        - Packaging Xplorer
- `yarn build-wml`    - Packaging Xplorer for windows, macOS, and Linux operating systems.
- `yarn test`         - Run unit test
- `yarn native_build` - compile c++

## License
By contributing to Xplorer, you agree that your contributions will be licensed under the [Apache-2.0 License](https://github.com/kimlimjustin/xplorer/blob/master/LICENSE).