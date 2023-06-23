# Ejecutar Xplorer desde la terminal

## Comandos

Xplorer CLI:

```bash
xplorer <options> [dir1] [dir2] [dir3]
```

Xplorer abrirá `dir`, `dir2`, `dir3` como pestañas en Xplorer. Si no se pasa ningún directorio(dir) en el comando, Xplorer iniciará en la página inicial.

Opciones:

| Comando      | Alias | Descripción                                           |
| ------------ | ----- | ----------------------------------------------------- |
| `--reveal`   | `-r`  | Abre la carpeta que contiene y selecciona el archivo  |
| `--theme`    | `-t`  | Usar tema personalizado (para el desarrollo del tema) |
| `--xtension` | `-x`  | Instalar extensión desde tipo de archivo `xtension`   |

## Subcomandos

### Extensiones

#### Instalar

Instalar extensión desde tipo de archivo `xtension`. Comando:

```bash
xplorer extensions install <packaged xtension path/URL>
```

#### Desinstalar

Desinstalar una extensión instalada. Comando:

```bash
xplorer extensions install <extension identifier>
```

#### Tema

##### Compilar

Paquete y compilar el tema en el archivo `themes.xtension` para distribuir. Comando:

```bash
xplorer extensions theme build
```

##### Instalar

Instalar extensión desde tipo de archivo `xtension`.

```
xplorer extensions theme install
```
