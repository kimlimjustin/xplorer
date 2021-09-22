# Operations

## Copy files

You can copy files by right clicking it and click `Copy` option or select the file then press `Ctrl + C` as shortcut and paste it by clicking `Paste` option or press `Ctrl + V` on the destination folder.

:::info

On windows and macOS, Xplorer will copy the file paths into local clipboard, because of this, you can copy file from Xplorer and paste it into an folder in another system. However, on Linux, we create a string of Xplorer commands and copy it into user clipboard, Xplorer will read user's clipboard when pasting file (because we haven't found any idea to implement it, fell free to [open a PR](/community/Contributing/#pull-requests) if you can help us). The string of Xplorer command look like this:

```
Xplorer command - COPY
~/xplorer
~/test
```

:::

## Copy Location Path

You can copy a file/folder location path into your clipboard by right clicking it and click `Copy Location Path` or select the file then press `Alt + Shift + C` as shortcut.

## Cut files

You can cut files by right clicking it and click `Cut` option or select the file then press `Ctrl + X` as shortcut and paste it by clicking `Paste` option or press `Ctrl + V` on the destination folder.

:::info
THis is done by creating a string of Xplorer command and copy it into user clipboard to be used when pasting file (not integrated with platform because we haven't found any idea, fell free to [open a PR](/community/Contributing/#pull-requests) if you can help us.). The string og Xplorer command look like this:

```
Xplorer command - CUT
E://xplorer
E://test
```

:::

## Delete files

You can cut files by right clicking it and click `Delete` option or select the file then press `Del` as shortcut. Trashed file can be accessed at `xplorer://Trash`.

:::info

-   On Windows, this is done by creating a `Trash` folder on `C:` drive and moving the file into it.
-   On Linux, this feature is fully integrated with the sytem
-   On macOS, this is done by creating a `.local/Trash` folder on `homedir` and moving the file into it.

We are still working on Windows on macOS to integrate the `Trash` folder, will be released before the stable version came out. fell free to [open a PR](/community/Contributing/#pull-requests) if you can help us.

:::

### Permanently delete

:::danger
Permanently deleted file cannot be restored. Please check again before permanently delete any files.

:::

You can permanently delete a file by:

1. Delete it into `Trash` and right clicking it and click the `Permanent Delete` option
2. Select the file and press `Shift + Del` as shortcut

## New

:::caution Be careful with new file/folder name
Xplorer treats `/` on file name/folder as subdir/subfile
:::

### New file

You can create a new file by right clicking the workspace, expand the `New` option and select `file` option or press `Alt + N` as shortcut.

### New folder

You can create a new folder by right clicking the workspace, expand the `New` option and select `folder` option or press `Shift + N` as shortcut.

## Open file

You can open a file on default application by double-clicking it or select the file then press `Enter` as shortcut.

### Open in Terminal

This is built-in function by Xplorer. You can open a folder on Terminal by right clicking it and click `Open in terminal` option or select the folder then press `Alt + T` as shortcut.

### Open in VSCode

This is built-in function by Xplorer. You can open a file/folder on VSCode by right clicking it and click `Open in vscode` option or select the file then press `Ctrl + Enter` as shortcut. You won't able to do this if you don't have VSCode installed.

## Pin to Sidebar

You can pin a file/folder into sidebar by right clicking it and click `Pin to Sidebar` or select the file then press `Alt + P` as shortcut.

## Preview file

You can preview a file directly from Xplorer by right-clicking it and click `Preview` otioin or select the file then press `Ctrl+O`.

![Preview Demo](/img/docs/preview.png)

:::info

<details>
<summary>
Files available to preview for now:
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

## Properties

You can view properties of a file/folder by right clicking it and click `Properties` or select the file then press `Ctrl + P` as shortcut.
Available properties for now (will be improved at the next version):

-   Size
-   File Path
-   Created At
-   Accesssed At
-   Modified At
-   Is Hidden

## Rename file/folder

You can rename a file/folder by right clicking it and click `Rename` option or select the file then press `F2` as shortcut. It will prompt a dialog, enter the new name and the file/folder will be renamed.
