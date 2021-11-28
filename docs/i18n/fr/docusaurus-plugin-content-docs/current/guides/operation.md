# Opérations

## Copier les fichiers

Vous pouvez copier des fichiers en faisant un clic droit dessus et cliquez sur l'option `Copier` ou sélectionnez le fichier puis appuyez sur `Ctrl + C` comme raccourci et collez-le en cliquant sur `Coller` option ou appuyez sur `Ctrl + V` sur le dossier de destination.

:::info

Pour l'implémentation en cours, Xplorer écrit ce qu'il faut copier localement (pas copier dans le presse-papiers).

À faire: implimenter la copie dans le presse-papiers

:::

## Copier le chemin de l'emplacement

Vous pouvez copier un chemin d’emplacement de fichier/dossier dans votre presse-papiers en faisant un clic droit dessus et cliquez sur `Copier le chemin d’emplacement` ou sélectionnez le fichier puis appuyez sur `Alt + Maj + C` comme raccourci.

## Couper les fichiers

Vous pouvez couper des fichiers en faisant un clic droit dessus et cliquez sur l'option `Couper` ou sélectionnez le fichier puis appuyez sur `Ctrl + X` comme raccourci et collez-le en cliquant sur `Coller` option ou appuyez sur `Ctrl + V` sur le dossier de destination.

:::info

Pour l'implémentation courante, Xplorer écrit ce qu'il faut couper localement (ne pas copier dans le presse-papiers).

:::

## Supprimer les fichiers

Vous pouvez couper des fichiers en faisant un clic droit dessus et cliquez sur l'option `Supprimer` ou sélectionnez le fichier puis appuyez sur `Supprimez` comme raccourci.

### Fichiers mis à la corbeille

Le fichier mis à la corbeille est accessible dans `xplorer://Trash` ou dans votre dossier de corbeille système. :::danger Problème en cours

Veuillez noter que le dossier Corbeille ne peut pas être accédé sur macos via Xplorer puisque la [corbeille](https://github.com/Byron/trash-rs) Xplorer ne le supporte pas (voir [ce problème](https://github.com/Byron/trash-rs/issues/8) pour plus de détails).

Toutes les contributions à la corbeille ou à Xplorer pour ce sujet sont les bienvenues. :::

### Restaurer les fichiers

Vous pouvez restaurer des fichiers en ouvrant la `xplorer://Trash` et en cliquant dessus avec le bouton droit de la souris et en cliquant sur l'option `Restaurer`

### Supprimer définitivement

:::danger Le fichier définitivement supprimé ne peut pas être restauré. Veuillez vérifier à nouveau avant de supprimer définitivement un fichier.

:::

Vous pouvez supprimer définitivement un fichier par :

1. Supprimez-le dans la `Corbeille` et faites un clic droit dessus et cliquez sur l'option `Supprimer définitivement`
2. Sélectionnez le fichier et appuyez sur `Shift + Del` comme raccourci

## Nouveau

:::caution Soyez prudent avec le nouveau nom de fichier/dossier Xplorer traite `/` sur le nom du fichier/dossier comme sous-fichier/sous-fichier :::

### Nouveau fichier

Vous pouvez créer un nouveau fichier en faisant un clic droit sur l'espace de travail développez l'option `Nouveau` et sélectionnez l'option `Fichier` ou appuyez sur `Alt + N` comme raccourci.

### Nouveau dossier

Vous pouvez créer un nouveau fichier en faisant un clic droit sur l'espace de travail développez l'option `Nouveau` et sélectionnez l'option `Dossier` ou appuyez sur `Shift + N` comme raccourci.

## Ouvrir un fichier

Vous pouvez ouvrir un fichier sur l'application par défaut en double-cliquant dessus ou sélectionner le fichier, puis appuyer sur `Entrer` comme raccourci clavier.

### Ouvrir dans le Terminal

C'est une fonction intégrée par Xplorer. Vous pouvez ouvrir un dossier sur Terminal en cliquant avec le bouton droit de la souris et cliquez sur l'option `Ouvrir dans le terminal` ou sélectionnez le dossier puis appuyez sur `Alt + T` comme raccourci.

### Ouvrir dans VSCode

Ceci est une fonction intégrée par Xplorer. Vous pouvez ouvrir un fichier/dossier sur VSCode en faisant un clic droit dessus et cliquez sur l'option `Ouvrir dans vscode` ou sélectionnez le fichier puis appuyez sur `Ctrl + Entrée` comme raccourci. Vous ne serez pas en mesure de le faire si VSCode n'est pas installé.

## Épingler à la barre latérale

Vous pouvez épingler un fichier/dossier dans la barre latérale en faisant un clic droit dessus et cliquez sur `Épingler dans la barre latérale` ou sélectionnez le fichier puis appuyez sur `Alt + P` comme raccourci.

## Prévisualiser le fichier

Vous pouvez prévisualiser un fichier directement depuis Xplorer en faisant un clic droit dessus et en cliquant sur l'option `Aperçu` ou sélectionnez le fichier puis appuyez sur `Ctrl+O`.

![Aperçu de la démo](/img/docs/preview.png)

:::info

<details>
<summary>
Fichiers disponibles à prévisualiser:
</summary>

* Fichiers Markdown
* Fichier image
* Fichiers texte
* Fichiers vidéo
* PDF
* Presque tous les langages de programmation avec coloration syntaxique

</details>

:::

## Proprietés

Vous pouvez afficher les propriétés d'un fichier/dossier en faisant un clic droit dessus et cliquez sur `Propriétés` ou sélectionnez le fichier puis appuyez sur `Ctrl + P` comme raccourci. Propriétés disponibles pour l'instant (sera amélioré à la version suivante):

-   Taille
-   Emplacement du fichier
-   Créé à
-   Accès à
-   Modifiée à
-   Est masqué

## renommer le fichier/dossier

Vous pouvez renommer un fichier/dossier en cliquant avec le bouton droit de la souris et cliquez sur l'option `Renommer` ou sélectionnez le fichier puis appuyez sur `F2` comme raccourci. Il vous demandera une boîte de dialogue, entrez le nouveau nom et le fichier/dossier sera renommé.
