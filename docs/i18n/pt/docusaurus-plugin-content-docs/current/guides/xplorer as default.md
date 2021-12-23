# Definir como Explorador de Arquivos Padrão (Windows)

:::caution This guide involves modifying the Windows registry, make sure to create a backup beforehand to recover if you got any problem with Xplorer. Please keep in mind that this method may not work for everyone.

> Clique [aqui](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) para a documentação oficial da Microsoft sobre como fazer backup e restaurar o registro

:::

## Automatic way

### To install

Download [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/setXplorerAsDefault.reg) script from GitHub and double click to run it.

### To uninstall

Download [`/packages/registry-scripts/unsetXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/unsetXplorerAsDefault.reg) script from GitHub and double click to run it.

## Manual way

1. Pressione `Win` + `R` e digite `regedit.exe`
2. Click `Yes` on the question `Do you want to allow this app to make changes to your devices`
3. Crie um backup do registro (veja a atenção acima).
4. Navigate to `Computer\HKEY_CURRENT_USER\Software\Classes\Directory\shell'`
5. Update the Default value to `Xplorer`. This will make Xplorer the default file explorer. (To change it back, just update the value to `open`)

![Manual way to make Xplorer as default File Explorer (Windows)](/img/docs/edit_registry.gif)
