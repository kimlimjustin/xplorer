# Paramètres

<details>
<summary>
Comment ouvrir les paramètres ?
</summary>
Vous pouvez ouvrir les paramètres sur Xplorer en cliquant sur le bouton `Paramètres` à gauche de Xplorer.

![Paramètres](/img/docs/settings.png)

</details> <details>
<summary>
Comment quitter les paramètres ?
</summary>
Vous pouvez quitter les paramètres de Xplorer en cliquant sur le côté en haut et gauche de Xplorer.

![Paramètres](/img/docs/exit-settings.png)

</details>

## Apparence

### Thème de l'appli

Vous pouvez modifier le thème de l'application Xplorer dans l'onglet `Apparence` des Paramètres. Les thèmes disponibles par défaut sont `light`, `light+`, `dark`et `dark+`. En outre, il y a le thème `par défaut du système` qui lira automatiquement votre préférence système. :::info Xplorer prendra bientôt en charge le thème de l'application personnalisée, restez à l'écoute ! :::

### Famille de police

Vous pouvez changer la famille de polices de Xplorer dans l'onglet `Apparence` des Paramètres pour une des familles de polices installées sur votre système.

### Taille de la Police

Vous pouvez modifier la taille de police de Xplorer dans l'onglet `Apparence` des Paramètres. Veuillez noter qu'une taille de police idéale est comprise entre 10 px et 30 px.

### Transparence de la Fenêtre

Rendre la fenêtre Xplorer transparente sur l'onglet `Apparence` des Paramètres en combinant les options suivantes. Veuillez noter que la transparence idéale est comprise entre 70 % et 100 %. Vous pouvez désactiver la transparence en désactivant toutes les options de transparence.

#### Panneau latéral transparent

Rendre le panneau latéral transparent ![Barre latérale transparente](/img/docs/transparent-sidebar.png)

#### Barre latérale transparente

Rendre la barre de topbar transparente ![Barre de haut transparent](/img/docs/transparent-topbar.png)

#### Espace de travail transparent

rendre l'espace de travail transparent ![Espace de travail transparent](/img/docs/transparent-workspace.png)

### Style de cadre

Vous pouvez choisir le style de cadre dans l'onglet `Apparence` des paramètres. Les options disponibles sont `par défaut` et `par défaut du système`. `Par défaut` utilisera le style par défaut de Xplorer, qui est le même entre les plates-formes. `Par défaut du système` utilisera le style par défaut du système qui est différent selon votre plate-forme.

### Aperçu du fichier

L'aperçu de fichier ici peut signifier la miniature du fichier.

#### Lire automatiquement le fichier vidéo en tant que miniature

Cela va automatiquement lire le fichier vidéo en prévisualisation. :::caution CETTE ACTION CONSUME DE HAUTES MONTANTE DE RAM Cela peut consommer une grande quantité de RAM car elle est construite sur le lecteur vidéo HTML. Vous pouvez juste activer ce paramètre et ignorer cette précaution si vous avez un bon ordinateur spécialisé. :::

#### Aperçu de l'image au survol

Ce remplissage affiche automatiquement l'image lorsque vous la survolez pendant 500ms.

![Aperçu au survol](/img/docs/preview-on-hover.png)

Certaines personnes peuvent le trouver ennuyeux et vous pouvez le désactiver en désactivant ce paramètre.

#### Extraire l'icône du fichier exe et le faire comme miniature

Cela va analyser et mettre en cache l'icône d'un fichier `exe` et en faire un aperçu. Uniquement sur Windows.

![Extraire l'icône de fichier Exe](/img/docs/extract-exe-icon.png)

:::warning Ceci peut causer le plantage de Xplorer.

Ceci est dû au fait que Xplorer analyse l'icône du exe et que si l'hexadécimal du fichier exe est cassé, Xplorer se bloque.

La façon de le corriger est de désactiver le paramètre.

:::

:::info Problème ouvert L'approche actuelle est en appelant le programme powershell qui pourrait apparaître des fenêtres cmd.

Toute contribution pour l'appeler directement de Xplorer est la bienvenue. :::

#### Afficher l'image comme miniature

Cela affichera l'image comme une miniature d'un fichier. Veuillez noter que ce n'est pas recommandé pour les gros répertoires, car il lit l'image en mémoire.

#### Schéma de page par défaut

Disposition de fichier par défaut d'un répertoire. Essayez-le :)

## Préférences

### Langue de l'application

Traduisez Xplorer. Aidez-nous à traduire Xplorer [ici](https://github.com/kimlimjustin/xplorer/discussions/30).

### Masquer les fichiers cachés

Masquer les fichiers cachés sur Xplorer, vous pouvez trouver ce paramètre dans l'onglet `Préférence` sur Xplorer ou par son raccourci, `Ctrl + H`.

### Masquer les applications système

Masquer les fichiers système de Windows sur Xplorer. :::tip Apprenez ce qu'est le fichier système [ici](https://en.wikipedia.org/wiki/System_file). Désactivez-le simplement si vous ne comprenez pas ce qu'il est. :::

### Lister et trier les répertoires à côté des fichiers

Si désactivé, Xplorer priorisera les répertoires au-dessus des fichiers.

### Détecter le changement du disque dur

Activer cette option permettra de détecter le changement de lecteur et de mettre à jour la section sur la barre latérale et les lecteurs. Veuillez noter que cela prendra une grande quantité de RAM car cela n'est pas encore stabilisé.

### Au démarrage

Option à faire au démarrage de Xplorer. Options disponibles :

-   Nouvel onglet
-   Ouvrir la session précédente
