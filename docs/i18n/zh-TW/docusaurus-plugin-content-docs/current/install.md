---
sidebar_position: 2
---

# 安裝

## 安裝程式

您可[點此](https://github.com/kimlimjustin/xplorer/releases)前往下載頁面

## 常見問題

<details>
<summary>
Windows防火牆問題？
</summary>

這其實不是錯誤，這是微軟設計來保護那些不是很精通科技的人 (換句話講：可能你的朋友) 遠離電腦病毒之功能。 在這情況下，您不需要擔心安全性，因為它是[開源專案](https://github.com/kimlimjustin/xplorer) ，您可以檢查程式碼，甚至編寫屬於您自己的版本！

處理方法：您可以點選 `More Info` 按鈕後點選「仍要執行」

1. ![第一步](/img/docs/windows-defender-1.png)
2. ![第二步](/img/docs/windows-defender-2.png)

:::note 參考自：

Adopted from [Stack Overflow](https://stackoverflow.com/questions/65488839/how-can-i-avoid-windows-protected-your-pc-problem-when-my-friends-try-to-use-m).

:::

</details> <details>
<summary>
How to install in Arch OS?
</summary>

Run following command:

```bash
sudo pacman -u [安裝檔案名稱]
```

:::info If you faced the `xplorer exists in filesystem` error, run this command instead:

```bash
sudo pacman -u [安裝檔案名稱] --overwrite "*"
```

:::

</details> <details>
<summary>
There is no my favourites installer.
</summary>

Please address an issue [here](https://github.com/kimlimjustin/xplorer).

</details>
