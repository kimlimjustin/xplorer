---
sidebar_position: 2
---

# Установка

## Установщик

Вы можете скачать его [здесь](https://github.com/kimlimjustin/xplorer/releases).

## Распространенные проблемы

<details>
<summary>
Срабатывает Защитник Windows
</summary>

На самом деле это не ошибка. Так решила Microsoft, чтобы защитить тех, кто не разбирается в технологиях (т.е. потенциально ваших друзей) от вирусов. Не беспокойтесь о безопасности Xplorer, у него [открытый исходный код](https://github.com/kimlimjustin/xplorer) и вы можете проверить его или даже создать собственную версию!

Чтобы продолжить, просто нажмите `Подробнее`, затем нажмите Выполнить в любом случае.

1. ![Шаг 1](/img/docs/windows-defender-1.png)
2. ![Шаг 2](/img/docs/windows-defender-2.png)

:::note Источники

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
How to install in Arch OS?
</summary>

Run following command:

```bash
sudo pacman -u [имя файла установщика]
```

:::info If you faced the `xplorer exists in filesystem` error, run this command instead:

```bash
sudo pacman -u [имя файла установщика] --overwrite "*"
```

:::

</details> <details>
<summary>
There is no my favourites installer.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer).

</details>
