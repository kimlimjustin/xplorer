# Operações

## Copiar arquivo

Você pode copiar arquivos clicando com o botão direito e clicar na opção `Copiar` ou selecionar o arquivo e pressionar `Ctrl + C` no teclado e colá-lo clicando no botão `Colar` opção ou pressione `Ctrl + V` na pasta de destino.

:::info

No Windows e no macOS, o Xplorer irá copiar o caminho dos arquivos para a área de transferência local, por isso, você pode copiar um arquivo do Xplorer e colá-lo em qualquer pasta em outro sistema. No entanto, no Linux, nós criamos uma string nos comandos do Xplorer e a copiamos para a área de transferência do usuário, o Xplorer irá ler a área de transferência do usuário ao colar o arquivo (porque não encontramos nenhuma ideia para implementá-lo, sinta-se à vontade para [abrir um PR](/community/Contributing/#pull-requests) se você puder nos ajudar). A string nos comandos do Xplorer se parece dessa forma:

```
Xplorer command - COPY
~/xplorer
~/test
```

:::

## Copiar caminho de localização

Você pode copiar um caminho de localização de arquivo/pasta para a área de transferência clicando com o botão direito do mouse e clicando em `Copiar caminho de localização` ou selecione o arquivo e pressione `Alt + Shift + C` no teclado.

## Recortar arquivo

Você pode recortar arquivos clicando com o botão direito e clicando na opção `Recortar` ou selecione o arquivo e pressione `Ctrl + X` no teclado, e para colá-lo clicando no botão `Colar` ou pressione ` Ctrl + V ` na pasta de destino.

:::info Isso é feito criando uma string nos comandos do Xplorer e a copia para a área de transferência do usuário para ser usada ao colar o arquivo (não está integrado com a plataforma porque não encontramos nenhuma ideia, sinta-se à vontade para [abrir um PR](/community/Contributing/#pull-requests) se você puder nos ajudar.). A string nos comandos do Xplorer se parece dessa forma:

```
Xplorer command - CUT
E://xplorer
E://test
```

:::

## Apagar arquivos

Você pode apagar arquivos clicando com o botão direito e selecionando a opção `Delete` ou selecionando o arquivo e pressionando `Del` no teclado. O arquivo na lixeira pode ser acessado em `xplorer://Trash`.

:::info

-   No Windows, isto é feito criando uma pasta `Lixeira` em `Disco Local C:` e movendo o arquivo até ela.
-   No Linux, esta função está totalmente integrada com o sistema.
-   No macOS, isso é feito criando uma pasta `.local/Lixeira` no diretório `homedir` e movendo o arquivo para ele.

Nós estamos trabalhando para integrar a `Lixeira` no Windows e macOS, será lançado antes do lançamento da versão estável. Sinta-se livre para [abrir um PR](/community/Contributing/#pull-requests) se você puder nos ajudar.

:::

### Excluir permanentemente

:::danger Um arquivo excluído permanentemente não pode ser restaurado. Por favor, verifique novamente antes de excluir permanentemente os arquivos.

:::

Você pode excluir um arquivo permanentemente das seguintes formas:

1. Exclua-o na `Lixeira`, clique com o botão direito e clique na opção `Excluir Permanentemente`
2. Selecione o arquivo e pressione `Shift + Del` no teclado

## Novo

:::caution Tenha cuidado com o novo nome de arquivo/pasta Tratamentos do Xplorer `/` no nome/pasta do arquivo como subdir/subarquivo :::

### Novo arquivo

Você pode criar um novo arquivo clicando com o botão direito do mouse na área de trabalho, selecione a opção `Novo` e selecione a opção `Arquivo` ou pressione `Alt + N` no teclado.

### Nova Pasta

Você pode criar uma nova pasta clicando com o botão direito do mouse na área de trabalho, selecione a opção `Novo` e selecione a opção `Pasta` ou pressione `Shift + N` no teclado.

## Abrir arquivo

Você pode abrir um arquivo com o aplicativo padrão clicando duas vezes com o mouse ou selecionando o arquivo e pressionando `Enter` no teclado.

### Abrir no terminal

Esta é uma função integrada do Xplorer. Você pode abrir uma pasta no Terminal clicando com o botão direito e clique na opção `Abrir no terminal` ou selecionando a pasta e pressione `Alt + T` no teclado.

### Abrir no VSCode

Esta é uma função integrada do Xplorer. Você pode abrir um arquivo/pasta no VSCode clicando com o botão direito e clicando na opção `Abrir no VSCode` ou selecionando o arquivo e pressione `Ctrl + Enter` no teclado. Você não será capaz de fazer isso se não tiver o VSCode instalado.

## Fixar na Barra Lateral

Você pode fixar um arquivo/pasta na barra lateral clicando com o botão direito e clicando em `Fixar na barra lateral` ou selecionando o arquivo e pressionando `Alt + P` no teclado.

## Pré-visualizar arquivo

Você pode pré-visualizar um arquivo diretamente do Xplorer clicando com o botão direito do mouse sobre ele e clique em `Pré-visualizar` ou selecione o arquivo, em seguida, pressione `Ctrl + O` no teclado.

![Pré-visualizar demonstração](/img/docs/preview.png)

:::info

<details>
<summary>
Arquivos disponíveis para pré-visualização agora:
</summary>

```json
[
    ".pdf",
    ".html",
    ".docx",
    ".htm",
    ".xlsx",
    ".xls",
    ".xlsb",
    "xls",
    ".ods",
    ".fods",
    ".csv",
    ".txt",
    ".py",
    ".js",
    ".bat",
    ".css",
    ".c++",
    ".cpp",
    ".cc",
    ".c",
    ".diff",
    ".patch",
    ".go",
    ".java",
    ".json",
    ".php",
    ".ts",
    ".tsx",
    ".jsx",
    ".jpg",
    ".png",
    ".gif",
    ".bmp",
    ".jpeg",
    ".jpe",
    ".jif",
    ".jfif",
    ".jfi",
    ".webp",
    ".tiff",
    ".tif",
    ".ico",
    ".svg",
    ".webp",
    ".mp4",
    ".webm",
    ".mpg",
    ".mp2",
    ".mpeg",
    ".mpe",
    ".mpv",
    ".ocg",
    ".m4p",
    ".m4v",
    ".avi",
    ".wmv",
    ".mov",
    ".qt",
    ".flv",
    ".swf",
    ".md"
]
```

</details>

:::

## Propriedades

Você pode ver as propriedades de um arquivo ou pasta clicando com o botão direito e selecionando a opção `Propriedades` ou selecionando o arquivo e pressionando `Ctrl + P` no teclado. Propriedades disponíveis por agora (serão melhoradas na próxima versão):

-   Tamanho
-   Caminho do Arquivo
-   Criado em
-   Acessado em
-   Modificado em
-   Está oculto

## Renomear o arquivo/pasta

Você pode renomear um arquivo/pasta clicando com o botão direito do mouse nele e clique na opção `Renomear` ou selecione o arquivo e pressione `F2` no teclado. Ele irá solicitar um diálogo, digite o novo nome e o arquivo/pasta serão renomeados.
