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

You can delete files by right-clicking it and click the `Delete` option or select the file then press `Del` as a shortcut.

### Archivos eliminados

Los archivos eliminados se pueden ver en `xplorer://Trash` o en tu carpeta de papelera. :::danger Tarea abierta

Tenga en cuenta que la no se puede acceder a la papelera desde Xplorer desde la [papelera](https://github.com/Byron/trash-rs) Xplorer confía en que no lo soporta (Revisa [esta incidencia](https://github.com/Byron/trash-rs/issues/8) para más detalles).

Cualquier contribución a la papelera o al propio Xplorer para este tema es bienvenida. :::

### Restaurar archivos

Puede restaurar archivos abriendo `xplorer://trash` y haciendo clic derecho en el archivo, después haga clic en la opción `Restaurar`

### Eliminar permanentemente

:::danger No se puede restaurar un archivo eliminado permanentemente. Por favor, compruebe de nuevo antes de eliminar permanentemente cualquier archivo.

:::

Puedes eliminar permanentemente un archivo de las siguientes formas:

1. Eliminar en la `basura` y haga clic derecho en ella y haga clic en la opción `Eliminar permanente`
2. Seleccione el archivo y presione `Shift + Del` como atajo de teclado

## Buscar archivos

Xplorer usa [`glop patterns`](https://en.wikipedia.org/wiki/Glob_(programming)) para buscar archivos coincidentes. [Aprende sobre la sintaxis de patrón de Glob](https://en.wikipedia.org/wiki/Glob_(programming)). Para empezar, pulsa `Ctrl + F` y escribe dentro del cuadro de búsqueda.

### Búsqueda instantánea

Puede buscar instantáneamente un archivo/directorio escribiendo los caracteres iniciales del nombre del archivo/dir y Xplorer seleccionará el archivo para usted. Algunas reglas de búsqueda instantánea:

-   Se eliminar cualquier diacritico Ingles
-   El intervalo para la búsqueda instantánea es de 750ms. Después de 750ms, la consulta de búsqueda se restablecerá.
-   Escribir el mismo carácter hará que Xplorer encuentre las siguientes coincidencias.

## Nuevo

:::cuidado Tenga cuidado con el nuevo nombre de archivo/carpeta Xplorer trata `/` en el nombre del archivo/carpeta como subdir/subarchivo :::

### Nuevo archivo

Puede crear un nuevo archivo haciendo clic derecho en el área de trabajo, expande la `Nueva` opción y seleccione la `opción del archivo`, o presione `Alt + N` como atajo de teclado.

### Nueva carpeta

Puede crear un nuevo archivo haciendo clic derecho en el área de trabajo, expande la `Nueva` opción y seleccione la `opción del archivo`, o presione `Alt + N` como atajo de teclado.

## Abrir archivo

Puede abrir un archivo en la aplicación predeterminada haciendo doble clic en él o seleccionando el archivo y luego presione `Enter` como atajo de teclado.

### Abrir en Terminal

Esta es una función integrada por Xplorer. Puede eliminar archivos haciendo clic derecho en él y hacer clic en la opción `Eliminar` o seleccionar el archivo y luego presione `Del` como atajo de teclado.

### Abrir en VSCode

Esta es una función integrada por Xplorer. Puede abrir un archivo/carpeta en VSCode haciendo clic derecho en él y haciendo clic en la opción `Abrir en vscode` o seleccionar el archivo y luego presione `Ctrl + Enter` como atajo de teclado. No podrás hacer esto si no tienes VSCode instalado.

## Anclar a la barra lateral

Puede copiar la ruta de un archivo/carpeta en el portapapeles haciendo clic derecho en él y haciendo clic en `Copiar ruta de ubicación` o seleccionar el archivo y luego presione `Alt + Mayús + C` como atajo de teclado.

## Vista previa archivo

Puede previsualizar un archivo directamente desde Xplorer haciendo clic derecho en él y haciendo clic en la opción `Vista previa` o seleccionar el archivo y luego presione `Ctrl+O`.

![Demo de vista previa](/img/docs/preview.webp)

:::info

<details>
<summary>
Archivos disponibles para previsualizar por ahora:
</summary>

* Archivos Markdown
* Archivos de imagen
* Ficheros de texto
* Vídeos
* Pdf's
* Casi todos los lenguajes de programación con resaltado de sintaxis

</details>

:::

## Propiedades

Puede ver las propiedades de un archivo/carpeta haciendo clic derecho en él y haciendo clic en `Propiedades` o seleccione el archivo y luego presione `Ctrl + P` como atajo de teclado. Propiedades disponibles por ahora (se mejorará en la próxima versión):

-   Tamaño
-   Ruta de archivo
-   Creada en
-   Último acceso
-   Fecha de última modificación
-   Está oculto

## Renombrar Archivo/Folder

Puede renombrar un archivo/carpeta haciendo clic derecho en él y haciendo clic en la opción `Renombrar` o seleccionar el archivo y luego presione `F2` como atajo de teclado. Le pedirá un diálogo, introduzca el nuevo nombre y el archivo/carpeta será renombrado.
