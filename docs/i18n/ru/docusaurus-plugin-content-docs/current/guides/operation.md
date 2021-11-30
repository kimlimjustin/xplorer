# Операции

## Копировать файлы

You can copy files by right-clicking it and click the `Copy` option or select the file then press `Ctrl + C` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info

For current implementation, Xplorer write down what to copy locally (not copying to clipboard).

TODO: implement copy to clipboard

:::

## Скопировать путь

You can copy a file/folder location path into your clipboard by right-clicking it and click `Copy Location Path` or select the file then press `Alt + Shift + C` as a shortcut.

## Вырезать файлы

You can cut files by right-clicking it and click the `Cut` option or select the file then press `Ctrl + X` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info

For current implementation, Xplorer write down what to cut locally (not copying to clipboard).

:::

## Удаление файлов

You can cut files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut.

### Trashed files

The trashed file can be accessed at `xplorer://Trash` or your system trash folder. :::danger Open Issue

Please note that Trash folder cannot be accessed on macos via Xplorer since the [trash crate](https://github.com/Byron/trash-rs) Xplorer relies to does not support it (see [this issue](https://github.com/Byron/trash-rs/issues/8) for more details).

Any contributions to either the trash crate or Xplorer itself for this topic are welcome. :::

### Restore files

You can restore files by opening the `xplorer://Trash` and right-clicking it and click the `Restore` option

### Permanently delete

:::danger A permanently deleted file cannot be restored. Please check again before permanently delete any files.

:::

You can permanently delete a file by:

1. Delete it into `Trash` and right-clicking it and click the `Permanent Delete` option
2. Select the file and press `Shift + Del` as a shortcut

## Создать

:::caution Be careful with new file/folder name Xplorer treats `/` on file name/folder as subdir/subfile :::

### New file

You can create a new file by right-clicking the workspace, expand the `New` option and select the `file` option, or press `Alt + N` as a shortcut.

### New folder

You can create a new folder by right-clicking the workspace, expand the `New` option and select the `folder` option, or press `Shift + N` as a shortcut.

## Открыть файл

You can open a file on the default application by double-clicking it or select the file then press `Enter` as a shortcut.

### Open in Terminal

This is a built-in function by Xplorer. You can open a folder on Terminal by right-clicking it and click the `Open in terminal` option or select the folder then press `Alt + T` as a shortcut.

### Open in VSCode

This is a built-in function by Xplorer. You can open a file/folder on VSCode by right-clicking it and click the `Open in vscode` option or select the file then press `Ctrl + Enter` as a shortcut. You won't able to do this if you don't have VSCode installed.

## Закрепить в боковой панели

You can pin a file/folder into the sidebar by right-clicking it and click `Pin to Sidebar` or select the file then press `Alt + P` as a shortcut.

## Предпросмотр файла

You can preview a file directly from Xplorer by right-clicking it and click the `Preview` option or select the file then press `Ctrl+O`.

![Preview Demo](/img/docs/preview.png)

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

## Свойства

You can view properties of a file/folder by right-clicking it and click `Properties` or select the file then press `Ctrl + P` as a shortcut. Available properties for now (will be improved at the next version):

-   Размер
-   Путь к файлу
-   Дата создания
-   Accessed At
-   Дата изменения
-   Скрыто или нет

## Переименовать файл/папку

You can rename a file/folder by right-clicking it and click the `Rename` option or select the file then press `F2` as a shortcut. It will prompt a dialog, enter the new name and the file/folder will be renamed.
