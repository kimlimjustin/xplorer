---
sidebar_position: 2
---

# Instalación

## Para Windows y MacOS

Puedes descargar el instalador [aquí](https://github.com/kimlimjustin/xplorer/releases).

## Para Linux

### AppImages

Tome el archivo **.AppImage** en la página [versiones ](https://github.com/kimlimjustin/xplorer/releases) y siga esta [guía](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Distribuciones Debian y Ubuntu

Tome el archivo **.deb** en la página [versiones ](https://github.com/kimlimjustin/xplorer/releases).

Puede instalarlo con:
```bash
sudo dpkg -i /path/to/deb/file.deb
```

**o**

```bash
sudo apt install /path/to/deb/file.deb
```
### Distribuciones Arch

> Usa tu [helper de Arch](https://wiki.archlinux.org/title/AUR_helpers) favorito.

```bash
yay -S xplorer-bin

#or for manjaro

pacman build xplorer-bin
```
**o**

Tome el archivo **.pacman** en la página [versiones ](https://github.com/kimlimjustin/xplorer/releases).

Puede instalarlo con:
```bash
sudo pacman -U /path/to/deb/file.pacman
```

**o**

compilar desde [fuente](https://aur.archlinux.org/xplorer-bin.git)
```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```
## Problemas comunes

<details>
<summary>
¿Problemas con Windows Defender?
</summary>

This is actually not an error, it's a design choice by Microsoft to protect those of us who are not tech-savvy (i.e. potentially your friends) from a virus. You don't need to worry about the safety of Xplorer in this case since it's [open source](https://github.com/kimlimjustin/xplorer) and you can inspect the code or even build your own version!

To handle this, you can just click the `More Info` button, then, just click Run Anyway.

1. ![Paso 1](/img/docs/windows-defender-1.png)
2. ![Paso 2](/img/docs/windows-defender-2.png)

:::note References

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
<code>“Xplorer” no se puede abrir porque el desarrollador no puede ser verificado.</code> Error en macOS
</summary>

Revise [la documentación oficial](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) de Apple.

</details> <details>
<summary>
Mi instalador favorito no está aquí.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer/new).

</details>
