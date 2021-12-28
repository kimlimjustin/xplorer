---
sidebar_position: 2
---

# Instalação

## Para Windows e MacOS

Você pode baixar o Xplorer pelo instalador [aqui](https://github.com/kimlimjustin/xplorer/releases).

## Para Linux

### AppImages

Grab the **.AppImage** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page and follow this [guide](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Distribuições baseadas em Debian e Ubuntu

Grab the **.deb** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page.

Você pode instalá-lo com os seguintes comandos:

```bash
sudo dpkg -i /path/to/deb/file.deb
```

**ou**

```bash
sudo apt install /path/to/deb/file.deb
```

### Para sistemas baseados em Arch Linux

> Use seu [AUR](https://wiki.archlinux.org/title/AUR_helpers) favorito.

```bash
yay -S xplorer-bin

#ou para o manjaro

pacman build xplorer-bin
```

**ou**

Grab the **.pacman** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page.

Você pode instalá-lo das seguintes formas:

```bash
sudo pacman -U /path/to/deb/file.pacman
```

**ou**

build from [source](https://aur.archlinux.org/xplorer-bin.git)

```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```

## Problemas comuns

<details>
<summary>
Enfrentou o Windows Defender?
</summary>

Na verdade, isto não é um erro, é uma escolha de design da Microsoft para proteger aqueles de nós que não são experientes em tecnologia (i.e. potencialmente seus amigos) do vírus. Você não precisa se preocupar com a segurança do Xplorer neste caso, já que é de [código aberto](https://github.com/kimlimjustin/xplorer) e você pode inspecionar o código ou até mesmo compilar sua própria versão!

To handle this, you can just click the `More Info` button, then, just click Run Anyway.

1. ![Passo 1](/img/docs/windows-defender-1.webp)
2. ![Passo 2](/img/docs/windows-defender-2.webp)

:::note Referências

Referência de [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
<code>“Xplorer” não pode ser aberto porque o desenvolvedor não pôde ser verificado.</code> Erro no macOS
</summary>

Please try [the official docs](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) by Apple.

</details> <details>
<summary>
O meu instalador favorito não está aqui.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer/new).

</details>
