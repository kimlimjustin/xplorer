---
sidebar_position: 2
---

# Installation

## Pour Windows et MacOS

Vous pouvez télécharger Xplorer depuis l'installateur [ici](https://github.com/kimlimjustin/xplorer/releases).

## Pour Linux

### AppImages

Saisissez le fichier **.AppImage** dans la page [releases](https://github.com/kimlimjustin/xplorer/releases) et suivez ce [guide](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Distributions basées sur Debian et Ubuntu

Récupérez le fichier **.deb** dans la page [releases](https://github.com/kimlimjustin/xplorer/releases).

Vous pouvez installer avec :

```bash
sudo dpkg -i /path/to/deb/file.deb
```

**ou**

```bash
sudo apt install /path/to/deb/file.deb
```

### Distributions basées sur Arch Linux

> Use your favorite [aur helper](https://wiki.archlinux.org/title/AUR_helpers).

```bash
yay -S xplorer-bin

#ou pour manjaro

pacman build xplorer-bin
```

**ou**

Récupérez le fichier **.pacman** dans la page [releases](https://github.com/kimlimjustin/xplorer/releases).

Vous pouvez installer avec :

```bash
sudo pacman -U /path/to/deb/file.pacman
```

**ou**

construire à partir de la source [ici](https://aur.archlinux.org/xplorer-bin.git)

```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```

## Problèmes courants

<details>
<summary>
Confronté à Windows Defender?
</summary>

En fait, ce n'est pas une erreur, c'est un choix de design de Microsoft pour protéger ceux d'entre nous qui ne sont pas de la technologie (i. , potentiellement vos amis) à partir d'un virus. Vous n'avez pas besoin de vous inquiéter de la sécurité de Xplorer dans ce cas car c'est [open source](https://github.com/kimlimjustin/xplorer) et vous pouvez inspecter le code ou même construire votre propre version !

Pour gérer ceci, vous pouvez simplement cliquer sur le bouton `Plus d'infos` , puis cliquez sur Exécuter de toute façon.

1. ![Étape 1](/img/docs/windows-defender-1.webp)
2. ![Étape 2](/img/docs/windows-defender-2.webp)

:::note Références

Adopté parmi [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
<code>« Xplorer» ne peut pas être ouvert car le développeur ne peut pas être vérifié.</code> Erreur sur macOS
</summary>

Veuillez essayer [la documentation officielle](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) par Apple.

</details> <details>
<summary>
Mon installateur préféré n'est pas là.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer/issues/new/choose).

</details>
