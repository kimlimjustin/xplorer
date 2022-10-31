# Операции

## Копировать файлы

Вы можете скопировать файлы щелкнув ПКМ и нажав на кнопку `Скопировать` или выбрать файл, а затем нажать `Ctrl + C` и вставить его нажав на `Вставить` или нажав `Ctrl + V` в папке назначения.

:::info

For current implementation, Xplorer write down what to copy locally (not copying to clipboard).

TODO: Реализовать копирование в буфер обмена

:::

## Скопировать путь

You can copy a file/folder location path into your clipboard by right-clicking it and click `Copy Location Path` or select the file then press `Alt + Shift + C` as a shortcut.

## Вырезать файлы

Вы можете вырезать файлы нажав ПКМ и нажав на кнопку `Вырезать` или выбрать файл, а затем нажать `Ctrl + X` и вставить файл нажав на `Вставить` или нажав на `Ctrl + V` в папке назначения.

:::info

For current implementation, Xplorer write down what to cut locally (not copying to clipboard).

:::

## Удаление файлов

You can delete files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut.

### Корзина

Удаленные файлы доступны в пути `xplorer://Trash` или в корзине вашей системы. :::danger Откройте проблему

Please note that Trash folder cannot be accessed on macos via Xplorer since the [trash crate](https://github.com/Byron/trash-rs) Xplorer relies to does not support it (see [this issue](https://github.com/Byron/trash-rs/issues/8) for more details).

Any contributions to either the trash crate or Xplorer itself for this topic are welcome. :::

### Восстановить файлы

You can restore files by opening the `xplorer://Trash` and right-clicking it and click the `Restore` option

### Удалить навсегда

:::danger Файл удаленный навсегда не может быть восстановлен. Пожалуйста, проверьте еще раз перед тем как удалить файл навсегда.

:::

Вы можете удалить файлы навсегда этими способами:

1. Отправьте файл в `корзину` (или просто удалите файл) и ПКМ нажмите на `Удалить навсегда`
2. Выберите файл и нажмите `Shift + Del`

## Поиск файлов

Xplorer uses [`glob patterns`](https://en.wikipedia.org/wiki/Glob_(programming)) to search matched files. [Learn about Glob pattern syntax](https://en.wikipedia.org/wiki/Glob_(programming)). To get started, press `Ctrl + F` and type inside the search box.

### Мгновенный поиск

Вы можете мгновенно найти файл набрав начальные символы имени файла/папки, а Xplorer найдет за вас. Some rules of instant search:

-   Все английские диакритические знаки удаляются
-   Интервал мгновенного поиска составляет 750 мс. После 750 мс, поисковой запрос будет сброшен.
-   При вводе одного и того же символа, Xplorer будет искать следующие совпадения.

## Создать

:::caution Будьте осторожны с именем файла/папки Xplorer воспринимает`/` в имени файла/папки как поддиректорию/подфайл :::

### Создать файл

Вы можете создать новый файл нажав ПКМ на рабочей области и затем развернуть опцию `Создать` и нажать на кнопку `файл` или нажать горячую клавишу `Alt + N`.

### Создать папку

Вы можете создать новую папку нажав ПКМ на рабочей области и затем развернуть опцию `Создать` и нажать на кнопку `папка` или нажать горячую клавишу `Shift + N`.

## Открыть файл

You can open a file on the default application by double-clicking it or select the file then press `Enter` as a shortcut.

### Открыть в терминале

This is a built-in function by Xplorer. You can open a folder on Terminal by right-clicking it and click the `Open in terminal` option or select the folder then press `Alt + T` as a shortcut.

### Открыть в VSCode

This is a built-in function by Xplorer. You can open a file/folder on VSCode by right-clicking it and click the `Open in vscode` option or select the file then press `Ctrl + Enter` as a shortcut. You won't able to do this if you don't have VSCode installed.

## Закрепить в боковой панели

You can pin a file/folder into the sidebar by right-clicking it and click `Pin to Sidebar` or select the file then press `Alt + P` as a shortcut.

## Предпросмотр файла

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

## Свойства

You can view properties of a file/folder by right-clicking it and click `Properties` or select the file then press `Ctrl + P` as a shortcut. Available properties for now (will be improved at the next version):

-   Size
-   File Path
-   Created At
-   Accessed At
-   Modified At
-   Is Hidden

## Переименовать файл/папку

You can rename a file/folder by right-clicking it and click the `Rename` option or select the file then press `F2` as a shortcut. It will prompt a dialog, enter the new name and the file/folder will be renamed.
