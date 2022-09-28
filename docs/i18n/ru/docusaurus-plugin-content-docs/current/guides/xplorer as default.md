# Установить как стандартный Проводник (Windows)

:::caution This guide involves modifying the Windows registry, make sure to create a backup beforehand to recover if you got any problem with Xplorer. Please keep in mind that this method may not work for everyone.

> Нажмите [сюда](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692), чтобы перейти в официальную документацию Microsoft и узнать о том, как сделать резервную копию и восстановить реестр

:::

## Automatic way

### To install

Download [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/setXplorerAsDefault.reg) script from GitHub and double click to run it.

### To uninstall

Download [`/packages/registry-scripts/unsetXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/unsetXplorerAsDefault.reg) script from GitHub and double click to run it.

## Manual way

1. Нажмите `Win` + `R` и наберите `regedit.exe`
2. Click `Yes` on the question `Do you want to allow this app to make changes to your devices`
3. Сделайте резервную копию реестра (см. предупреждение выше).
4. Navigate to `Computer\HKEY_CURRENT_USER\Software\Classes\Directory\shell'`
5. Update the Default value to `Xplorer`. This will make Xplorer the default file explorer. (To change it back, just update the value to `open`)

![Manual way to make Xplorer as default File Explorer (Windows)](/img/docs/edit_registry.gif)
