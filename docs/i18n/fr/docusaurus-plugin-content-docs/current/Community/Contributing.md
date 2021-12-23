---
sidebar_position: 2
---

# Contribue

👍🎉 D'abord, merci d'avoir pris le temps de contribuer! 🎉👍

Xplorer est actuellement en cours de développement. Nous souhaitons la bienvenue aux contributeurs pour collaborer sur Xplorer.

## Impliquez-vous

Il y a plusieurs façons de contribuer à Xplorer, et beaucoup d'entre eux n'impliquent pas d'écrire de code. Voici quelques idées pour commencer:

-   Commencez à utiliser Xplorer dès aujourd'hui ! Parcourez les guides du Tutoriel. Est-ce que tout fonctionne comme prévu? Dans le cas contraire, nous sommes toujours à la recherche d'améliorations. Faites-le nous savoir en nous le signalant.
-   Regardez les [problèmes Xplorer](https://github.com/kimlimjustin/xplorer/issues). Si vous trouvez un problème que vous voulez corriger, [ouvrez une pull request](#first-pull-request). Les issues marquées comme [Good first issue](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) sont un bon point de départ.
-   Aidez-nous à améliorer les documentations. Remplissez un problème si vous trouvez quelque chose de confus, une erreur grammaticale ou qui peut être amélioré.
-   Jetez un œil aux [discussions GitHub](https://github.com/kimlimjustin/xplorer/discussions) et donnez votre avis dans une discussion ou envisagez d'ouvrir une pull request si vous voyez quelque chose sur lequel vous voulez travailler.

Les contributions sont toujours les bienvenues!

## Processus de développement

Xplorer utilise [GitHub](https://github.com/kimlimjustin/xplorer) comme source de vérité. L’équipe de base y travaillera directement. Tous les changements seront publics dès le début.

### Signaler de nouvelles issues. {#issues}

Lorsque vous [ouvrez un nouveau ticket](https://github.com/kimlimjustin/xplorer/issues), assurez-vous toujours de remplir le modèle de fiche. Nous utilisons les tickets GitHub pour suivre les bogues publics. Veuillez vous assurer que votre description est claire et qu'elle contient des instructions suffisantes pour pouvoir reproduire le problème.

-   _Un problème, un bogue_: Veuillez signaler un seul bug par problème.
-   _Fournir des étapes de reproduction_: Liste toutes les étapes nécessaires pour reproduire le problème. La personne qui lit votre rapport de bogue devrait être en mesure de suivre ces étapes pour reproduire votre problème avec un effort minime.

### Demande de Fonctionnalité {#feat}

Nous utilisons [GitHub Discussions](https://github.com/kimlimjustin/xplorer/discussions) et [GitHub Issues](https://github.com/kimlimjustin/xplorer) pour suivre les idées des utilisateurs. Suggérez une nouvelle fonctionnalité [ici](https://github.com/kimlimjustin/xplorer/discussions/new)! Les demandes de fonctionnalités ont tendance à avoir:

-   Un résumé rapide des idées.
-   Quelle & pourquoi vous vouliez ajouter la fonctionnalité spécifique.
-   Des références supplémentaires telles que des images, des liens de ressources sur la fonctionnalité, etc.

## Travailler sur le code Xplorer

### Pré-requis

-   [Environnement Tauri](https://tauri.studio/en/docs/getting-started/intro#setting-up-your-environment)
-   [Node JS](https://nodejs.org/en/)
-   [Git](https://git-scm.com/)
-   [yarn](https://yarnpkg.com/)
-   Éditeur de code, nous vous recommandons d'utiliser [Code VS](https://code.visualstudio.com/)

### Installation

1. Après le clonage du dépôt, exécutez `yarn` à la racine du dépôt et exécutez `yarn` dans le dossier `docs` (si vous voulez travailler sur Xplorer Docs).
2. Pour démarrer Xplorer localement, exécutez `yarn dev`.

    Pour démarrer un serveur de développement local servant la documentation de Xplorer, allez dans le répertoire `docs` et exécutez `yarn start`

### Gitpod for Xplorer's development {#gitpod-env}

The easiest way to run Xplorer in Gitpod is to use the [Gitpod](https://gitpod.io/) service, all what you need to do is to click the button below and log in with your GitHub account. Afterwards, you will see a VS Code-like environment where you can start developing and pushing your changes. Please note that you may have to wait up to minutes to get Xplorer running on the poped up VNC tab.

## [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#/https://github.com/kimlimjustin/xplorer)

### Sémantique des messages de commit {#commit-msg}

See how a minor change to your commit message style can make you a better programmer.

Format: `<type>(<scope>): <subject>`

`<scope>` is optional

#### Exemple

```
feat: permettre de remplacer webpack config
^--^ ^------------^
| |
| +-> Résumé au present.
|
+-------> Tapez : chore, docs, feat, fix, refactor, style, ou test.
```

the various types of commits:

-   `feat`: nouvelle fonctionnalité pour l'utilisateur
-   `fix`: correction de bug pour l'utilisateur
-   `docs`: modifications de la documentation
-   `style`: formatage, point-virgule manquante, etc.
-   `refacteur`: refactorisation du code de production, par exemple. renommer une variable
-   `test`: ajout de tests manquants, refactorisation des tests.
-   `chore`: mise à jour des tâches de grunt, etc

Use lower case not the upper case!

## Working on Xplorer docs

Xplorer documentation website is built using [Docusaurus 2](https://docusaurus.io/), and its code is located at [`docs`](https://github.com/kimlimjustin/xplorer/tree/master/docs) folder.

### Pré-requis

-   [node Js](https://nodejs.org/en/)
-   [git](https://git-scm.com/downloads)
-   [yarn](https://yarnpkg.com/getting-started/install#about-global-installs)
-   Éditeur de code, nous vous recommandons d'utiliser [Code VS](https://code.visualstudio.com/)

### Installation

After cloning the repository, run `yarn` in the `docs` folder (you can go into the `docs` folder by running the `cd docs` command).

If you want to use Gitpod, click [here](#gitpod-env) for the guide on how to use Gitpod.

### Développement local

1. Exécutez la commande `yarn start` dans le dossier `docs`.
2. Éditez des textes markdown dans le dossier `docs` et le site web sera rechargé.

## Pull requests

### Votre première demande d'ajout. {#first-pull-request}

So you have decided to contribute code back to upstream by opening a pull request. You've invested a good chunk of time, and we appreciate it. We will do our best to work with you and get the PR looked at.

Working on your first Pull Request? You can learn how from this free video series:

How to Contribute to an Open Source Project on GitHub

We have a list of [beginner-friendly issues](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) to help you get your feet wet in the Xplorer codebase and familiar with our contribution process. This is a great place to get started.

### Proposer une modification

If you would like to request a new feature or enhancement but are not yet thinking about opening a pull request, you can also [open a discussion](#feat) and others will code it!

If you intend to fix a bug, please discuss it through [Issues](#issues) before submitting a pull request.

If you intend to add a new feature, please discuss it through [GitHub Discussions](#feat) to avoid multiple people working on the same feature request.

### Envoyer des demandes d'intégration (Pull request)

make sure the PR does only one thing, otherwise please split it. It is recommended to follow this [commit message style](#commit-msg).

1. Forcez [le dépôt](https://github.com/kimlimjustin/xplorer) et créez votre branche à partir du `maître`.
2. Effectuez des changements et assurez-vous que votre message de commit est compréhensible.
3. Ouvrez une PR [](https://github.com/kimlimjustin/xplorer/pulls) et assurez-vous de décrire clairement votre pull request .

## Working on Xplorer resources

### Localisation

We host our locales on the [crowdin](https://crwd.in/xplorer). To translate it, please follow these steps:

-   Inscrivez-vous sur [Crowdin](https://crowdin.com) et rejoignez notre projet [ici](https://crwd.in/xplorer).
-   Assurez-vous que votre locale existe là-bas, si elle n'existe pas, laisser un commentaire dans [cette discussion](https://github.com/kimlimjustin/xplorer/discussions/30) et j'ajouterai l'option langue :)
-   Familiarisez-vous avec l'interface de traduction Crowdin, car vous devrez l'utiliser pour traduire des fichiers JSON et Markdown
-   Traduire le contenu!

#### Fichiers prioritaires à traduire sur Crowdin

1. fichiers `src/Locales`
2. fichiers `docs /`

#### Production

Once the files on `src/Locales` have been translated for more than 80%, we will add it into the Xplorer app, and for the docs, we will add it into production once the translation looks good!

Please comment [here](https://github.com/kimlimjustin/xplorer/discussions/30) if you have any questions!

### Bibliothèque de fichiers

The json library of file types and thumbnail are found under `lib` folder and the icons are found under `src/Icons` folder. You may add file types and icons for file extensions you want to use and submit a PR.
