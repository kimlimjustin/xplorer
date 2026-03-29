#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .name('create-xplorer-extension')
  .description('Create a new Xplorer extension')
  .version('1.0.0');

program
  .argument('[extension-name]', 'extension name')
  .option('-t, --template <template>', 'template to use', 'basic')
  .option('--skip-install', 'skip npm install')
  .action(async (extensionName, options) => {
    console.log(chalk.blue.bold('🚀 Create Xplorer Extension'));
    console.log();

    let name = extensionName;
    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'extensionName',
          message: 'Extension name:',
          validate: (input) => {
            if (!input.trim()) return 'Extension name is required';
            if (!/^[a-z0-9-]+$/.test(input.trim())) {
              return 'Extension name must contain only lowercase letters, numbers, and dashes';
            }
            return true;
          },
        },
      ]);
      name = answers.extensionName;
    }

    // Additional prompts for extension details
    const extensionDetails = await inquirer.prompt([
      {
        type: 'input',
        name: 'displayName',
        message: 'Display name:',
        default: name
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: `A Xplorer extension for ${name}`,
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
        default: 'Your Name',
      },
      {
        type: 'list',
        name: 'template',
        message: 'Extension template:',
        choices: [
          { name: 'Basic Extension - Simple file operations', value: 'basic' },
          { name: 'UI Extension - Custom panels and components', value: 'ui' },
          { name: 'File Processor - Process and transform files', value: 'processor' },
          { name: 'Theme Extension - Custom themes and styling', value: 'theme' },
        ],
        default: options.template,
      },
      {
        type: 'confirm',
        name: 'installDeps',
        message: 'Install dependencies?',
        default: !options.skipInstall,
      },
    ]);

    const targetDir = path.join(process.cwd(), name);

    // Check if directory already exists
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
        console.log(chalk.yellow('🚫 Extension creation cancelled'));
        process.exit(0);
      }

      await fs.remove(targetDir);
    }

    const spinner = ora('Creating extension...').start();

    try {
      // Create extension from template
      await createExtensionFromTemplate(extensionDetails.template, targetDir, {
        name,
        displayName: extensionDetails.displayName,
        description: extensionDetails.description,
        author: extensionDetails.author,
      });

      spinner.succeed('Extension created successfully!');

      if (extensionDetails.installDeps) {
        const installSpinner = ora('Installing dependencies...').start();
        const { execSync } = await import('child_process');

        try {
          process.chdir(targetDir);
          execSync('npm install', { stdio: 'pipe' });
          installSpinner.succeed('Dependencies installed!');
        } catch (error) {
          installSpinner.fail('Failed to install dependencies');
          console.log(chalk.yellow('You can install them manually with: npm install'));
        }
      }

      console.log();
      console.log(chalk.green.bold('✨ Extension created successfully!'));
      console.log();
      console.log(chalk.cyan('Next steps:'));
      console.log(`  cd ${name}`);
      if (!extensionDetails.installDeps) {
        console.log('  npm install');
      }
      console.log('  npm run dev');
      console.log();
      console.log(chalk.gray('For more information, visit: https://docs.xplorer.com/extensions'));
    } catch (error) {
      spinner.fail('Failed to create extension');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

async function createExtensionFromTemplate(template, targetDir, variables) {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templateDir = path.join(templatesDir, template);

  if (!(await fs.pathExists(templateDir))) {
    throw new Error(`Template '${template}' not found`);
  }

  // Copy template files
  await fs.copy(templateDir, targetDir);

  // Process template files
  await processTemplateFiles(targetDir, variables);
}

async function processTemplateFiles(dir, variables) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);

    if (file.isDirectory()) {
      await processTemplateFiles(filePath, variables);
    } else if (file.name.endsWith('.template')) {
      // Process template file
      const content = await fs.readFile(filePath, 'utf-8');
      const processedContent = processTemplate(content, variables);

      // Write processed content to new file (remove .template extension)
      const newFilePath = filePath.replace('.template', '');
      await fs.writeFile(newFilePath, processedContent);
      await fs.remove(filePath);
    }
  }
}

function processTemplate(content, variables) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

program.parse();
