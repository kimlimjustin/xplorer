# Launch Xplorer from Terminal

:::info
This feature hasn't been optimized yet. It works but it might be laggy. Will be optimized in the feature release.
:::

## Commands

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer will open `dir`, `dir2`, `dir3` as tabs on Xplorer. If there's no dir passed into the command, Xplorer will start at the Home page.

Options:

| Command     | Alias | Description                                    |
| ----------- | ----- | ---------------------------------------------- |
| `--help`    | `-h`  | Show help                                      |
| `--version` | `-v`  | Show version number                            |
| `--reveal`  | `-r`  | Open the containing folder and select the file |

<details>
<summary>
<code>xplorer: command not found</code> error on Windows
</summary>

Firstly, you have to register the command into the system path.

1. Open the `System Properties` on Windows.
2. Click the `Environment Variables` button, it will pop up a window.
3. On the table, search for the `Path` variable and click on it.
4. Click the `Edit` button, it will pop up a window.
5. Click the `New` button.
6. Add `%USERPROFILE%\AppData\Local\Programs\xplorer`.

</details>
