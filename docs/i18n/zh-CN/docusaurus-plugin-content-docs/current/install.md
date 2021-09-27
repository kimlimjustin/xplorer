---
sidebar_position: 2
---

# Installation

## Installer

You can acess the installer [here](https://github.com/kimlimjustin/xplorer/releases).

## Common Problems

<details>
<summary>
Faced Windows Defender?
</summary>

This is actually not an error, it's a design choice by Microsoft to protect those of us who are not tech-savvy (i.e. potentially your friends) from virus. You don't need to worry the safety of Xplorer in this case, since it's [open source](https://github.com/kimlimjustin/xplorer) and you can inspect the code or even build your own version!

To Handle this, you can just click the `More Info` button, then, just click Run Anyway.

1. ![Step 1](/img/docs/windows-defender-1.png)
2. ![Step 2](/img/docs/windows-defender-2.png)

:::note References

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
How to install in Arch OS?
</summary>

Run following command:

```bash
sudo pacman -u [installer file name]
```

:::info If you faced the `xplorer exists in filesystem` error, run this command instead:

```bash
sudo pacman -u [installer file name] --overwrite "*"
```

:::

</details> <details>
<summary>
There is no my favourites installer.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer).

</details>
