---
sidebar_position: 2
---

# Встановлення

## Установние

Ви можете завантажити його [тут](https://github.com/kimlimjustin/xplorer/releases).

## Проблеми з якими Ви стикнутись

<details>
<summary>
Спрацьовує захисник Windows
</summary>

Насправді це не помилка. Так вирішили у корпорації Microsoft, для тих, хто не розбирається у технологіях. Не слід непокоїтись про безпеку Xplorer, у нього [відкритий код](https://github.com/kimlimjustin/xplorer) і Ви можете з легцістю створити власну версію або модификувати існуючу!

Для продовження, натисніть `Деталі`, а потім запустити.

1. ![Шаг 1](/img/docs/windows-defender-1.png)
2. ![Шаг 2](/img/docs/windows-defender-2.png)

:::note Посилання

Взято з [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
Як встановити на Arch OS?
</summary>

Запустити наступну команду:

```bash
sudo pacman -u [ім'я файлу інсталлятора]
```

:::info Якщо Ви стикнулись з повідомлення `xplorer exists in filesystem`, запустіть наступну команду:

```bash
sudo pacman -u [ім'я файлу інсталлятора] --overwrite "*"
```

:::

</details> <details>
<summary>
Немає мого улюбленого інсталятора.
</summary>

Будь ласка, створіть запит [тут](https://github.com/kimlimjustin/xplorer).

</details>
