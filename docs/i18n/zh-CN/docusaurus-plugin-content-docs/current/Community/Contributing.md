---
sidebar_position: 2
---

# 参与贡献

👍🎉 首先, 感谢您花时间来贡献! 🎉👍

Xplorer目前正在开发中。 我们欢迎您参与 Xplorer 的开发。

## 参与

您有诸多方式可以为 Xplorer 做出贡献，其中大多数无需您撰写甚至一行代码。 您可以从这些想法开始：

-   开始使用 Xplorer ！ 请转到入门指南。 每一步都如教程所写的能正常工作吗？ 如果没有，我们总是在寻求改进。 通过提出一个 Issues，让我们了解情况。
-   查看 [Xplorer Issues](https://github.com/kimlimjustin/xplorer/issues)。 若您有想修复的Issues，请[提交合并请求](#your-first-pull-request)。 标记为 [_头号好议题 (Good first issue)_](https://github.com/facebook/docusaurus/labels/Good%20first%20issue) 的都是好出发点。
-   帮助我们改进文档。 如果您发现任何令人困惑的语文，或者任何语法错误，或者可以改进，请提交问题。
-   查看 [GitHub 讨论](https://github.com/kimlimjustin/xplorer/discussions) 并将您的意见提交讨论，如果您看到一些你想要解决的问题，就考虑打开拉取请求。

我们十分欢迎您的贡献。

## 开发流程

Docusaurus 使用 [GitHub](https://github.com/facebook/docusaurus) 作为其万物根基。 核心团队将使用此平台。 自初始的任何更改均为公共可见。

### 提交新议题 {#issues}

当[提交新议题时](https://github.com/facebook/docusaurus/issues/new/choose)，请务必确保您填写了议题模板。 我们使用 GitHub 问题来跟踪公开的漏洞。 请确保您的描述清晰，并且有足够的指示来复制问题。

-   **议题，一提：**请只对一个漏洞提交一个议题。
-   **提供重现步骤：**列出足以重现此问题的全部步骤。 阅读您漏洞反馈的人应能根据您所提供的步骤来重现问题。

### 建议新功能 {#feat}

我们使用 [GitHub 讨论](https://github.com/kimlimjustin/xplorer/discussions) and [GitHub Issues](https://github.com/kimlimjustin/xplorer) 追踪用户的想法。 在这里建议一个新功能 [](https://github.com/kimlimjustin/xplorer/discussions/new)！ 优秀的功能请求通常含有：

-   功能概要
-   什么 & 为何你想添加此功能
-   附加附件，如图像，实现功能的资源链接等。

## 在 Xplorer 代码上工作

### 前提条件

-   [Tauri 环境](https://tauri.studio/en/docs/getting-started/intro#setting-up-your-environment)
-   [Node JS](https://nodejs.org/en/)
-   [Git](https://git-scm.com/)
-   [yarn](https://yarnpkg.com/)
-   代码编辑器，我们建议您使用 [VS Code](https://code.visualstudio.com/)

### 安装

1. 在克隆仓库后， 在资源库的根目录下运行 `yarn` 并运行 `yarn` 在 `文档` 文件夹中(如果你想在 Xplorer 文档上工作的话)。
2. 要在本地启动 Xplorer，请运行 `yarn dev`。

    要开启 Docusaurus 本地开发服务器，前往 `website` 目录并运行 `yarn start`

### Gitpod {#gitpod-env}

Gitpod is a Ready-to-Code environment in which you can get started immediately. Gitpod offers all dependencies pre-installed so you can just click and get started.

To get started with Gitpod, click the button below and log in with your GitHub account.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/kimlimjustin/xplorer)

:::note Remember to reload the Gitpod website after it loads up since it won't start the servers immediately, but by reloading, you can get it started. If you are developing the app, go to the Remote Explorer on the sidebar and visit port _6080_ which opens the noVNC app server. If you are developing the docs, go to the Remote explorer but instead of port 6080, visit port _3000_. You can edit normally as you do in VS Code, but if you want to use it locally, clik the hamburger menu button and click _Open in VS Code_. :::

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
