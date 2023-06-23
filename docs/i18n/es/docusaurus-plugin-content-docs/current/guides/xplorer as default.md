# Establecer como explorador de archivos por defecto (Windows)

:::Advertencia Esta guía implica modificar el registro de Windows, asegúrate de crear una copia de seguridad de antemano para recuperarla si tienes algún problema con Xplorer. Por favor, tenga en cuenta que este método puede no funcionar para todos.

> Haga clic [aquí](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) en la documentación oficial de Microsoft sobre cómo hacer una copia de seguridad y restaurar el registro

:::

## Automáticamente

### Para instalar

Descarga [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/setXplorerAsDefault.reg) script de GitHub y haz doble clic para ejecutarlo.

### Para desinstalar

Descarga [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/unsetXplorerAsDefault.reg) script de GitHub y haz doble clic para ejecutarlo.

## Manualmente

1. Presiona `Win` + `R` y escribe `regedit.exe`
2. Haga clic en `Sí` en la pregunta `¿Desea permitir que esta aplicación haga cambios en sus dispositivos`
3. Crear una copia de seguridad del registro (ver precaución anterior).
4. Vaya a `computer\HKEY_CURRENT_USER\Software\Classes\Directory\shell'`
5. Actualizar el valor predeterminado a `Xplorer`. Esto hará que Xplorer sea el explorador de archivos predeterminado. (Para volver a cambiarlo, solo actualice el valor a `abrir`)

![Guía manual para hacer Xplorer como explorador de archivos por defecto (Windows)](/img/docs/edit_registry.gif)
