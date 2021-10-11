# 從終端機啟動Xplorer

:::info This feature hasn't been optimized yet. 可以使用但可能反應較慢 This will be optimized in the feature release. :::

## 指令

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer會以分頁開啟`資料夾`, `資料夾2`, `資料夾3`。 If there's no directory(dir) passed into the command, Xplorer will start at the Home page.

選項

| 指令          | 代稱   | 說明           |
| ----------- | ---- | ------------ |
| `--help`    | `-h` | 顯示說明         |
| `--version` | `-v` | 顯示版本編號       |
| `--reveal`  | `-r` | 打開包含文件夾並選擇文件 |

<details>
<summary>
於Windows系統中使用時出現<code>xplorer: command not found</code>錯誤
</summary>

首先，您需要將指令新增至環境變數。

1. 在Windows系統中開啟`系統內容`
2. Click the `Environment Variables` button, it will pop up a window.
3. On the table, search for the `Path` variable and click on it.
4. Click the `Edit` button, it will pop up a window.
5. Click the `New` button.
6. Add `%USERPROFILE%\AppData\Local\Programs\xplorer`.

</details>
