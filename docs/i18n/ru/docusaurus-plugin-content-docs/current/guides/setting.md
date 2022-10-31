# Настройки

<details>
<summary>
Как открыть настройки?
</summary>
Вы можете открыть настройки на Xplorer, нажав кнопку `Настройки` слева внизу.

![Настройки](/img/docs/settings.webp)

</details> <details>
<summary>
Как выйти из настроек?
</summary>
Вы можете выйти из настроек, нажав стрелку вверх в верхней части слева от Xplorer.

![Настройки](/img/docs/exit-settings.webp)

</details>

## Внешний вид

### Тема приложения

Вы можете изменить тему приложения Xplorer во вкладке `Внешний вид` в настройках. Доступные по умолчанию темы: `light`, `light+`, `dark`, и `dark+`. Кроме того, есть тема `Как на устройстве` которая автоматически узнает какая тема у вашего устройства, также попробуйте [кастомные темы](/docs/Extensions/theme/).

#### Эффект Тени

| С Эффектом Тени                                | Без Эффекта Тени                                     |
| ---------------------------------------------- | ---------------------------------------------------- |
| ![Shadow Effect](/img/docs/shadow-effect.webp) | ![No Shadow Effect](/img/docs/no-shadow-effect.webp) |

Включение эффекта тени зависит от вашей системы. В Windows, вы не можете выключить этот эффект если вы используете [`Как на устройстве`](#frame-style).

### Семейство Шрифтов

Вы можете изменить семейство шрифтов Xplorer на вкладке `Внешний вид` на одну из установленных семейств шрифтов в вашей системе.

### Размер Шрифта

Размер шрифта Xplorer можно изменить на вкладке `Внешний Вид` в настройках. Обратите внимание на то что идеальный размер шрифта составляет от 10px до 30px.

### Прозрачность окна

Вы можете изменить прозрачность окна Xplorer во вкладке `Внешний Вид` в настройках комбинируя следующие параметры. Обратите внимания, что идеальная прозрачность окна составляет от 70% до 100%. Вы можете выключить прозрачность окна, отключив все опции прозрачности.

#### Transparent Sidebar

Make the sidebar transparent ![Transparent Sidebar](/img/docs/transparent-sidebar.webp)

#### Transparent Topbar

Make the topbar transparent ![Transparent Topbar](/img/docs/transparent-topbar.webp)

#### Transparent Workspace

Make the workspace transparent ![Transparent Workspace](/img/docs/transparent-workspace.webp)

#### Transparent Effect

You can update the transparency effect on the workspace by changing the transparency value on the `Transparency Effect` option (expected to work on Windows 10 only). Available effects:

-   `Blur` (somewhat laggy when dragging)
-   `Acylic`(works only on Windows 10 and above, it also has bad performance when resizing/dragging the window)
-   `Vibrancy` (works only on macOS)
-   `None`(recommended) (need to restart app to change back to none)

### Frame Style

You can choose the frame style on the `Appearance` tab of the Settings. The available options are `Default` and `System Default`. `Default` will use Xplorer's default style which is the same across platforms. `System Default` will use the system default frame style which is difference according to your platform.

### File Preview

File Preview here might means the file thumbnail.

#### Automatically play video file as thumbnail

This will automatically play the video file as a preview. :::caution THIS MIGHT CONSUME HIGH AMOUNT OF RAM
This might consume a high amount of RAM because it's built on the HTML video player.
You can just enable this setting and ignore this caution if you got a good-spec computer.
:::

#### Preview image on hover

This fill automatically show the image when you hovering it for 500ms.

![Preview on hover](/img/docs/preview-on-hover.webp)

Some people might found it annoying and you can disable it by disabling this setting.

#### Extract exe file icon and make it as the thumbnail

This will parse and cache the icon from a `exe` file and make it a preview. Only on Windows.

![Extract Exe file icon](/img/docs/extract-exe-icon.webp)

:::warning This might causes Xplorer to crash.

This is because Xplorer parses the icon from the exe and if the hexadecimal of the exe file is broken, Xplorer crashes.

The way to fix it is to disable the setting.

:::

:::info Open issue The current approach is by calling the powershell program which might pops up cmd windows.

Any contribution to call it directly from Xplorer is welcome. :::

### Show Image as Thumbnail

This will show the image as a thumbnail of a file. Please note that this is not recommended for large directory as it reads the image to memory.

### Default file layout

Default file layout of a directory. Just give it a try :)

### Workspace

#### Show info bar

An option to show the info bar on the workspace. ![Xplorer's infobar](/img/docs/infobar.webp)

## Preference

### App Language

Localize Xplorer. Help us translate Xplorer, [see this discussion](https://github.com/kimlimjustin/xplorer/discussions/30).

### Hide Hidden Files

Hide hidden files on Xplorer, you can find this setting on the `Preference` tab on Xplorer or by its shortcut, `Ctrl + H`.

### Hide System Files

Hide Windows' system files on Xplorer. :::tip Learn what is system file [in this wikipedia](https://en.wikipedia.org/wiki/System_file). Just turn it off if you don't understand what it is. :::

### List and sort directories alongside files

If disabled, Xplorer will prioritize directories above files.

### Detect Drive Change

Turning this on will detect drive change and update the sidebar and drives section. Please note that this will take high ammount of RAM as this is not stabilized yet.

### Automatically change preview file with selected file

Enabling this will automatically change the preview file with the current selected file.

### Calculate sub folder size

Enabling this option will automatically help you to calculate the size of sub folders recursively and show it on detail view.

### Single/Double Click to open a file

Enabling this will make Xplorer to open a file with double click. Otherwise, it will open a file with single click.

### On startup

Option to do on starting Xplorer. Available options are:

-   New Tab
-   Continue previous session
