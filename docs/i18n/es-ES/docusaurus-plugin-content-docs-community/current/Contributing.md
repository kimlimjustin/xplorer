---
sidebar_position: 2
---

# Aportar

En primer lugar, ¡gracias por tomarse el tiempo para contribuir!

Xplorer se encuentra actualmente en desarrollo. Estamos dando la bienvenida a los colaboradores que deseen ayudar en Xplorer.

## Involúcrate

Hay muchas maneras de contribuir a Xplorer, y muchas de ellas no implican escribir nada código. Aquí tienes algunas ideas para empezar:

-   ¡Empieza a usar Xplorer! Go through the Tutorial guides. ¿Funciona todo tal y como esperabas? Si no es así, estamos siempre buscando mejoras. Háganos saber abriendo una nuevo problema.
-   Mira a través de los [problemas de Xplorer](https://github.com/kimlimjustin/xplorer/issues). Si encuentras un problema que te gustaría corregir, [abre una solicitud de extracción](#your-first-pull-request). Los problemas etiquetados como [primera petición](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) son un buen lugar para empezar.
-   Help us make the docs better. Crea un nuevo problema si encuentras algo que está siendo confuso, algún error gramatical, o si algo puede ser mejorado.
-   Take a look at [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) and give your opinion into a discussion or consider opening a pull request if you see something you want to work on.

¡Los contribuidores son siempre bienvenidos!

## Nuestro proceso de desarrollo

Xplorer utiliza [GitHub](https://github.com/kimlimjustin/xplorer) como su fuente inicial. The core team will work directly there. Todos los cambios serán públicos desde el comienzo.

### Reportando nuevos problemas/errores. {#issues}

Cuando [abra un nuevo problema](https://github.com/kimlimjustin/xplorer/issues), siempre asegúrese de rellenar la plantilla de problemas. Utilizamos problemas de GitHub para rastrear errores públicos. Por favor, asegúrese de que su descripción es clara y tiene suficientes instrucciones para poder reproducir el problema.

-   _Un problema, un error_: Por favor, informe de un solo error por cada problema.
-   _Proporciona pasos de reproducción_: Lista todos los pasos necesarios para reproducir el problema. La persona que lea tu informe de fallo debería ser capaz de seguir estos pasos para reproducir su problema con un mínimo esfuerzo.

### Solicita una característica {#feat}

We use [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) to track ideas from users. Suggest a new feature [here](https://github.com/kimlimjustin/xplorer/discussions/new)! Great Feature Requests tend to have:

-   A quick idea summary.
-   What & why you wanted to add the specific feature.
-   Additional references like images, links of resources about the feature, etc.

## Working on Xplorer code

### Prerequisite

-   [Node JS](https://nodejs.org/en/)
-   [Git](https://git-scm.com/)
-   [yarn](https://yarnpkg.com/)
-   [GCC Compiler](https://gcc.gnu.org/)
-   Code Editor, we recommend you to use [VS Code](https://code.visualstudio.com/)

### Installation

1. After cloning the repository, run `yarn` in the root of the repository and run `yarn` in the `docs` folder (if you want to working on Xplorer Docs).
2. To start Xplorer locally:

    - run `yarn start` in the root of the repository if you **don't want** the hot reload feature.
    - run `yarn dev` in the root of the repository if you **want** the hot reload feature.

    To start a local development server serving the Docusaurus docs, go into the `docs` directory and run `yarn start`

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
2. `docs/docs` files
3. `docs/i18n/en` files
4. `docs/community` files

#### Production

Once the files on `src/Locales` have been translated for more than 80%, we will add it into the Xplorer app, and for the docs, we will add it into production once the translation looks good!

Please comment [here](https://github.com/kimlimjustin/xplorer/discussions/30) if you have any questions!

### Files Icon

Files icons are available on [`src/Icon`](https://github.com/kimlimjustin/xplorer/tree/master/src/Icon). You can add an icon by doing these steps:

-   Paste the new icon in `src/icon`
-   Edit the value of [`src/Components/Files/File Icon/icon.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/Components/Files/File%20Icon/icon.json)

### File Type library

The files type library is available on [`src/Components/Files/File Type/type.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/Components/Files/File%20Type/type.json).

You can add the type of file extension by adding value to the file.
