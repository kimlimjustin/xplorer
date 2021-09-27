# 從終端機啟動Xplorer

:::info 此功能尚未被優化 可以使用但可能反應較慢 會在後續版本進行優化 :::

## 指令

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer會以分頁開啟`資料夾`, `資料夾2`, `資料夾3`。 若指令中沒有指定任何資料夾，Xplorer會啟動至首頁

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
2. 點擊`環境變數`按鈕（於「進階」標籤），會彈出一個視窗
3. 在表格中找到`Path`變數後，選取該變數
4. 點選`編輯`按鈕，會彈出編輯環境變數視窗
5. 點選`新增`按鈕
6. 新增`%USERPROFILE%\AppData\Local\Programs\xplorer`

</details>
