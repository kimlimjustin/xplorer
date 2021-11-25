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

### Gitpod {#gitpod-env}

Gitpod est un environnement prêt-à-Code dans lequel vous pouvez commencer immédiatement. Gitpod offre toutes les dépendances pré-installées afin que vous puissiez simplement cliquer et commencer.

Pour commencer avec Gitpod, cliquez sur le bouton ci-dessous et connectez-vous avec votre compte GitHub.

[![Ouvrir dans Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/kimlimjustin/xplorer)

:::note N'oubliez pas de recharger le site web de Gitpod après le chargement car il ne démarrera pas les serveurs immédiatement, mais en rechargeant, vous pouvez le faire démarrer. Si vous développez l'application, aller à l'Explorateur à distance sur la barre latérale et visiter le port _6080_ qui ouvre le serveur de l'application noVNC. Si vous développez la documentation, allez dans l'explorateur distant mais au lieu du port 6080, visitez le port _3000_. Vous pouvez éditer normalement comme vous le faites en VS Code, mais si vous voulez l'utiliser localement, cliquez sur le bouton du menu hamburger et cliquez sur _Ouvrir dans VS Code_. :::

### Sémantique des messages de commit {#commit-msg}

Découvrez comment une modification mineure de votre style de message de commit peut faire de vous un meilleur programmeur.

Format : `<type>(<portée>): <sujet>`

`<scope>` est facultatif

#### Exemple

```
feat: permettre de remplacer webpack config
^--^ ^------------^
| |
| +-> Résumé au present.
|
+-------> Tapez : chore, docs, feat, fix, refactor, style, ou test.
```

les différents types de commits:

-   `feat`: nouvelle fonctionnalité pour l'utilisateur
-   `fix`: correction de bug pour l'utilisateur
-   `docs`: modifications de la documentation
-   `style`: formatage, point-virgule manquante, etc.
-   `refacteur`: refactorisation du code de production, par exemple. renommer une variable
-   `test`: ajout de tests manquants, refactorisation des tests.
-   `chore`: mise à jour des tâches de grunt, etc

Utilisez des minuscules et non des majuscules !

## Travailler sur la documentation Xplorer

Le site web de documentation Xplorer est construit à l'aide de [Docusaurus 2](https://docusaurus.io/), et son code est situé dans le dossier [`docs`](https://github.com/kimlimjustin/xplorer/tree/master/docs).

### Pré-requis

-   [node Js](https://nodejs.org/en/)
-   [git](https://git-scm.com/downloads)
-   [yarn](https://yarnpkg.com/getting-started/install#about-global-installs)
-   Éditeur de code, nous vous recommandons d'utiliser [Code VS](https://code.visualstudio.com/)

### Installation

Après le clonage du dépôt, exécutez `yarn` dans le dossier `docs` (vous pouvez aller dans le dossier `docs` en exécutant la commande `cd docs`).

Si vous voulez utiliser Gitpod, cliquez sur [ici](#gitpod-env) pour le guide sur la façon d'utiliser Gitpod.

### Développement local

1. Exécutez la commande `yarn start` dans le dossier `docs`.
2. Éditez des textes markdown dans le dossier `docs` et le site web sera rechargé.

## Demande de fusion de code source

### Votre première demande d'ajout. {#first-pull-request}

Vous avez donc décidé de contribuer au code en amont en ouvrant une pull request. Vous avez investi une bonne partie de votre temps, et nous l'apprécions. Nous ferons de notre mieux pour travailler avec vous et examiner la PR.

Vous travaillez sur votre première Pull Request ? Vous pouvez apprendre comment grâce à cette série de vidéos gratuites :

Comment contribuer à un projet Open Source sur GitHub

Nous avons une liste de [problèmes favorables aux débutants](https://github.com/kimlimjustin/xplorer/labels/good%20first%20issue) pour vous aider à mouiller vos pieds dans le code de base Xplorer et à vous familiariser avec notre processus de contribution. C'est un endroit idéal pour commencer.

### Proposer une modification

Si vous souhaitez demander une nouvelle fonctionnalité ou une amélioration mais que vous ne pensez pas encore à ouvrir une pull request, vous pouvez aussi [ouvrir une discussion](#feat) et d'autres la coderont !

Si vous avez l'intention de corriger un bogue, veuillez en discuter à travers [Problèmes](#issues) avant de soumettre une pull request.

Si vous avez l'intention d'ajouter une nouvelle fonctionnalité, veuillez en discuter à travers les [discussions GitHub](#feat) pour éviter que plusieurs personnes travaillent sur la même demande de fonctionnalité.

### Envoyer des demandes d'intégration (Pull request)

assurez-vous que la PR ne fait qu'une chose, sinon veuillez la diviser. Il est recommandé de suivre ce [style de message de commit](#commit-msg).

1. Forcez [le dépôt](https://github.com/kimlimjustin/xplorer) et créez votre branche à partir du `maître`.
2. Effectuez des changements et assurez-vous que votre message de commit est compréhensible.
3. Ouvrez une PR [](https://github.com/kimlimjustin/xplorer/pulls) et assurez-vous de décrire clairement votre pull request .

## Travailler sur la documentation Xplorer

### Localisation

Nous hébergeons nos locales sur le [crowdin](https://crwd.in/xplorer). Pour le traduire, veuillez suivre ces étapes :

-   Inscrivez-vous sur [Crowdin](https://crowdin.com) et rejoignez notre projet [ici](https://crwd.in/xplorer).
-   Assurez-vous que votre locale existe là-bas, si elle n'existe pas, laisser un commentaire dans [cette discussion](https://github.com/kimlimjustin/xplorer/discussions/30) et j'ajouterai l'option langue :)
-   Familiarisez-vous avec l'interface de traduction Crowdin, car vous devrez l'utiliser pour traduire des fichiers JSON et Markdown
-   Traduire le contenu!

#### Fichiers prioritaires à traduire sur Crowdin

1. fichiers `src/Locales`
2. fichiers `docs /`

#### Production

Une fois que les fichiers sur `src/Locales` ont été traduits depuis plus de 80%, nous l'ajouterons dans l'application Xplorer et pour la documentation, nous l'ajouterons en production une fois que la traduction aura l'air bonne !

Veuillez commenter [ici](https://github.com/kimlimjustin/xplorer/discussions/30) si vous avez des questions !

### Bibliothèque de fichiers

La bibliothèque json de types de fichiers et miniature se trouve dans le dossier `lib` et les icônes se trouvent dans le dossier `src/Icons`. Vous pouvez ajouter des types de fichiers et des icônes pour les extensions de fichiers que vous souhaitez utiliser et soumettre une PR.
