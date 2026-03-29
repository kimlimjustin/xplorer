import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTemplate } from './templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Extension type metadata ──────────────────────────────────────────────────

interface ExtensionType {
  value: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  permissions: string[];
  keywords: string[];
}

const EXTENSION_TYPES: ExtensionType[] = [
  {
    value: 'panel',
    name: 'Sidebar Panel - Custom panel in the right sidebar',
    description: 'A sidebar panel extension',
    category: 'panel',
    icon: 'layout',
    permissions: ['file:read', 'directory:list', 'ui:panels'],
    keywords: ['panel', 'sidebar', 'ui'],
  },
  {
    value: 'theme',
    name: 'Theme - Custom color theme',
    description: 'A color theme',
    category: 'theme',
    icon: 'palette',
    permissions: ['ui:notifications'],
    keywords: ['theme', 'colors', 'dark'],
  },
  {
    value: 'action',
    name: 'Context Menu Action - Right-click file actions',
    description: 'A context menu action',
    category: 'action',
    icon: 'menu',
    permissions: ['file:read', 'ui:notifications'],
    keywords: ['action', 'context-menu', 'tool'],
  },
  {
    value: 'preview',
    name: 'File Preview - Custom file preview handler',
    description: 'A file preview handler',
    category: 'preview',
    icon: 'eye',
    permissions: ['file:read'],
    keywords: ['preview', 'viewer'],
  },
  {
    value: 'command',
    name: 'Command - Command palette command with optional shortcut',
    description: 'A command palette command',
    category: 'tool',
    icon: 'terminal',
    permissions: ['file:read', 'ui:notifications'],
    keywords: ['command', 'tool'],
  },
  {
    value: 'tab',
    name: 'Tab - Custom tab view with its own URL scheme',
    description: 'A custom tab view',
    category: 'tab',
    icon: 'layout',
    permissions: ['ui:panels'],
    keywords: ['tab', 'view'],
  },
];

// ── CLI ──────────────────────────────────────────────────────────────────────

program
  .name('create-xplorer-extension')
  .description('Scaffold a new Xplorer extension')
  .version('1.0.0');

program
  .argument('[extension-name]', 'extension name')
  .option('-t, --type <type>', 'extension type (panel|theme|action|preview|command|tab)')
  .option('--skip-install', 'skip npm install')
  .action(
    async (
      extensionName: string | undefined,
      options: { type?: string; skipInstall?: boolean },
    ) => {
      console.log(chalk.blue.bold('\n  Create Xplorer Extension\n'));

      // ── Name ──────────────────────────────────────────────────────────────

      let name = extensionName;
      if (!name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'extensionName',
            message: 'Extension name:',
            validate: (input: string) => {
              if (!input.trim()) return 'Extension name is required';
              if (!/^[a-z0-9-]+$/.test(input.trim())) {
                return 'Name must contain only lowercase letters, numbers, and dashes';
              }
              return true;
            },
          },
        ]);
        name = answers.extensionName;
      }

      // ── Details ───────────────────────────────────────────────────────────

      const defaultDisplayName = name!
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const details = await inquirer.prompt([
        {
          type: 'input',
          name: 'displayName',
          message: 'Display name:',
          default: defaultDisplayName,
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: `An Xplorer extension`,
        },
        {
          type: 'input',
          name: 'author',
          message: 'Author:',
          default: 'Your Name',
        },
        {
          type: 'list',
          name: 'type',
          message: 'Extension type:',
          choices: EXTENSION_TYPES.map((t) => ({ name: t.name, value: t.value })),
          default: options.type || 'panel',
          when: () => !options.type,
        },
        {
          type: 'confirm',
          name: 'installDeps',
          message: 'Install dependencies?',
          default: !options.skipInstall,
        },
      ]);

      const extType = options.type || details.type || 'panel';
      const typeInfo = EXTENSION_TYPES.find((t) => t.value === extType) || EXTENSION_TYPES[0];

      const vars = {
        name: name!,
        displayName: details.displayName,
        description: details.description,
        author: details.author,
        type: extType,
        category: typeInfo.category,
        icon: typeInfo.icon,
        permissions: typeInfo.permissions,
        keywords: typeInfo.keywords,
      };

      // ── Check target directory ────────────────────────────────────────────

      const targetDir = path.resolve(process.cwd(), name!);

      if (await fs.pathExists(targetDir)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: `Directory ${name} already exists. Overwrite?`,
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.yellow('\n  Extension creation cancelled.\n'));
          process.exit(0);
        }

        await fs.remove(targetDir);
      }

      // ── Scaffold ──────────────────────────────────────────────────────────

      const spinner = ora('Scaffolding extension...').start();

      try {
        await fs.ensureDir(targetDir);
        await fs.ensureDir(path.join(targetDir, 'src'));
        await fs.ensureDir(path.join(targetDir, 'dist'));

        const template = getTemplate(extType, vars);

        // Write package.json
        await fs.writeFile(
          path.join(targetDir, 'package.json'),
          JSON.stringify(template.packageJson, null, 2) + '\n',
        );

        // Write tsconfig.json
        await fs.writeFile(
          path.join(targetDir, 'tsconfig.json'),
          JSON.stringify(template.tsconfig, null, 2) + '\n',
        );

        // Write src/index.tsx
        await fs.writeFile(path.join(targetDir, 'src', 'index.tsx'), template.source);

        // Write README.md
        await fs.writeFile(path.join(targetDir, 'README.md'), template.readme);

        // Write .gitignore
        await fs.writeFile(
          path.join(targetDir, '.gitignore'),
          ['node_modules/', 'dist/', '*.spx', ''].join('\n'),
        );

        spinner.succeed('Extension scaffolded!');

        // ── Install deps ────────────────────────────────────────────────────

        if (details.installDeps) {
          const installSpinner = ora('Installing dependencies...').start();
          const { execSync } = await import('child_process');

          try {
            execSync('npm install', { cwd: targetDir, stdio: 'pipe' });
            installSpinner.succeed('Dependencies installed!');
          } catch {
            installSpinner.fail('Failed to install dependencies');
            console.log(chalk.yellow('  You can install them manually with: npm install'));
          }
        }

        // ── Summary ─────────────────────────────────────────────────────────

        console.log();
        console.log(chalk.green.bold('  Extension created successfully!'));
        console.log();
        console.log(chalk.cyan('  Next steps:'));
        console.log(`    cd ${name}`);
        if (!details.installDeps) {
          console.log('    npm install');
        }
        console.log('    npm run build');
        console.log('    npm run watch     # for development');
        console.log();
        console.log(chalk.gray('  Then load the extension in Xplorer:'));
        console.log(chalk.gray('    Settings > Extensions > Install from Folder'));
        console.log();
      } catch (error: unknown) {
        spinner.fail('Failed to create extension');
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  ${message}`));
        process.exit(1);
      }
    },
  );

program.parse();
