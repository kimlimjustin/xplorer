# File Operations

## Copy file

You can copy files by right clicking it and click `Copy` option or select the file then press `Ctrl + C` as shortcut and paste it by clicking `Paste` option or press `Ctrl + V` on the destination folder.

![Copy file](/img/docs/copy.png)

## Cut file

You can cut files by right clicking it and click `Cut` option or select the file then press `Ctrl + X` as shortcut and paste it by clicking `Paste` option or press `Ctrl + V` on the destination folder.

![Copy file](/img/docs/cut.png)

## How does it work?

### Copy file

On windows and macOS, Xplorer will copy the file paths into local clipboard, because of this, you can copy file from Xplorer and paste it into an folder in another system. However, on Linux, we create a string of Xplorer commands and copy it into user clipboard, Xplorer will read user's clipboard when pasting file (because we haven't found any idea to implement it, fell free to [open a PR](/community/Contributing/#pull-requests) if you can help us). The string of Xplorer command look like this:

```
Xplorer command - COPY
~/xplorer
~/test
```

### Cut file

THis is done by creating a string of Xplorer command and copy it into user clipboard to be used when pasting file (not integrated with platform because we haven't found any idea, fell free to [open a PR](/community/Contributing/#pull-requests) if you can help us.). The string og Xplorer command look like this:

```
Xplorer command - CUT
E://xplorer
E://test
```
