---
sidebar_position: 2
---

# Installazione

## Per Windows e MacOS

Puoi scaricare Xplorer dall'installer [qui](https://github.com/kimlimjustin/xplorer/releases).

## Per Linux

### AppImages

Prendi il file **.AppImage** nella [pagina delle release](https://github.com/kimlimjustin/xplorer/releases) e segui questa [guida](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Debian e distribuzioni Linux basate su Ubuntu

Prendi il file **.deb** nella pagina [releases](https://github.com/kimlimjustin/xplorer/releases).

È possibile installarlo con il seguente comando:

```bash
sudo dpkg -i /path/to/deb/file.deb
```

**oppure**

```bash
sudo apt install /path/to/deb/file.deb
```

### Distribuzioni basate su Arch Linux

> Utilizza il tuo [aur helper](https://wiki.archlinux.org/title/AUR_helpers) preferito.

```bash
yay -S xplorer-bin

#o per manjaro

pacman build xplorer-bin
```

**oppure**

Prendi il file **.pacman** nella pagina [releases](https://github.com/kimlimjustin/xplorer/releases).

È possibile installarlo con il seguente comando:

```bash
sudo pacman -U /path/to/deb/file.pacman
```

**oppure**

compilarlo dalla [sorgente](https://aur.archlinux.org/xplorer-bin.git)

```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```

## Problemi Comuni

<details>
<summary>
È comparso Windows Defender?
</summary>

Questo in realtà non è un errore, è una scelta di design da parte di Microsoft per proteggere quelli di noi che non sono tech-savvy (es. potenzialmente i tuoi amici) da un virus. Non devi preoccuparti della sicurezza di Xplorer in questo caso poiché è [open source](https://github.com/kimlimjustin/xplorer) e puoi ispezionare il codice o persino costruire la tua versione!

Per gestire questo problema, è sufficiente fare clic sul pulsante `Maggiori informazioni`, quindi, basta fare clic su Esegui comunque.

1. ![Passo 1](/img/docs/windows-defender-1.webp)
2. ![Passo 2](/img/docs/windows-defender-2.webp)

:::note Riferimenti

Adottato da [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
<code>“Xplorer” non può essere aperto perché lo sviluppatore non può essere verificato.</code> Errore su macOS
</summary>

Si prega di consultare [i documenti ufficiali](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) di Apple.

</details> <details>
<summary>
Il mio Installer preferito non è qui.
</summary>

Si prega di segnalare il problema [qui](https://github.com/kimlimjustin/xplorer/issues/new/choose).

</details>
