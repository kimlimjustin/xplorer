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

> Use your favorite [aur helper](https://wiki.archlinux.org/title/AUR_helpers).

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

En realidad no se trata de un error, sino de una decisión de diseño de Microsoft para proteger a los que no sabemos de tecnología (es decir, potencialmente tus amigos) de un virus. No tienes que preocuparte por la seguridad de Xplorer en este caso ya que es [código abierto](https://github.com/kimlimjustin/xplorer) y puedes inspeccionar el código o incluso construir tu propia versión!

Para Solucionarlo, basta con hacer clic en el botón `Más información` y, a continuación, en Ejecutar de todos modos.

1. ![Paso 1](/img/docs/windows-defender-1.webp)
2. ![Paso 2](/img/docs/windows-defender-2.webp)

:::note referencias

Tomado de [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

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

Por favor, dirija un problema [aquí](https://github.com/kimlimjustin/xplorer/issues/new/choose).

</details>
