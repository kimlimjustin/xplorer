# Launch Xplorer from Terminal

## Commands

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer will open `dir`, `dir2`, `dir3` as tabs on Xplorer. If there's no directory(dir) passed into the command, Xplorer will start at the Home page.

Options:

| Command      | Alias | Description                                     |
| ------------ | ----- | ----------------------------------------------- |
| `--reveal`   | `-r`  | Open the containing folder and select the file  |
| `--theme`    | `t`   | Use custom theme (for developing theme purpose) |
| `--xtension` | `x`   | Install extension from `xtension` file type     |

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
