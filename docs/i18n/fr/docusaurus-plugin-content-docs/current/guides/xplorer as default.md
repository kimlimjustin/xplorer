# Définir comme Explorateur de fichiers par défaut (Windows)

:::caution Ce guide implique de modifier le registre de Windows, assurez-vous de créer une sauvegarde préalablement pour récupérer si vous avez un problème avec Xplorer. Veuillez garder à l'esprit que cette méthode peut ne pas fonctionner pour tout le monde.

> Cliquez [ici](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) à la documentation officielle de Microsoft sur la façon de sauvegarder et de restaurer le registre

:::

1. Tapez `Win` + `R` et tapez `regedit.exe`
2. Cliquez sur `Oui` sur la question `Voulez-vous autoriser cette application à apporter des modifications à vos appareils`
3. Créer une sauvegarde du registre (voir la prudence ci-dessus).
4. Naviguez vers `Ordinateur\HKEY_CURRENT_USER\Software\Classes\Directory`
5. Créer une clé nommée `shell` si elle n'existe pas à droite et définir la valeur par défaut à `openinxplorer`
6. Créer une clé nommée `openinxplorer` sous `shell`
7. Créez une clé nommée `commande` sous `openinxplorer` et définissez la valeur par défaut à `"C:\Program Files\Xplorer\Xplorer.exe" "%V"`. (Vous devrez peut-être changer `C:\Program Files\Xplorer\` à l'emplacement où vous avez installé Xplorer)

![Structure du Registre](/img/docs/registry.png)

:::info

Pour créer une nouvelle clé secondaire, faites un clic droit sur la clé parente et sélectionnez `Nouvelle > Clé`. ![Regedit crée une nouvelle clé secondaire](/img/docs/regedit-create-new-key.png)

Pour définir la clé par défaut, double-clic ou par clic droit et cliquez sur `Modifier` sur le `Nom` et entrez la valeur là. :::
