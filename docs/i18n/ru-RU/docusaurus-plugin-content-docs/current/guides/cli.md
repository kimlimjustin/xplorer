# Запуск Xplorer из терминала

::info Эта функция ещё не оптимизирована. Она может работать нестабильно. В будущих версиях мы это исправим. :::

## Команды

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer откроет `dir`, `dir2`, `dir3` в качестве вкладок. Если в команде нет директории, Xplorer откроется на домашней странице.

Параметры:

| Команда     | Сокращение | Описание                                  |
| ----------- | ---------- | ----------------------------------------- |
| `--help`    | `-h`       | Справка                                   |
| `--version` | `-v`       | Показать номер версии                     |
| `--reveal`  | `-r`       | Открыть папку с содержимым и выбрать файл |

<details>
<summary>
<code>xplorer: command not found</code> ошибка в Windows
</summary>

Для начала вы должны зарегистрировать команду в системный путь.

1. Open the `System Properties` on Windows.
2. Click the `Environment Variables` button, it will popup a window.
3. On the table, search for `Path` variable and click on it.
4. Click `Edit` button, it will popup a window.
5. Click `New` button
6. Add `%USERPROFILE%\AppData\Local\Programs\xplorer`

</details>
