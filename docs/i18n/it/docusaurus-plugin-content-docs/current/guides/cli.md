# Avviare Xplorer dal terminale

## Comandi

CLI di Xplorer:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer aprirà `dir`, `dir2`, `dir3` come schede su Xplorer. Se non c'è alcuna cartella(dir) passata nel comando, Xplorer inizierà dalla pagina iniziale.

Opzioni:

| Comando      | Alias | Descrizione                                            |
| ------------ | ----- | ------------------------------------------------------ |
| `--reveal`   | `-r`  | Apre la cartella contenente e seleziona il file        |
| `--theme`    | `t`   | Usa tema personalizzato (a scopo di sviluppo dei temi) |
| `--xtension` | `x`   | Installa le estensioni dal tipo di file `xtension`     |

## Sottocomandi

### Estensioni

#### Installazione

Installa un'estensione dal tipo di file `xtension`. Comando:

```bash
xplorer extensions install <packaged xtension path/URL>
```

#### Disinstallazione

Disinstallare un' estensione installata. Comando:

```bash
xplorer extensions uninstall <extension identifier>
```

#### Tema

##### Compilazione

Impacchettare e compilare il tema nel file `themes.xtension` da distribuire. Comando:

```bash
xplorer extensions theme build
```

##### Installazione

Installare un'estensione dal tipo di file `xtension`.

```
xplorer extensions theme install
```
