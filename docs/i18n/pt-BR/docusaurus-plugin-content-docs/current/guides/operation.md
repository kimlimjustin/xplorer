# Operações

## Copiar arquivo

Você pode copiar arquivos clicando com o botão direito do mouse sobre ele e clicar em `Copiar` ou selecionar o arquivo, depois pressione `Ctrl + C` como atalho e cole-o clicando na opção `Colar` ou pressione `Ctrl + V` na pasta de destino.

:::info

No Windows e macOS, o Xplorer irá copiar os caminhos dos arquivos para a área de transferência local, por isso, você pode copiar o arquivo do Xplorer e colá-lo em uma pasta em outro sistema. No entanto, no Linux, criamos uma string nos comandos do Xplorer e a copiamos para a área de transferência do usuário, o Xplorer irá ler a área de transferência do usuário ao colar o arquivo (porque não encontramos nenhuma ideia para implementá-lo, podemos [abrir um PR](/community/Contributing/#pull-requests) se você puder nos ajudar). A string nos comandos do Xplorer se parece dessa forma:

```
Xplorer command - COPY
~/xplorer
~/test
```

:::

## Copiar caminho de localização

Você pode copiar um caminho de localização de arquivo / pasta para a área de transferência clicando com o botão direito e clicando em `Copiar caminho de localização` ou selecione o arquivo e pressione `Alt + Shift + C` como atalho.

## Recortar arquivo

Você pode cortar arquivos clicando com o botão direito e clicando na opção `Recortar` ou selecione o arquivo e pressione ` Ctrl + X ` como atalho e cole-o clicando em ` Colar ` opção ou pressione ` Ctrl + V ` na pasta de destino.

:::info Isso é feito criando uma string nos comandos do Xplorer e copiando-a para a área de transferência do usuário para ser usada quando colar o arquivo (não integrado com a plataforma porque não encontramos nenhuma ideia, fique à vontade para [abrir um PR](/community/Contributing/#pull-requests) se você pode nos ajudar.). A string nos comandos do Xplorer se parece dessa forma:

```
Xplorer command - CUT
E://xplorer
E://test
```

:::

## Apagar arquivos

Você pode apagar arquivos clicando nele com o botão direito e clique na opção `Excluir` ou selecione o arquivo, então pressione `Del` como atalho. O arquivo na lixeira pode ser acessado em `xplorer://Lixeira`.

:::info

-   No Windows, isso é feito ao criar uma pasta `Lixeira` no `C:` unidade e mover o arquivo para ela.
-   No Linux, essa função está totalmente integrada com o system
-   No macOS, isso é feito criando uma pasta `.local/Lixeira` no diretório `homedir` e movendo o arquivo para ele.

Ainda estamos trabalhando no Windows e no macOS para integrar a pasta `Lixeira`, será lançada antes do surgimento da versão estável. sinta-se livre para [abrir um PR](/community/Contributing/#pull-requests) se você puder nos ajudar.

:::

### Excluir permanentemente

:::danger O arquivo excluído permanentemente não pode ser restaurado. Por favor, verifique novamente antes de excluir permanentemente os arquivos.

:::

Você pode excluir um arquivo permanentemente por:

1. Exclua-o na `Lixeira` e clique com o botão direito do mouse e `Excluir` opção
2. Selecione o arquivo e pressione `Shift + Del` como atalho

## Novo

:::caution Tenha cuidado com o novo nome de arquivo/pasta Tratamentos do Xplorer `/` no nome/pasta do arquivo como subdir/subarquivo :::

### Novo arquivo

Você pode criar um novo arquivo clicando com o botão direito do mouse no espaço de trabalho, expanda a opção `Novo` e selecione a opção `Arquivo` ou pressione `Alt + N` como atalho.

### Nova Pasta

Você pode criar uma nova pasta clicando com o botão direito do mouse no espaço de trabalho, expanda a opção `Novo` e selecione a opção `Pasta` ou pressione `Shift+ N` como atalho.

## Abrir arquivo

Você pode abrir um arquivo no aplicativo padrão clicando duas vezes ou selecionando o arquivo e pressionando `Enter` como atalho.

### Abrir no terminal

Esta é uma função integrada pelo Xplorer. Você pode abrir uma pasta no Terminal clicando com o botão direito do mouse sobre ela e clica na opção `Abrir no Terminal` ou selecionar a pasta, então pressione `Alt + T` como atalho.

### Abrir no VSCode

Esta é uma função integrada pelo Xplorer. Você pode abrir uma pasta de arquivo/arquivo no VSCode clicando com o botão direito do mouse nele e clique na opção `Abrir na VSCode` ou selecione o arquivo, pressione `Ctrl + Enter` como atalho. Você não será capaz de fazer isso se não tiver o VSCode instalado.

## Fixar na Barra Lateral

Você pode fixar uma pasta ou arquivo na barra lateral clicando com o botão direito nele e clique em `Fixar para barra lateral` ou selecione o arquivo, pressione `Alt + P` como atalho.

## Pré-visualizar arquivo

Você pode pré-visualizar um arquivo diretamente do Xplorer clicando com o botão direito do mouse sobre ele e clique em `Pré-visualizar` ou selecione o arquivo, em seguida, pressione `Ctrl+O`.

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

Você pode ver as propriedades de um arquivo/pasta clicando com o botão direito nele e clicando em `Propriedades` ou selecione o arquivo e pressione `Ctrl + P` como atalho. Propriedades disponíveis por agora (serão melhoradas na próxima versão):

-   Tamanho
-   Caminho do Arquivo
-   Criado em
-   Acessado em
-   Modificado em
-   Está oculto

## Renomear o arquivo/pasta

Você pode renomear um arquivo/pasta clicando com o botão direito do mouse nele e clique na opção `Renomear` ou selecione o arquivo e pressione `F2` como atalho. Ele irá solicitar um diálogo, digite o novo nome e o arquivo/pasta serão renomeados.
