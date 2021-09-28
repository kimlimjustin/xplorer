---
sidebar_position: 2
---

# Installation

## For Windows and MacOS

You can access the installer [here](https://github.com/kimlimjustin/xplorer/releases).

## For Linux

### AppImages

Grab **.AppImage** file in [releases](https://github.com/kimlimjustin/xplorer/releases) and follow this [Guide](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Debian and Ubuntu based distros 

Grab **.deb** file in [releases](https://github.com/kimlimjustin/xplorer/releases).

You can install it by:
```bash
sudo dpkg -i /path/to/deb/file.deb
```
**or**

```bash
sudo apt install /path/to/deb/file.deb
```
### Arch based distros

> Use you favorite [aur helper](https://wiki.archlinux.org/title/AUR_helpers).

```bash
yay -S xplorer-bin

#or for manjaro

pamac build xplorer-bin
```
**or** 

Grab **.pacman** file in [releases](https://github.com/kimlimjustin/xplorer/releases).

You can install it by:
```bash
sudo pacman -U /path/to/deb/file.pacman
```

**or**

build for [source](https://aur.archlinux.org/xplorer-bin.git)
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

To Handle this, you can just click the `More Info` button, then, just click Run Anyway.

1. ![Step 1](/img/docs/windows-defender-1.png)
2. ![Step 2](/img/docs/windows-defender-2.png)

:::note References

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details>
<details>
<summary>
`“Xplorer” cannot be opened because the developer cannot be verified. ` Error on macOS
</summary>

Please try [this official docs](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) by Apple.

</details>
<details>
<summary>
My favorite Installer is not here.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer).

</details>
