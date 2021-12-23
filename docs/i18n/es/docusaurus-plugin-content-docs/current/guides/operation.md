# Operaciones

## Copiar archivos

Puede copiar archivos haciendo clic con el botón derecho del ratón y después hacer clic en la opción `Copiar` o seleccionar el archivo y luego presione `Ctrl + C` como un acceso directo y pegarlo haciendo clic en la opción `Pegar` o presione `Ctrl + V` en la carpeta de destino.

:::info

Para la implementación actual, Xplorer escribe lo qué se debe copiar localmente (no copiar al portapapeles).

TODO: implementar copia al portapapeles

:::

## Copiar ruta

Puede copiar la ruta de un archivo/carpeta en el portapapeles haciendo clic derecho en él y haciendo clic en `Copiar ruta de ubicación` o seleccionar el archivo y luego presione `Alt + Mayús + C` como acceso directo.

## Cortar archivos

Puede cortar archivos haciendo clic con el botón derecho del ratón y después hacer clic en la opción `Cortar` o seleccionar el archivo y luego presione `Ctrl + X` como un acceso directo y pegarlo haciendo clic en la opción `Pegar` o presione `Ctrl + V` en la carpeta de destino.

:::info

Para la implementación actual, Xplorer escribe lo qué se debe cortar localmente (no copiar al portapapeles).

:::

## Borrar archivos

Puede eliminar archivos haciendo clic derecho en él y hacer clic en la opción `Eliminar` o seleccionar el archivo y luego presione `Del` como acceso directo.

### Archivos eliminados

Los archivos eliminados se pueden ver en `xplorer://Trash` o en tu carpeta de papelera. :::danger Tarea abierta

Tenga en cuenta que la no se puede acceder a la papelera desde Xplorer desde la [papelera](https://github.com/Byron/trash-rs) Xplorer confía en que no lo soporta (Revisa [esta incidencia](https://github.com/Byron/trash-rs/issues/8) para más detalles).

Cualquier contribución a la papelera o al propio Xplorer para este tema es bienvenida. :::

### Restaurar archivos

Puede restaurar archivos abriendo `xplorer://trash` y haciendo clic derecho en el archivo, después haga clic en la opción `Restaurar`

### Permanently delete

:::danger A permanently deleted file cannot be restored. Please check again before permanently delete any files.

:::

You can permanently delete a file by:

1. Delete it into `Trash` and right-clicking it and click the `Permanent Delete` option
2. Select the file and press `Shift + Del` as a shortcut

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
