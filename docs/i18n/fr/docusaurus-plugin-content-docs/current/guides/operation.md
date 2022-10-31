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

You can delete files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut.

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

## Search files

Xplorer uses [`glob patterns`](https://en.wikipedia.org/wiki/Glob_(programming)) to search matched files. [Learn about Glob pattern syntax](https://en.wikipedia.org/wiki/Glob_(programming)). To get started, press `Ctrl + F` and type inside the search box.

### Instant search

You can instant search a file/dir by typing the starting characters of the file/dir name and Xplorer will select the file for you. Some rules of instant search:

-   Any english diacritic is removed
-   The interval for instant search is 750ms. After 750ms, the search query will be reseted.
-   Typing the same character will make Xplorer to find the next matches.

## New

:::caution Be careful with new file/folder name Xplorer treats `/` on file name/folder as subdir/subfile :::

### New file

You can create a new file by right-clicking the workspace, expand the `New` option and select the `file` option, or press `Alt + N` as a shortcut.

### New folder

You can create a new folder by right-clicking the workspace, expand the `New` option and select the `folder` option, or press `Shift + N` as a shortcut.

## Open file

You can open a file on the default application by double-clicking it or select the file then press `Enter` as a shortcut.

### Open in Terminal

This is a built-in function by Xplorer. You can open a folder on Terminal by right-clicking it and click the `Open in terminal` option or select the folder then press `Alt + T` as a shortcut.

### Open in VSCode

This is a built-in function by Xplorer. You can open a file/folder on VSCode by right-clicking it and click the `Open in vscode` option or select the file then press `Ctrl + Enter` as a shortcut. You won't able to do this if you don't have VSCode installed.

## Pin to Sidebar

You can pin a file/folder into the sidebar by right-clicking it and click `Pin to Sidebar` or select the file then press `Alt + P` as a shortcut.

## Preview file

You can preview a file directly from Xplorer by right-clicking it and click the `Preview` option or select the file then press `Ctrl+O`.

![Preview Demo](/img/docs/preview.webp)

:::info

<details>
<summary>
Files available to preview for now:
</summary>

* Markdown files
* Image files
* Text files
* Video files
* Pdfs
* Almost all programming language with syntax highlighting

</details>

:::

## Properties

You can view properties of a file/folder by right-clicking it and click `Properties` or select the file then press `Ctrl + P` as a shortcut. Available properties for now (will be improved at the next version):

-   Size
-   File Path
-   Created At
-   Accessed At
-   Modified At
-   Is Hidden

## Rename file/folder

You can rename a file/folder by right-clicking it and click the `Rename` option or select the file then press `F2` as a shortcut. It will prompt a dialog, enter the new name and the file/folder will be renamed.
