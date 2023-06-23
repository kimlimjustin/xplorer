# Lancer Xplorer depuis le terminal

## Commandes

CLI Xplorer :

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer ouvrira le répertoire `dir`, `dir2`, `dir3` comme onglets sur Xplorer. S'il n'y a pas de dossier passé dans la commande, Xplorer démarrera à la page d'accueil.

Options :

| Commande     | Alias | Description                                          |
| ------------ | ----- | ---------------------------------------------------- |
| `--reveal`   | `-r`  | Ouvre le dossier contenant et sélectionne le fichier |
| `--theme`    | `t`   | Use custom theme (for developing theme purpose)      |
| `--xtension` | `x`   | Install extension from `xtension` file type          |

## Subcommands

### Extensions

#### Install

Install an extension from `xtension` file type. Command:

```bash
xplorer extensions install <packaged xtension path/URL>
```

#### Uninstall

Uninstall an installed extension. Command:

```bash
xplorer extensions uninstall <extension identifier>
```

#### Theme

##### Build

Package and build theme into `themes.xtension` file to distribute. Command:

```bash
xplorer extensions theme build
```

##### Install

Install an extension from `xtension` file type.

```
xplorer extensions theme install
```
