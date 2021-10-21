---
sidebar_position: 2
---

# Contribuir

👍🎉 Em primeiro lugar, obrigado por dedicar seu tempo para contribuir! 🎉👍

O Xplorer está atualmente em desenvolvimento. Estamos convidando contribuidores para colaborar com o Xplorer.

## Participe

Existem muitas maneiras de contribuir com o Xplorer, e muitas delas não envolvem a escrita de nenhum código. Aqui estão algumas idéias para começar:

-   Comece a usar o Xplorer! Passe pelos guias de tutoriais. Tudo funciona conforme o esperado? Caso contrário, estamos sempre em busca de melhorias. Informe-nos abrindo uma issue.
-   Dê uma olhada em [ issues do Xplorer ](https://github.com/kimlimjustin/xplorer/issues). Se você encontrar um problema que gostaria de corrigir, [ abra um pull request](#first-pull-request). Problemas marcados como [bom primeiro issue](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) são um bom lugar para começar.
-   Ajude-nos a melhorar a nossa documentação. Registre um issue se encontrar algo confuso, algum erro gramatical ou que possa ser melhorado.
-   Take a look at [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) and give your opinion into a discussion or consider opening a pull request if you see something you want to work on.

Contribuições são muito bem-vindas!

## Nosso processo de desenvolvimento

O Xplorer usa [GitHub](https://github.com/kimlimjustin/xplorer) como sua fonte de verdade. A equipe principal trabalhará diretamente lá. Todas as alterações serão públicas desde o início.

### Relatando novos problemas / bugs. {#issues}

Quando for [abrir uma nova issue](https://github.com/kimlimjustin/xplorer/issues), sempre certifique-se de preencher o template de issues. Usamos issues do GitHub para rastrear bugs públicos. Certifique-se de que sua descrição seja clara e tenha instruções suficientes para corrigir o problema.

-   _Uma issue, um bug_: Relate um único bug por issue.
-   _Forneça etapas de reprodução_: Liste todas as etapas necessárias para corrigir a issue. A pessoa que está lendo seu relatório de bug deve ser capaz de seguir estas etapas para reproduzir sua issue com o mínimo de esforço.

### Solicitação de Recurso {#feat}

Usamos as [ Discussões no GitHub ](https://github.com/kimlimjustin/xplorer/discussions) para rastrear ideias de usuários. Suggest a new feature [here](https://github.com/kimlimjustin/xplorer/discussions/new)! Boas solicitações de recursos tendem a ter:

-   Um resumo rápido da ideia.
-   What & why you wanted to add the specific feature.
-   Additional references like images, links of resources about the feature, etc.

## Working on Xplorer code

### Pré-requisito

-   [Node JS](https://nodejs.org/en/)
-   [Git](https://git-scm.com/)
-   [yarn](https://yarnpkg.com/)
-   [Compilador GCC](https://gcc.gnu.org/)
-   Code Editor, we recommend you to use [VS Code](https://code.visualstudio.com/)

### Instalação

1. Depois de clonar o repositório, execute `yarn` na raiz do repositório e execute `yarn` na pasta `docs` (se você quiser trabalhar no Xplorer Docs).
2. Para iniciar o Xplorer localmente:

    - execute `yarn start` na raiz do repositório se você ** não quiser ** o recurso de recarregamento rápido.
    - run `yarn dev` in the root of the repository if you **want** the hot reload feature.

    To start a local development server serving the Docusaurus docs, go into the `docs` directory and run `yarn start`

### Gitpod {#gitpod-env}

Gitpod is a Ready-to-Code environment in which you can get started immediately. Gitpod offers all dependencies pre-installed so you can just click and get started.

To get started with Gitpod, click the button below and log in with your GitHub account.

[![Abrir no Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/kimlimjustin/xplorer)

:::note Remember to reload the Gitpod website after it loads up since it won't start the servers immediately, but by reloading, you can get it started. If you are developing the app, go to the Remote Explorer on the sidebar and visit port _6080_ which opens the noVNC app server. If you are developing the docs, go to the Remote explorer but instead of port 6080, visit port _3000_. You can edit normally as you do in VS Code, but if you want to use it locally, clik the hamburger menu button and click _Open in VS Code_. :::

### Semantic commit messages {#commit-msg}

See how a minor change to your commit message style can make you a better programmer.

Format: `<type>(<scope>): <subject>`

`<scope>` is optional

#### Exemplo

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

### Instalação

After cloning the repository, run `yarn` in the `docs` folder (you can go into the `docs` folder by running the `cd docs` command).

If you want to use Gitpod, click [here](#gitpod-env) for the guide on how to use Gitpod.

### Local development

1. Run the `yarn start` command in the `docs` folder.
2. Edit some markdown texts in the `docs` folder and the website will be hot reloaded.

## Pull requests

### Your first pull request. {#first-pull-request}

So you have decided to contribute code back to upstream by opening a pull request. You've invested a good chunk of time, and we appreciate it. We will do our best to work with you and get the PR looked at.

Working on your first Pull Request? Você pode aprender como usar nesta série de vídeos:

Como Contribuir com um Projeto de Código Aberto no GitHub

Temos uma lista de [problemas para iniciantes](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) para ajudá-lo a começar a usar a base de código do Xplorer e familiarizar com nosso processo de contribuição. Este é um ótimo lugar para começar.

### Propondo uma alteração

If you would like to request a new feature or enhancement but are not yet thinking about opening a pull request, you can also [open a discussion](#feat) and others will code it!

If you intend to fix a bug, please discuss it through [Issues](#issues) before submitting a pull request.

If you intend to add a new feature, please discuss it through [GitHub Discussions](#feat) to avoid multiple people working on the same feature request.

### Enviando uma pull request

certifique-se de que o PR faça apenas uma coisa, caso contrário, divida-o. It is recommended to follow this [commit message style](#commit-msg).

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

#### Produção

Once the files on `src/Locales` have been translated for more than 80%, we will add it into the Xplorer app, and for the docs, we will add it into production once the translation looks good!

Por favor, comente [aqui](https://github.com/kimlimjustin/xplorer/discussions/30) se você tiver alguma dúvida!

### Ícone de arquivo

Files icons are available on [`src/Icon`](https://github.com/kimlimjustin/xplorer/tree/master/src/Icon). Você pode adicionar um ícone seguindo estas etapas:

-   Cole o novo ícone em `src/icon`
-   Edit the value of [`src/Components/Files/File Icon/icon.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/Components/Files/File%20Icon/icon.json)

### Biblioteca de Tipo de Arquivo

The files type library is available on [`src/Components/Files/File Type/type.json`](https://github.com/kimlimjustin/xplorer/tree/master/src/Components/Files/File%20Type/type.json).

You can add the type of file extension by adding value to the file.
