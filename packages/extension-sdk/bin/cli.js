#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const commands = {
  create: {
    description: 'Create a new extension',
    usage: 'create <name> --template=<template>',
    action: createExtension
  },
  build: {
    description: 'Build the extension',
    usage: 'build [options]',
    action: buildExtension
  },
  package: {
    description: 'Package the extension for distribution',
    usage: 'package [options]',
    action: packageExtension
  },
  install: {
    description: 'Install extension locally for testing',
    usage: 'install [--dev]',
    action: installExtension
  },
  help: {
    description: 'Show help',
    usage: 'help [command]',
    action: showHelp
  }
};

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp(args[1]);
    return;
  }

  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "xplorer-sdk help" to see available commands');
    process.exit(1);
  }

  try {
    commands[command].action(args.slice(1));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function createExtension(args) {
  const name = args[0];
  if (!name) {
    console.error('Extension name is required');
    console.error('Usage: xplorer-sdk create <name> --template=<template>');
    process.exit(1);
  }

  const templateArg = args.find(arg => arg.startsWith('--template='));
  const template = templateArg ? templateArg.split('=')[1] : 'basic';

  console.log(`Creating extension "${name}" with template "${template}"...`);

  const extensionDir = path.join(process.cwd(), name);
  
  if (fs.existsSync(extensionDir)) {
    throw new Error(`Directory "${name}" already exists`);
  }

  // Create extension directory structure
  fs.mkdirSync(extensionDir);
  fs.mkdirSync(path.join(extensionDir, 'src'));
  fs.mkdirSync(path.join(extensionDir, 'assets'));
  
  // Create package.json
  const packageJson = {
    name: name,
    version: '1.0.0',
    description: `A Xplorer extension`,
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      package: 'xplorer-sdk package'
    },
    devDependencies: {
      '@xplorer/extension-sdk': 'latest',
      'typescript': '^5.0.0'
    },
    xplorer: {
      id: name,
      displayName: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      category: template,
      version: '1.0.0',
      author: 'Your Name',
      description: `A ${template} extension for Xplorer`
    }
  };

  fs.writeFileSync(
    path.join(extensionDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020', 'DOM'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };

  fs.writeFileSync(
    path.join(extensionDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Create template files
  createTemplateFiles(extensionDir, name, template);

  console.log(`✅ Extension "${name}" created successfully!`);
  console.log('');
  console.log('Next steps:');
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm run build');
  console.log('');
}

function createTemplateFiles(extensionDir, name, template) {
  const srcDir = path.join(extensionDir, 'src');
  
  if (template === 'theme') {
    // Create theme extension template
    const themeTemplate = `import { ThemeExtension } from '@xplorer/extension-sdk';

export class ${toPascalCase(name)} extends ThemeExtension {
  constructor() {
    super({
      id: '${name}',
      name: '${name.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}',
      version: '1.0.0',
      author: 'Your Name',
      description: 'A custom theme for Xplorer'
    });
  }

  getTheme() {
    return {
      name: '${name.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}',
      type: 'dark' as const,
      colors: {
        primary: '#007acc',
        secondary: '#6c757d',
        accent: '#17a2b8',
        
        background: '#1e1e1e',
        surface: '#252526',
        overlay: '#37373d',
        
        text: '#cccccc',
        textSecondary: '#969696',
        textMuted: '#6a6a6a',
        
        border: '#454545',
        hover: '#2c2c2c',
        selected: '#094771',
        focus: '#007acc',
        
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
      },
      fonts: {
        main: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        mono: 'JetBrains Mono, Consolas, "Courier New", monospace',
        ui: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }
    };
  }
}`;

    fs.writeFileSync(path.join(srcDir, 'index.ts'), themeTemplate);
  } else {
    // Create basic extension template
    const basicTemplate = `import { Extension } from '@xplorer/extension-sdk';

export class ${toPascalCase(name)} extends Extension {
  constructor() {
    super({
      id: '${name}',
      name: '${name.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}',
      version: '1.0.0',
      author: 'Your Name',
      category: 'tool',
      description: 'A Xplorer extension'
    });
  }

  async activate(context) {
    this.log('Extension activated!');
    
    // Register commands, UI elements, etc.
    this.registerCommand('hello', () => {
      this.showMessage('Hello from ${name}!');
    });
  }

  async deactivate() {
    this.log('Extension deactivated!');
  }
}`;

    fs.writeFileSync(path.join(srcDir, 'index.ts'), basicTemplate);
  }

  // Create README
  const readme = `# ${name.replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}

A Xplorer extension.

## Development

\`\`\`bash
npm install
npm run build
\`\`\`

## Installation

\`\`\`bash
npm run package
\`\`\`

Then install the generated \`.zip\` file in Xplorer.
`;

  fs.writeFileSync(path.join(extensionDir, 'README.md'), readme);
}

function toPascalCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
           .replace(/^[a-z]/, (g) => g.toUpperCase());
}

function buildExtension(args) {
  console.log('Building extension...');
  try {
    execSync('tsc', { stdio: 'inherit' });
    console.log('✅ Extension built successfully!');
  } catch (error) {
    console.error('❌ Build failed');
    throw error;
  }
}

function packageExtension(args) {
  console.log('Packaging extension...');
  
  if (!fs.existsSync('dist')) {
    console.log('Building extension first...');
    buildExtension([]);
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const extensionName = packageJson.xplorer?.id || packageJson.name;
  const version = packageJson.version;
  
  const archiver = require('archiver');
  const output = fs.createWriteStream(`${extensionName}-${version}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✅ Extension packaged as ${extensionName}-${version}.zip`);
    console.log(`📦 ${archive.pointer()} total bytes`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  
  // Add files to archive
  archive.file('package.json', { name: 'package.json' });
  archive.directory('dist/', 'dist/');
  archive.directory('assets/', 'assets/');
  if (fs.existsSync('README.md')) {
    archive.file('README.md', { name: 'README.md' });
  }

  archive.finalize();
}

function installExtension(args) {
  const isDev = args.includes('--dev');
  console.log(`Installing extension ${isDev ? 'in development mode' : 'locally'}...`);
  
  if (!isDev && !fs.existsSync('dist')) {
    buildExtension([]);
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const extensionId = packageJson.xplorer?.id || packageJson.name;

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error('Unable to resolve user home directory for installation');
  }

  let baseDir;
  if (process.platform === 'win32') {
    baseDir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'xplorer');
  } else if (process.platform === 'darwin') {
    baseDir = path.join(home, 'Library', 'Application Support', 'xplorer');
  } else {
    baseDir = path.join(home, '.local', 'share', 'xplorer');
  }

  const extensionTarget = path.join(baseDir, 'extensions', extensionId);
  fs.mkdirSync(extensionTarget, { recursive: true });

  if (fs.existsSync(path.join(extensionTarget, 'dist'))) {
    fs.rmSync(path.join(extensionTarget, 'dist'), { recursive: true, force: true });
  }

  const copyDir = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  };

  fs.copyFileSync('package.json', path.join(extensionTarget, 'package.json'));
  if (fs.existsSync('README.md')) {
    fs.copyFileSync('README.md', path.join(extensionTarget, 'README.md'));
  }
  if (fs.existsSync('assets')) {
    copyDir('assets', path.join(extensionTarget, 'assets'));
  }
  copyDir('dist', path.join(extensionTarget, 'dist'));

  console.log(`Installed extension to: ${extensionTarget}`);
  if (isDev) {
    console.log('Re-run this command after rebuilding to sync changes.');
  }
}

function showHelp(commandName) {
  if (commandName && commands[commandName]) {
    const cmd = commands[commandName];
    console.log(`xplorer-sdk ${commandName}`);
    console.log(`Usage: xplorer-sdk ${cmd.usage}`);
    console.log(`Description: ${cmd.description}`);
    return;
  }

  console.log('Xplorer Extension SDK');
  console.log('');
  console.log('Usage: xplorer-sdk <command> [options]');
  console.log('');
  console.log('Commands:');
  
  Object.entries(commands).forEach(([name, cmd]) => {
    console.log(`  ${name.padEnd(12)} ${cmd.description}`);
  });
  
  console.log('');
  console.log('Examples:');
  console.log('  xplorer-sdk create my-theme --template=theme');
  console.log('  xplorer-sdk build');
  console.log('  xplorer-sdk package');
  console.log('');
  console.log('For more information, visit: https://github.com/xplorer/extension-sdk');
}

if (require.main === module) {
  main();
}

module.exports = { main };
