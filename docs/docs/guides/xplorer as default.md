# Set As Default File Explorer (Windows)

:::caution
This guide involves modifying the Windows registry, make sure to create a backup beforehand to recover if you got any problem with Xplorer. Please keep in mind that this method may not work for everyone.

> Click [here](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) to Microsoft official documentation on how to backup and restore the registry

:::

1. Type `Win` + `R` and type `regedit.exe`
2. Click `Yes` on the question `Do you want to allow this app to make changes to your devices`
3. Create a backup of the registry (see caution above).
4. Navigate to `Computer\HKEY_CURRENT_USER\Software\Classes\Directory`
5. Create a key named `shell` if not existed by right and set the default key-value to `openinxplorer`
6. Create a key named `openinxplorer` under `shell`
7. Create a key named `command` under `openinxplorer` and set the default key-value to `"C:\Users\User\AppData\Local\Programs\Microsoft VS Code\Code.exe" "%V"`

![Registry Structure](/img/docs/registry.png)

:::info

To create a new subkey, right-click on the parent key and select `New > Key`.
![Regedit create a new subkey](/img/docs/regedit-create-new-key.png)

To set the default key, double click or by right click and click `Modify` on the `Name` and enter the value there.
:::
