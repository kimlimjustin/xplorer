---
sidebar_position: 2
---

# Інсталяція

## Інсталяція

Ви можете завантажити інсталятор Xplorer [тут](https://github.com/kimlimjustin/xplorer/releases).

## Проблеми з якими Ви можете стикнутись

### AppImages

Завантажте останню версію програми на сторінці [релізів](https://github.com/kimlimjustin/xplorer/releases) та слідуйте [інструкціям](https://docs.appimage.org/introduction/quickstart.html#how-to-run-an-appimage).

### Debian та Ubuntu дистрибутиви

Завантажте **.deb** пакет на сторінці [релізів](https://github.com/kimlimjustin/xplorer/releases).

Для продовження, натисніть `Деталі`, а потім запустити.
```bash
sudo pacman -u [ім'я файлу інсталлятора]
```

**або**

```bash
sudo pacman -u [ім'я файлу інсталлятора] --overwrite "*"
```
### Arch дистрибутив

> Використовуйте ваш улюблений [aur helper](https://wiki.archlinux.org/title/AUR_helpers).

```bash
yay -S xplorer-bin

#або для manjaro

pacman build xplorer-bin
```
**або**

Завантажте **.pacman** інсталятор на сторінці [релізів](https://github.com/kimlimjustin/xplorer/releases).

Ви також можете інсталювати пакет використовуючи:
```bash
sudo pacman -U /path/to/deb/file.pacman
```

**або**

Зібрати пакет з [коду](https://aur.archlinux.org/xplorer-bin.git)
```bash
git clone https://aur.archlinux.org/xplorer-bin.git

cd xplorer-bin

makepkg -si
```
## Поширені проблеми

<details>
<summary>
Стикнулись з Windows Defender?
</summary>

Насправді це не помилка, це значить, що Microsoft вирішили обрати схему "заборонити все" для захисту тих із нас, хто не володіє технікою (тобто потенційно ваших друзів) від вірусів. У цьому випадку вам не потрібно турбуватися про безпеку Xplorer, оскільки він [з відкритим кодом] (https://github.com/kimlimjustin/xplorer), і ви можете перевірити код або навіть створити власну версію!

Щоб вирішити цю проблему, просто натисніть кнопку `Додаткова інформація`, а потім просто натисніть "Виконати все одно".

1. ![Шаг 1](/img/docs/windows-defender-1.png)
2. ![Шаг 2](/img/docs/windows-defender-2.png)

:::note Посилання

Взято з [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
<code>"Xplorer" неможливо відкрити, оскільки розробника неможливо перевірити.</code> Помилка на операційній системі macOS
</summary>

Будь ласка, спробуйте [офіційну документацію](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) від Apple.

</details> <details>
<summary>
Мого улюбленого інсталятора тут немає.
</summary>

Будь ласка, створіть тікет про відсутність вашого улюбленого інсталятора [тут](https://github.com/kimlimjustin/xplorer/new).

</details>
