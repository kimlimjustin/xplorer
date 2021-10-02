# Inicie o Xplorer no Terminal

:::info Esta funcionalidade não foi otimizada ainda. Funciona mas pode estar lagando. Será otimizado na versão de lançamento. :::

## Comandos

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

O Xplorer abrirá o `dir`, `dir2`, `dir3` como guias no Xplorer. Se não houver nenhum diretório passado para o comando, o Xplorer começará na Página inicial.

Opções:

| Comando     | Alias | Descrição                          |
| ----------- | ----- | ---------------------------------- |
| `--help`    | `-h`  | Mostrar ajuda                      |
| `--version` | `-v`  | Mostrar número da versão           |
| `--reveal`  | `-r`  | Abra a pasta e selecione o arquivo |

<details>
<summary>
<code>xplorer: comando não encontrado</code> erro no Windows
</summary>

Em primeiro lugar, você tem que registrar o comando no caminho do sistema.

1. Abra as `Propriedades do Sistema` no Windows.
2. Clique no botão `Variáveis de ambiente`, ele irá exibir uma janela.
3. Na tabela, pesquise pela variável `Path` e clique nela.
4. Clique no botão `Editar`, irá exibir uma janela.
5. Clique no botão `Novo`
6. Adicione `%USERPROFILE%\AppData\Local\Programs\xplorer`

</details>
