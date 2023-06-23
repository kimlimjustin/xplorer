# Paramètres

<details>
<summary>
Comment ouvrir les paramètres ?
</summary>
Vous pouvez ouvrir les paramètres sur Xplorer en cliquant sur le bouton `Paramètres` à gauche de Xplorer.

![Paramètres](/img/docs/settings.webp)

</details> <details>
<summary>
Comment quitter les paramètres ?
</summary>
Vous pouvez quitter les paramètres de Xplorer en cliquant sur le côté en haut et gauche de Xplorer.

![Paramètres](/img/docs/exit-settings.webp)

</details>

## Apparence

### Thème de l'appli

Vous pouvez modifier le thème de l'application Xplorer dans l'onglet `Apparence` des Paramètres. Les thèmes disponibles par défaut sont `light`, `light+`, `dark`et `dark+`. Besides, there is a `System Default` theme that will automatically read your system preference, also you can [try custom themes](/docs/Extensions/theme/).

#### Apply Shadow Effect

| With Shadow Effect                             | Without Shadow Effect                                |
| ---------------------------------------------- | ---------------------------------------------------- |
| ![Shadow Effect](/img/docs/shadow-effect.webp) | ![No Shadow Effect](/img/docs/no-shadow-effect.webp) |

Apply platform-dependent shadow effect to the window. On Windows, you can't disable this effect when using [`System Default` frame style](#frame-style).

### Famille de police

You can change Xplorer's font family on the `Appearance` tab of the Settings to one of installed font families installed on your system.

### Taille de la Police

You can change Xplorer's font size on the `Appearance` tab of the Settings. Please note that an ideal font size is between 10px to 30px.

### Transparence de la Fenêtre

Make Xplorer window transparent on the `Appearance` tab of the Settings by combining following options. Please note that an ideal transparency is between 70% to 100%. You can disable transparency by disable all of the transparency options.

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

### Style de cadre

You can choose the frame style on the `Appearance` tab of the Settings. The available options are `Default` and `System Default`. `Default` will use Xplorer's default style which is the same across platforms. `System Default` will use the system default frame style which is difference according to your platform.

### Aperçu du fichier

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

## Préférences

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
