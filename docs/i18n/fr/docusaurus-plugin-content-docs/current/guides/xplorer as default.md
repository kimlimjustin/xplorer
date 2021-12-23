# Définir comme Explorateur de fichiers par défaut (Windows)

:::caution Ce guide implique de modifier le registre de Windows, assurez-vous de créer une sauvegarde préalablement pour récupérer si vous avez un problème avec Xplorer. Veuillez garder à l'esprit que cette méthode peut ne pas fonctionner pour tout le monde.

> Cliquez [ici](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) à la documentation officielle de Microsoft sur la façon de sauvegarder et de restaurer le registre

:::

## Automatic way

### To install

Download [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/setXplorerAsDefault.reg) script from GitHub and double click to run it.

### To uninstall

Download [`/packages/registry-scripts/unsetXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/unsetXplorerAsDefault.reg) script from GitHub and double click to run it.

## Manual way

1. Tapez `Win` + `R` et tapez `regedit.exe`
2. Cliquez sur `Oui` sur la question `Voulez-vous autoriser cette application à apporter des modifications à vos appareils`
3. Créer une sauvegarde du registre (voir la prudence ci-dessus).
4. Navigate to `Computer\HKEY_CURRENT_USER\Software\Classes\Directory\shell'`
5. Update the Default value to `Xplorer`. This will make Xplorer the default file explorer. (To change it back, just update the value to `open`)

![Manual way to make Xplorer as default File Explorer (Windows)](/img/docs/edit_registry.gif)
