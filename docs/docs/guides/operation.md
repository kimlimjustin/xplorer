# Operations

## Copy files

You can copy files by right-clicking it and click the `Copy` option or select the file then press `Ctrl + C` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info

On Windows and macOS, Xplorer will copy the file paths into the local clipboard, because of this, you can copy a file from Xplorer and paste it into any folder in another system. However, on Linux, we create a string of Xplorer commands and copy it into the user clipboard, Xplorer will read the user's clipboard when pasting the file (because we haven't found any idea to implement it, feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us). The string of the Xplorer command looks like this:

```
Xplorer command - COPY
~/xplorer
~/test
```

:::

## Copy Location Path

You can copy a file/folder location path into your clipboard by right-clicking it and click `Copy Location Path` or select the file then press `Alt + Shift + C` as a shortcut.

## Cut files

You can cut files by right-clicking it and click the `Cut` option or select the file then press `Ctrl + X` as a shortcut and paste it by clicking the `Paste` option or press `Ctrl + V` on the destination folder.

:::info
This is done by creating a string of Xplorer command and copies it into the user clipboard to be used when pasting file (this is not integrated with the platform because we haven't found any idea, feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us.). The string of Xplorer command looks like this:

```
Xplorer command - CUT
E://xplorer
E://test
```

:::

## Delete files

You can cut files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut. The trashed file can be accessed at `xplorer://Trash`.

:::info

-   On Windows, this is done by creating a `Trash` folder on the `C:` drive and moving the file into it.
-   On Linux, this feature is fully integrated with the system.
-   On macOS, this is done by creating a `.local/Trash` folder on `homedir` and moving the file into it.

We are still working on Windows on macOS to integrate the `Trash` folder, which will be released before the stable version came out. Feel free to [open a PR](/community/Contributing/#pull-requests) if you can help us.

:::

### Permanently delete

:::danger
A permanently deleted file cannot be restored. Please check again before permanently delete any files.

:::

You can permanently delete a file by:

1. Delete it into `Trash` and right-clicking it and click the `Permanent Delete` option
2. Select the file and press `Shift + Del` as a shortcut

## New

:::caution Be careful with new file/folder name
Xplorer treats `/` on file name/folder as subdir/subfile
:::

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

You can view properties of a file/folder by right-clicking it and click `Properties` or select the file then press `Ctrl + P` as a shortcut.
Available properties for now (will be improved at the next version):

-   Size
-   File Path
-   Created At
-   Accessed At
-   Modified At
-   Is Hidden

## Rename file/folder

You can rename a file/folder by right-clicking it and click the `Rename` option or select the file then press `F2` as a shortcut. It will prompt a dialog, enter the new name and the file/folder will be renamed.
