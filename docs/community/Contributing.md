---
sidebar_position: 2
---
# Contribute
👍🎉 First off, thanks for taking the time to contribute! 🎉👍

Xplorer is currently under development. We are welcoming contributors to collborate on Xplorer.

## Get involved
There are many ways to contribute to Xplorer, and many of them do not involve writing any code. Here are few ideas to get started:
- Start using Xplorer! Go trough the Tutorial guides. Does anything work as expected? If not, we're always looking for improvements. Let us know by opening an issue.
- Look through the [Xplorer issues](https://github.com/kimlimjustin/xplorer/issues). If you find an issue you would like to fix, [open a pull request](#first-pull-request). Issues tagged as [good first issue](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) are a good place to get started.
- Help us making the docs better. File an issue if you find anything that is confusing, any grammatical error, or can be improved.
- Take a look at the [GitHub Discussion](https://github.com/kimlimjustin/xplorer/discussions) and give your opinion into a discussion or consider opening a pull request if you see something you want to work on.

Contributions are very welcome!

## Our development process
Xplorer uses [GitHub](https://github.com/kimlimjustin/xplorer) as its source of truth. The core team will be working directly there. All changes will be public from the beginning.

### Reporting new issues/bugs. {#issues}
When [opening a new issue](https://github.com/kimlimjustin/xplorer/issues), always make sure to fill out the issue template. We use GitHub issues to track public bugs. Please ensure your description is clear and has sufficient instructions to be able to reproduce the issue.
- *One issue, one bug*: Please report a single bug per issue.
- *Provide reproduction steps*: List all the steps necessary to reproduce the issue. The person reading your bug report should be able to follow these steps to reproduce your issue with minimal effort.

### Feature Request {#feat}
We use [GitHub Discussion](https://github.com/kimlimjustin/xplorer/discussions) to track ideas from users. Suggest a new feature [here](https://github.com/kimlimjustin/xplorer/discussions)!
Great Feature Requests tend to have:
- A quick idea summary.
- What & why you wanted to add the specific feature.
- Additional context like images, links to resources to implement the feature, etc.

## Working on Xplorer code
### Prerequisite

- [node js](https://nodejs.org/en/)
- [git](https://git-scm.com/)
- [yarn](https://yarnpkg.com/)
- [gcc compiler](https://gcc.gnu.org/)
### Installation
1. After cloning the repository, run `yarn` in the root of the repository and run `yarn` in the `docs` folder (if you want to working on Xplorer Docs).
2. To start Xplorer locally, run `yarn start` in the root of the repository.

    To start a local development server serving the Docusaurus docs, go into `docs` directory and run `yarn start`

### Semantic commit messages {#commit-msg}
See how a minor change to your commit message style can make you a better programmer.

Format: `<type>(<scope>): <subject>`

`<scope>` is optional

#### Example
```
feat: allow overriding of webpack config
^--^  ^------------^
|     |
|     +-> Summary in present tense.
|
+-------> Type: chore, docs, feat, fix, refactor, style, or test.
```

the various types of commits:
- `feat`: new feature for the user
- `fix`: bug fix for the user
- `docs`: changes to the documentation
- `style`: formatting, missing semi colons, etc.
- `refactor`: refactoring production code, eg. renaming a variable
- `test`: adding missing tests, refactoring tests.
- `chore`: updating grunt tasks etc

Use lower case not title case!

### Code Structure
```
.
├── build               // Web Assembly builds
├── docs                // Xplorer documentation source
├── icons               // Icon sources for building xplorer
├── lib                 // Library needed for xplorer app
│   └── node-disk-info  // Detect user's node disk
│   ├── tilt            // Tilt effect of card
│   └── wasm            // C/C++ programs for wasm
└── src                 // Source code of the Xplorer
│   ├── Components      // Components of Xplorer
│   ├── config          // JSON files of user preferences
│   ├── Functions       // Functions that frequently being called
│   │   ├── DOM         // Functions that change DOM property
│   │   ├── Files       // Functions to deal with file
│   │   ├── Logs        // Log messages
│   │   ├── Math        // Math functions
│   │   ├── preview     // Functions to show preview of a file
│   │   ├── Tab         // Functions to handle with tab
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

## Pull requests
### Your first pull request. {#first-pull-request}
So you have decided to contribute code back to upstream by opening a pull request. You've invested a good chunk of time, and we appreciate it. We will do our best to work with you and get the PR looked at.

Working on your first Pull Request? You can learn how from this free video series:

How to Contribute to an Open Source Project on GitHub

We have a list of [beginner friendly issues](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) to help you get your feet wet in the DXplorer codebase and familiar with our contribution process. This is a great place to get started.

### Proposing a change
If you would like to request a new feature or enchancement but are not yet thninking about opening a pull request, you can also [open an discussion](#feat) and others will code it!

If you intend to fixing a bug, please discuss it through [Issues](#issues) before submitting a pull request.

If you intend to add a new feature, please discuss it through [GitHub Discussion](#feat) to avoid multiple people working on a same feature request.

### Sending a Pull Request
make sure the PR does only one thing, otherwise please split it. It is recommended to follow this [commit message style](#commit-msg).
1. Fork [the repository](https://github.com/kimlimjustin/xplorer) and create your branch from `master`.
2. Make changes and ensure your commit message is understandable.
3. Open a [PR](https://github.com/kimlimjustin/xplorer/pulls) and ensure to describe your pull request clearly.

## Working on Xplorer resources
### Multilingual Resources
Multilingual resources are available on [`src/Languages`](https://github.com/kimlimjustin/xplorer/tree/master/src/Languages).
You can add your language by doing these steps:
- Create a new file with `<Language Code>.json` file name format.
- Copy the JSON code from one of those languages available there.
- Paste in your language JSON and edit the value.
- Add a value on `availableLanguages` inside `index.json` which your language code as key, and the language name as value.
- Open a [Pull Request.](#pull-requests)

### Files Icon
Files icons are available on [`src/icon`](https://github.com/kimlimjustin/xplorer/tree/master/src/icon).
You can add an icon by doing these steps:
- Paste the new icon in `src/icon`
- Edit value of [`src/config/icon.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/config/icon.json)

### File type library
Files type library is available on [`src/config/type.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/config/type.json).

You can add type of a file extension by adding value on the file.