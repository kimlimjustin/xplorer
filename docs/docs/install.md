---
sidebar_position: 2
---

# Installation

## For Windows and MacOS

You can download Xplorer from the installer [here](https://github.com/kimlimjustin/xplorer/releases).

## For Linux

### AppImages

Grab the **.AppImage** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page and follow this [guide](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Debian and Ubuntu based distros

Grab the **.deb** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page.

You can install it by:

```bash
sudo dpkg -i /path/to/deb/file.deb
```

**or**

```bash
sudo apt install /path/to/deb/file.deb
```

### Arch based distros

> Use your favorite [aur helper](https://wiki.archlinux.org/title/AUR_helpers).

```bash
yay -S xplorer-bin

#or for manjaro

pacman build xplorer-bin
```

**or**

Grab the **.pacman** file in the [releases](https://github.com/kimlimjustin/xplorer/releases) page.

You can install it by:

```bash
sudo pacman -U /path/to/deb/file.pacman
```

**or**

build from [source](https://aur.archlinux.org/xplorer-bin.git)

```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```

## Common Problems

<details>
<summary>
Faced Windows Defender?
</summary>

This is actually not an error, it's a design choice by Microsoft to protect those of us who are not tech-savvy (i.e. potentially your friends) from a virus. You don't need to worry about the safety of Xplorer in this case since it's [open source](https://github.com/kimlimjustin/xplorer) and you can inspect the code or even build your own version!

To handle this, you can just click the `More Info` button, then, just click Run Anyway.

1. ![Step 1](/img/docs/windows-defender-1.webp)
2. ![Step 2](/img/docs/windows-defender-2.webp)

:::note References

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details>
<details>
<summary>
<code>“Xplorer” cannot be opened because the developer cannot be verified.</code> Error on macOS
</summary>

Please try [the official docs](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) by Apple.

</details>
<details>
<summary>
My favorite Installer is not here.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer/issues/new/choose).

</details>
