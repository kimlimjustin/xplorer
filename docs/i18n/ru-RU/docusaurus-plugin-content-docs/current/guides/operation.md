# Операции

## Копировать файлы

You can copy files by right-clicking it and click the `Copy` option or select the file then press `Ctrl + C` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info

On Windows and macOS, Xplorer will copy the file paths into the local clipboard, because of this, you can copy a file from Xplorer and paste it into any folder in another system. However, on Linux, we create a string of Xplorer commands and copy it into the user clipboard, Xplorer will read the user's clipboard when pasting the file (because we haven't found any idea to implement it, feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us). The string of the Xplorer command looks like this:

```
Xplorer command - COPY
~/xplorer
~/test
```

:::

## Скопировать путь

You can copy a file/folder location path into your clipboard by right-clicking it and click `Copy Location Path` or select the file then press `Alt + Shift + C` as a shortcut.

## Вырезать файлы

You can cut files by right-clicking it and click the `Cut` option or select the file then press `Ctrl + X` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info This is done by creating a string of Xplorer command and copies it into the user clipboard to be used when pasting file (this is not integrated with the platform because we haven't found any idea, feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us.). The string of Xplorer command looks like this:

```
Xplorer command - CUT
E://xplorer
E://test
```

:::

## Удаление файлов

You can cut files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut. The trashed file can be accessed at `xplorer://Trash`.

:::info

-   On Windows, this is done by creating a `Trash` folder on the `C:` drive and moving the file into it.
-   On Linux, this feature is fully integrated with the system.
-   В MacOS это делается путем создания папки `.local/Trash` в `homedir` и перемещения в неё файла.

We are still working on Windows on macOS to integrate the `Trash` folder, which will be released before the stable version came out. Feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us.

:::

### Удалить безвозвратно

:::danger A permanently deleted file cannot be restored. Пожалуйста, проверьте ещё раз перед тем, как удалить файл.

:::

Вы можете навсегда удалить файл следующими способами:

1. Delete it into `Trash` and right-clicking it and click the `Permanent Delete` option
2. Select the file and press `Shift + Del` as a shortcut

## Создать

:::caution Будьте осторожны с именем файла/папки Xplorer обрабатывает `/` в имени файла или папки как подпапку/подфайл :::

### Файл

You can create a new file by right-clicking the workspace, expand the `New` option and select the `file` option, or press `Alt + N` as a shortcut.

### Папку

You can create a new folder by right-clicking the workspace, expand the `New` option and select the `folder` option, or press `Shift + N` as a shortcut.

## Открыть файл

You can open a file on the default application by double-clicking it or select the file then press `Enter` as a shortcut.

### Открыть в терминале

This is a built-in function by Xplorer. You can open a folder on Terminal by right-clicking it and click the `Open in terminal` option or select the folder then press `Alt + T` as a shortcut.

### Открыть в VS Code

This is a built-in function by Xplorer. You can open a file/folder on VSCode by right-clicking it and click the `Open in vscode` option or select the file then press `Ctrl + Enter` as a shortcut. Вы не сможете это сделать, если у вас не установлен VS Code.

## Закрепить в боковой панели

You can pin a file/folder into the sidebar by right-clicking it and click `Pin to Sidebar` or select the file then press `Alt + P` as a shortcut.

## Предпросмотр файла

You can preview a file directly from Xplorer by right-clicking it and click the `Preview` option or select the file then press `Ctrl+O`.

![Предпросмотр демо](/img/docs/preview.png)

:::info

<details>
<summary>
Файлы, доступные для предварительного просмотра:
</summary>

```json
[
    ".pdf",
    ".html",
    ".docx",
    ".htm",
    ".xlsx",
    ".xls",
    ".xlsb",
    "xls",
    ".ods",
    ".fods",
    ".csv",
    ".txt",
    ".py",
    ".js",
    ".bat",
    ".css",
    ".c++",
    ".cpp",
    ".cc",
    ".c",
    ".diff",
    ".patch",
    ".go",
    ".java",
    ".json",
    ".php",
    ".ts",
    ".tsx",
    ".jsx",
    ".jpg",
    ".png",
    ".gif",
    ".bmp",
    ".jpeg",
    ".jpe",
    ".jif",
    ".jfif",
    ".jfi",
    ".webp",
    ".tiff",
    ".tif",
    ".ico",
    ".svg",
    ".webp",
    ".mp4",
    ".webm",
    ".mpg",
    ".mp2",
    ".mpeg",
    ".mpe",
    ".mpv",
    ".ocg",
    ".m4p",
    ".m4v",
    ".avi",
    ".wmv",
    ".mov",
    ".qt",
    ".flv",
    ".swf",
    ".md"
]
```

</details>

:::

## Свойства

You can view properties of a file/folder by right-clicking it and click `Properties` or select the file then press `Ctrl + P` as a shortcut. На данный момент доступны следующие свойства (список дополнится в будущих версиях):

-   Размер
-   Путь к файлу
-   Дата создания
-   Accessed At
-   Дата изменения
-   Скрыто или нет

## Переименовать файл/папку

You can rename a file/folder by right-clicking it and click the `Rename` option or select the file then press `F2` as a shortcut. Появится диалоговое окно. Введите новое имя файла/папки, которую хотите переименовать.
