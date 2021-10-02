# Color Theme

## Prerequiste

For both developing and using a theme on Xplorer, you should have Xplorer's CLI Installed.

<details>
<summary>
Install Xplorer CLI on Windows
</summary>

Firstly, you have to register the command into the system path.

1. Open the `System Properties` on Windows.
2. Click the `Environment Variables` button, it will pop up a window.
3. On the table, search for `Path` variable and click on it.
4. Click the `Edit` button, it will pop up a window.
5. Click the `New` button
6. Add `%USERPROFILE%\AppData\Local\Programs\xplorer`

</details>

## Writing Theme

Xplorer use [`yeoman`](https://yeoman.io/) as a generator to generate a color theme template, the generator should generates a `package.json` and a JavaScript file containing a color scheme template (It's `light` theme's color scheme as default).

### Get Started

To get started, you have to install yeoman globally, you can do this by running the following command:

```bash
npm i -g yo
```

After installing yeoman, you can start generating Xplorer theme by running the following command:

```bash
yo xplorer-theme
```

:::info
`generator-xplorer-theme` is under development, to use it now, you have to clone the Xplorer repository and run `yarn link` inside the `packages/generator-xplorer-theme` directory.
:::

The command will create `package.json` and a JavaScript file containing your color scheme.

### File Structure

The JavaScript file should export a function as `exports.default`, the function should return the object of your theme's color scheme.

:::tip
Within the function, you can add `document.querySelector` to change something you wish to that cannot be edited via the color scheme.
:::

### Development

You can start developing Xplorer theme by running `yarn start` command.

### Production

To flash your color theme into Xplorer, you can simply run `yarn build` command.

## Using Theme

To use a color scheme developed by others, you have to get the code locally, this can be done by cloning their repository, etc.

### Flashing color theme into Xplorer

To flash a color theme into Xplorer, you can simply run `yarn build` in the project root.

## Common Question

<details>
<summary>
Why don't you just develop a marketplace so user can easily share their theme with others?
</summary>

I can't afford to buy a server for developing marketplace xD, but will consider it in the future, if you want to sponsor/offer it, feel free to contact [me](kimlimjustin@gmail.com)

</details>
