# Ejecutar Xplorer desde la terminal

:::info This feature hasn't been optimized yet. Funciona, pero podría ser un poco bugueado. This will be optimized in the feature release. :::

## Comandos

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer abrirá `dir`, `dir2`, `dir3` como pestañas. If there's no directory(dir) passed into the command, Xplorer will start at the Home page.

Opciones:

| Comando     | Alias | Descripción                                           |
| ----------- | ----- | ----------------------------------------------------- |
| `--help`    | `-h`  | Mostrar ayuda                                         |
| `--version` | `-v`  | Mostrar el número de versión                          |
| `--revelar` | `-r`  | Abrir la carpeta contenedora y seleccionar el archivo |

<details>
<summary>
<code>xplorer: comando no encontrado</code> error en Windows
</summary>

En primer lugar, debe registrar el comando en la ruta del sistema.

1. Abrir `Propiedades del sistema` en Windows.
2. Click the `Environment Variables` button, it will pop up a window.
3. On the table, search for the `Path` variable and click on it.
4. Click the `Edit` button, it will pop up a window.
5. Click the `New` button.
6. Add `%USERPROFILE%\AppData\Local\Programs\xplorer`.

</details>
