# Definir como Explorador de Arquivos Padrão (Windows)

:::caution This guide involves modifying the Windows registry, make sure to create a backup beforehand to recover if you got any problem with Xplorer. Please keep in mind that this method may not work for everyone.

> Clique [aqui](https://support.microsoft.com/en-us/topic/how-to-back-up-and-restore-the-registry-in-windows-855140ad-e318-2a13-2829-d428a2ab0692) para a documentação oficial da Microsoft sobre como fazer backup e restaurar o registro

:::

1. Pressione `Win` + `R` e digite `regedit.exe`
2. Click `Yes` on the question `Do you want to allow this app to make changes to your devices`
3. Crie um backup do registro (veja a atenção acima).
4. Navegue para `Computer\HKEY_CURRENT_USER\Software\Classes\Directory`
5. Create a key named `shell` if not existed by right and set the default key-value to `openinxplorer`
6. Crie uma chave chamada `openinxplorer` em `shell`
7. Create a key named `command` under `openinxplorer` and set the default key-value to `"C:\Program Files\Xplorer\Xplorer.exe" "%V"`. (You may have to change `C:\Program Files\Xplorer\` to the location you installed Xplorer)

![Estrutura do Registro](/img/docs/registry.png)

:::info

To create a new subkey, right-click on the parent key and select `New > Key`. ![Regedit cria uma nova subchave](/img/docs/regedit-create-new-key.png)

Para definir a chave padrão, Dê um clique duplo ou clicando com o botão direito e clique em `Modificar` no `Nome` e insira o valor lá. :::
