# Установить как стандартный Проводник (Windows)

:::caution This guide involves modifying the Windows registry, make sure to create a backup beforehand to recover if you got any problem with Xplorer. Please keep in mind that this method may not work for everyone.

> Нажмите [сюда](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692), чтобы перейти в официальную документацию Microsoft и узнать о том, как сделать резервную копию и восстановить реестр

:::

1. Нажмите `Win` + `R` и наберите `regedit.exe`
2. Click `Yes` on the question `Do you want to allow this app to make changes to your devices`
3. Сделайте резервную копию реестра (см. предупреждение выше).
4. Перейдите в `Компьютер\HKEY_CURRENT_USER\Software\Classes\Directory`
5. Create a key named `shell` if not existed by right and set the default key-value to `openinxplorer`
6. Создайте раздел `openinxplorer` под `shell`
7. Create a key named `command` under `openinxplorer` and set the default key-value to `"C:\Program Files\Xplorer\Xplorer.exe" "%V"`. (You may have to change `C:\Program Files\Xplorer\` to the location you installed Xplorer)

![Структура реестра](/img/docs/registry.png)

:::info

To create a new subkey, right-click on the parent key and select `New > Key`. ![Создать новый подраздел в Regedit](/img/docs/regedit-create-new-key.png)

Для установки значения по умолчанию, дважды кликните или нажмите правую кнопку мыши на `Изменить` там, где `Имя` и введите значение там. :::
