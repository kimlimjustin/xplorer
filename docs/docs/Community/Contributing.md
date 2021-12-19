---
sidebar_position: 2
---

# Contribute

👍🎉 First off, thanks for taking the time to contribute! 🎉👍

Xplorer is currently under heavy development. We are welcoming contributors to collaborate on Xplorer.

## Get involved

There are many ways to contribute to Xplorer, and many of them do not involve writing any code. Here are few ideas to get started:

-   Start using Xplorer! Go through the Tutorial guides. Does anything work as expected? If not, we're always looking for improvements. Let us know by opening an issue.
-   Look through the [Xplorer issues](https://github.com/kimlimjustin/xplorer/issues). If you find an issue you would like to fix, [open a pull request](#first-pull-request). Issues tagged as [good first issue](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) are a good place to get started.
-   Help us make the docs better. File an issue if you find anything that is confusing, any grammatical error, or can be improved.
-   Take a look at [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) and give your opinion into a discussion or consider opening a pull request if you see something you want to work on.

Contributions are very welcome!

## Our development process

Xplorer uses [GitHub](https://github.com/kimlimjustin/xplorer) as its source of truth. The core team will work directly there. All changes will be public from the beginning.

### Reporting new issues/bugs. {#issues}

When [opening a new issue](https://github.com/kimlimjustin/xplorer/issues), always make sure to fill out the issue template. We use GitHub issues to track public bugs. Please ensure your description is clear and has sufficient instructions to be able to reproduce the issue.

-   _One issue, one bug_: Please report a single bug per issue.
-   _Provide reproduction steps_: List all the steps necessary to reproduce the issue. The person reading your bug report should be able to follow these steps to reproduce your issue with minimal effort.

### Feature Request {#feat}

We use [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) and [GitHub Issues](https://github.com/kimlimjustin/xplorer) to track ideas from users. Suggest a new feature [here](https://github.com/kimlimjustin/xplorer/discussions/new)!
Great Feature Requests tend to have:

-   A quick idea summary.
-   What & why you wanted to add the specific feature.
-   Additional references like images, links of resources about the feature, etc.

## Working on Xplorer code

### Prerequisite

-   [Tauri environment](https://tauri.studio/en/docs/getting-started/intro#setting-up-your-environment)
-   [Node JS](https://nodejs.org/en/)
-   [Git](https://git-scm.com/)
-   [yarn](https://yarnpkg.com/)
-   Code Editor, we recommend you to use [VS Code](https://code.visualstudio.com/)

### Installation

1. After cloning the repository, run `yarn` in the root of the repository and run `yarn` in the `docs` folder (if you want to working on Xplorer Docs).
2. To start Xplorer locally, run `yarn dev`.

    To start a local development server serving the Docusaurus docs, go into the `docs` directory and run `yarn start`

### Gitpod for Xplorer's development {#gitpod-env}

The easiest way to run Xplorer in Gitpod is to use the [Gitpod](https://gitpod.io/) service, all what you need to do is to click the button below and log in with your GitHub account. Afterwards, you will see a VS Code-like environment where you can start developing and pushing your changes. Please note that you may have to wait up to minutes to get Xplorer running on the poped up VNC tab.

## [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#/https://github.com/kimlimjustin/xplorer)

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

-   `feat`: new feature for the user
-   `fix`: bug fix for the user
-   `docs`: changes to the documentation
-   `style`: formatting, missing semi-colons, etc.
-   `refactor`: refactoring production code, eg. renaming a variable
-   `test`: adding missing tests, refactoring tests.
-   `chore`: updating grunt tasks etc

Use lower case not the upper case!

## Working on Xplorer docs

Xplorer documentation website is built using [Docusaurus 2](https://docusaurus.io/), and its code is located at [`docs`](https://github.com/kimlimjustin/xplorer/tree/master/docs) folder.

### Prerequisite

-   [node js](https://nodejs.org/en/)
-   [git](https://git-scm.com/downloads)
-   [yarn](https://yarnpkg.com/getting-started/install#about-global-installs)
-   Code Editor, we recommend you to use [VS Code](https://code.visualstudio.com/)

### Installation

After cloning the repository, run `yarn` in the `docs` folder (you can go into the `docs` folder by running the `cd docs` command).

If you want to use Gitpod, click [here](#gitpod-env) for the guide on how to use Gitpod.

### Local development

1. Run the `yarn start` command in the `docs` folder.
2. Edit some markdown texts in the `docs` folder and the website will be hot reloaded.

## Pull requests

### Your first pull request. {#first-pull-request}

So you have decided to contribute code back to upstream by opening a pull request. You've invested a good chunk of time, and we appreciate it. We will do our best to work with you and get the PR looked at.

Working on your first Pull Request? You can learn how from this free video series:

How to Contribute to an Open Source Project on GitHub

We have a list of [beginner-friendly issues](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) to help you get your feet wet in the Xplorer codebase and familiar with our contribution process. This is a great place to get started.

### Proposing a change

If you would like to request a new feature or enhancement but are not yet thinking about opening a pull request, you can also [open a discussion](#feat) and others will code it!

If you intend to fix a bug, please discuss it through [Issues](#issues) before submitting a pull request.

If you intend to add a new feature, please discuss it through [GitHub Discussions](#feat) to avoid multiple people working on the same feature request.

### Sending a Pull Request

make sure the PR does only one thing, otherwise please split it. It is recommended to follow this [commit message style](#commit-msg).

1. Fork [the repository](https://github.com/kimlimjustin/xplorer) and create your branch from `master`.
2. Make changes and ensure your commit message is understandable.
3. Open a [PR](https://github.com/kimlimjustin/xplorer/pulls) and ensure to describe your pull request clearly.

## Working on Xplorer resources

### Locales

We host our locales on the [crowdin](https://crwd.in/xplorer). To translate it, please follow these steps:

-   Sign up on [Crowdin](https://crowdin.com) and Join our project [here](https://crwd.in/xplorer).
-   Make sure your locale exists there, if it does not exist, leave a comment in [this discussion](https://github.com/kimlimjustin/xplorer/discussions/30) and I'll add the language option :)
-   Get familiar with the Crowdin translation UI, as you will need to use it to translate JSON and Markdown files
-   Translate the content!

#### Priority Files to translate on Crowdin

1. `src/Locales` files
2. `docs/` files

#### Production

Once the files on `src/Locales` have been translated for more than 80%, we will add it into the Xplorer app, and for the docs, we will add it into production once the translation looks good!

Please comment [here](https://github.com/kimlimjustin/xplorer/discussions/30) if you have any questions!

### File Library

The json library of file types and thumbnail are found under `lib` folder and the icons are found under `src/Icons` folder. You may add file types and icons for file extensions you want to use and submit a PR.
