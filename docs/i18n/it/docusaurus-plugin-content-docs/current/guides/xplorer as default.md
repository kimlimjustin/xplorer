# Imposta Come File Explorer Predefinito (Windows)

:::caution Questa guida comporta la modifica del registro di sistema di Windows, assicurarsi di creare un backup in anticipo per recuperare se si ha qualche problema con Xplorer. Si prega di tenere a mente che questo metodo potrebbe non funzionare per tutti.

> Clicca [qui](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) per la documentazione ufficiale di Microsoft su come eseguire il backup e ripristinare il Registro di sistema

:::

## Metodo automatizzato

### Per installare

Scarica lo script [`/packages/registry-scripts/setXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/setXplorerAsDefault.reg) da GitHub e fai doppio clic per eseguirlo.

### Per disinstallare

Scarica lo script [`/packages/registry-scripts/unsetXplorerAsDefault.reg`](https://github.com/kimlimjustin/xplorer/blob/master/packages/registry-scripts/unsetXplorerAsDefault.reg) da GitHub e fai doppio clic per avviarlo.

## Metodo manuale

1. Digita `Win` + `R` e digita `regedit.exe`
2. Clicca `Sì` sulla domanda `Vuoi consentire a questa app di apportare modifiche ai tuoi dispositivi`
3. Creare un backup del registro di sistema (vedi cautela sopra).
4. Vai a `Computer\HKEY_CURRENT_USER\Software\Classes\Directory\shell'`
5. Aggiorna il valore predefinito a `Xplorer`. Questo renderà Xplorer il file explorer predefinito. (Per ripristinarlo, basta aggiornare il valore a `open`)

![Modo manuale per impostare Xplorer come File Explorer predefinito (Windows)](/img/docs/edit_registry.gif)
