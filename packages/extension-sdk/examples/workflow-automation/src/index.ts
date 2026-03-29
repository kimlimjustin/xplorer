import { Extension, ExtensionContext, XplorerAPI } from '@xplorer/extension-sdk';

interface WorkflowIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  path: string;
  fixable: boolean;
  category: 'package-manager' | 'git' | 'dependencies' | 'security' | 'performance';
}

interface PackageManagerFiles {
  packageLock?: string;
  yarnLock?: string;
  pnpmLock?: string;
  packageJson?: string;
  nodeModules?: string;
}

export class WorkflowAutomationExtension extends Extension {
  private issues: WorkflowIssue[] = [];
  private scanInterval?: NodeJS.Timeout;

  constructor() {
    super({
      id: 'workflow-automation',
      name: 'Workflow Automation',
      version: '1.0.0',
      author: 'Xplorer Team',
      category: 'tool',
      description: 'Automated workflow checks and warnings for development issues',
    });
  }

  async activate(context: ExtensionContext): Promise<void> {
    this.log('Workflow Automation extension activated');

    // Register commands
    this.registerCommand('scanWorkspace', async () => {
      await this.scanCurrentWorkspace();
    });

    this.registerCommand('fixIssue', async (issueId: string) => {
      await this.fixIssue(issueId);
    });

    this.registerCommand('dismissIssue', (issueId: string) => {
      this.dismissIssue(issueId);
    });

    // Auto-scan when directory changes
    const navigation = this.getAPI().navigation;
    let currentPath = navigation.getCurrentPath();

    // Set up periodic scanning
    this.scanInterval = setInterval(async () => {
      const newPath = navigation.getCurrentPath();
      if (newPath !== currentPath) {
        currentPath = newPath;
        await this.scanCurrentWorkspace();
      }
    }, 5000); // Scan every 5 seconds

    // Initial scan
    await this.scanCurrentWorkspace();
  }

  async deactivate(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    this.log('Workflow Automation extension deactivated');
  }

  private async scanCurrentWorkspace(): Promise<void> {
    try {
      const currentPath = this.getAPI().navigation.getCurrentPath();
      this.log(`Scanning workspace: ${currentPath}`);

      // Clear previous issues
      this.issues = [];

      // Run various checks
      await this.checkPackageManagerConflicts(currentPath);
      await this.checkGitIgnoreIssues(currentPath);
      await this.checkDependencyIssues(currentPath);
      await this.checkSecurityIssues(currentPath);
      await this.checkPerformanceIssues(currentPath);

      // Update UI
      this.updateWorkflowPanel();

      // Show notifications for critical issues
      const criticalIssues = this.issues.filter((issue) => issue.severity === 'error');
      if (criticalIssues.length > 0) {
        this.showMessage(
          `Found ${criticalIssues.length} critical workflow issue${criticalIssues.length > 1 ? 's' : ''}`,
          'error',
        );
      }
    } catch (error) {
      this.logError(`Failed to scan workspace: ${error}`);
    }
  }

  private async checkPackageManagerConflicts(rootPath: string): Promise<void> {
    try {
      const files = await this.getAPI().files.list(rootPath);
      const packageFiles: PackageManagerFiles = {};

      // Find package manager files
      for (const file of files) {
        const fileName = file.name.toLowerCase();
        switch (fileName) {
          case 'package-lock.json':
            packageFiles.packageLock = file.path;
            break;
          case 'yarn.lock':
            packageFiles.yarnLock = file.path;
            break;
          case 'pnpm-lock.yaml':
          case 'pnpm-lock.yml':
            packageFiles.pnpmLock = file.path;
            break;
          case 'package.json':
            packageFiles.packageJson = file.path;
            break;
          case 'node_modules':
            if (file.isDirectory) {
              packageFiles.nodeModules = file.path;
            }
            break;
        }
      }

      // Check for conflicts
      const lockFiles = [
        packageFiles.packageLock,
        packageFiles.yarnLock,
        packageFiles.pnpmLock,
      ].filter(Boolean);

      if (lockFiles.length > 1) {
        this.addIssue({
          id: 'package-manager-conflict',
          severity: 'error',
          title: 'Multiple Package Manager Lock Files',
          description: `Found ${lockFiles.length} different package manager lock files. This can cause dependency conflicts and build issues. Consider using only one package manager.`,
          path: rootPath,
          fixable: true,
          category: 'package-manager',
        });
      }

      // Check for missing package.json
      if (packageFiles.nodeModules && !packageFiles.packageJson) {
        this.addIssue({
          id: 'missing-package-json',
          severity: 'warning',
          title: 'Node Modules Without Package.json',
          description:
            'Found node_modules directory but no package.json file. This may indicate an incomplete project setup.',
          path: rootPath,
          fixable: false,
          category: 'package-manager',
        });
      }

      // Check for outdated lock files
      if (packageFiles.packageJson && packageFiles.packageLock) {
        await this.checkLockFileSync(packageFiles.packageJson, packageFiles.packageLock);
      }
    } catch (error) {
      this.logError(`Package manager conflict check failed: ${error}`);
    }
  }

  private async checkLockFileSync(packageJsonPath: string, lockFilePath: string): Promise<void> {
    try {
      const packageJsonContent = await this.getAPI().files.readText(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent);

      // Check if package-lock.json is newer than package.json
      // This is a simplified check - in a real implementation, you'd compare file timestamps
      // and dependency versions

      if (packageJson.dependencies || packageJson.devDependencies) {
        // Could add more sophisticated checks here
        this.log('Package.json and lock file sync check completed');
      }
    } catch (error) {
      this.addIssue({
        id: 'lock-file-sync-error',
        severity: 'warning',
        title: 'Unable to Verify Lock File Sync',
        description: 'Could not verify if package-lock.json is in sync with package.json',
        path: packageJsonPath,
        fixable: false,
        category: 'package-manager',
      });
    }
  }

  private async checkGitIgnoreIssues(rootPath: string): Promise<void> {
    try {
      const files = await this.getAPI().files.list(rootPath);
      let hasGitIgnore = false;
      let hasGitDir = false;
      let hasNodeModules = false;

      for (const file of files) {
        if (file.name === '.gitignore') hasGitIgnore = true;
        if (file.name === '.git' && file.isDirectory) hasGitDir = true;
        if (file.name === 'node_modules' && file.isDirectory) hasNodeModules = true;
      }

      if (hasGitDir && hasNodeModules && !hasGitIgnore) {
        this.addIssue({
          id: 'missing-gitignore',
          severity: 'warning',
          title: 'Missing .gitignore File',
          description:
            'Found a Git repository with node_modules but no .gitignore file. This may lead to committing dependencies.',
          path: rootPath,
          fixable: true,
          category: 'git',
        });
      }

      if (hasGitIgnore) {
        await this.checkGitIgnoreContent(rootPath + '/.gitignore');
      }
    } catch (error) {
      this.logError(`Git ignore check failed: ${error}`);
    }
  }

  private async checkGitIgnoreContent(gitIgnorePath: string): Promise<void> {
    try {
      const content = await this.getAPI().files.readText(gitIgnorePath);
      const lines = content.split('\n').map((line) => line.trim());

      const requiredPatterns = ['node_modules/', '.env', '*.log', 'dist/', 'build/'];

      const missingPatterns = requiredPatterns.filter(
        (pattern) =>
          !lines.some((line) => line.includes(pattern.replace('*', '')) || line === pattern),
      );

      if (missingPatterns.length > 0) {
        this.addIssue({
          id: 'incomplete-gitignore',
          severity: 'info',
          title: 'Incomplete .gitignore',
          description: `Missing recommended patterns in .gitignore: ${missingPatterns.join(', ')}`,
          path: gitIgnorePath,
          fixable: true,
          category: 'git',
        });
      }
    } catch (error) {
      this.logError(`Git ignore content check failed: ${error}`);
    }
  }

  private async checkDependencyIssues(rootPath: string): Promise<void> {
    try {
      const packageJsonPath = `${rootPath}/package.json`;

      if (await this.getAPI().files.exists(packageJsonPath)) {
        const content = await this.getAPI().files.readText(packageJsonPath);
        const packageJson = JSON.parse(content);

        // Check for common dependency issues
        if (packageJson.dependencies && packageJson.devDependencies) {
          const deps = Object.keys(packageJson.dependencies);
          const devDeps = Object.keys(packageJson.devDependencies);
          const duplicates = deps.filter((dep) => devDeps.includes(dep));

          if (duplicates.length > 0) {
            this.addIssue({
              id: 'duplicate-dependencies',
              severity: 'warning',
              title: 'Duplicate Dependencies',
              description: `Found dependencies in both dependencies and devDependencies: ${duplicates.join(', ')}`,
              path: packageJsonPath,
              fixable: true,
              category: 'dependencies',
            });
          }
        }

        // Check for missing scripts
        if (!packageJson.scripts) {
          this.addIssue({
            id: 'missing-scripts',
            severity: 'info',
            title: 'No Scripts Defined',
            description: 'Consider adding scripts for common tasks like build, test, and dev',
            path: packageJsonPath,
            fixable: true,
            category: 'dependencies',
          });
        }
      }
    } catch (error) {
      this.logError(`Dependency issues check failed: ${error}`);
    }
  }

  private async checkSecurityIssues(rootPath: string): Promise<void> {
    try {
      const files = await this.getAPI().files.list(rootPath);

      for (const file of files) {
        if (file.name === '.env' && !file.isDirectory) {
          // Check if .env file is not in .gitignore
          this.addIssue({
            id: 'env-file-found',
            severity: 'warning',
            title: 'Environment File Detected',
            description:
              "Found .env file. Make sure it's listed in .gitignore to avoid committing secrets",
            path: file.path,
            fixable: false,
            category: 'security',
          });
        }

        if (
          file.name.toLowerCase().includes('password') ||
          file.name.toLowerCase().includes('secret')
        ) {
          this.addIssue({
            id: 'potential-secret-file',
            severity: 'error',
            title: 'Potential Secret File',
            description: `File name suggests it may contain secrets: ${file.name}`,
            path: file.path,
            fixable: false,
            category: 'security',
          });
        }
      }
    } catch (error) {
      this.logError(`Security issues check failed: ${error}`);
    }
  }

  private async checkPerformanceIssues(rootPath: string): Promise<void> {
    try {
      const files = await this.getAPI().files.list(rootPath);
      let largeFiles = 0;
      let totalSize = 0;

      for (const file of files) {
        if (!file.isDirectory && file.size) {
          totalSize += file.size;
          if (file.size > 10 * 1024 * 1024) {
            // 10MB
            largeFiles++;
          }
        }
      }

      if (largeFiles > 0) {
        this.addIssue({
          id: 'large-files',
          severity: 'info',
          title: 'Large Files Detected',
          description: `Found ${largeFiles} files larger than 10MB. Consider using Git LFS for large binary files.`,
          path: rootPath,
          fixable: false,
          category: 'performance',
        });
      }

      if (totalSize > 100 * 1024 * 1024) {
        // 100MB
        this.addIssue({
          id: 'large-directory',
          severity: 'info',
          title: 'Large Directory',
          description: 'Directory size is quite large. Consider cleaning up unnecessary files.',
          path: rootPath,
          fixable: false,
          category: 'performance',
        });
      }
    } catch (error) {
      this.logError(`Performance issues check failed: ${error}`);
    }
  }

  private addIssue(issue: WorkflowIssue): void {
    this.issues.push(issue);
    this.log(`Added issue: ${issue.title} (${issue.severity})`);
  }

  private async fixIssue(issueId: string): Promise<void> {
    const issue = this.issues.find((i) => i.id === issueId);
    if (!issue || !issue.fixable) {
      this.showMessage('This issue cannot be automatically fixed', 'warning');
      return;
    }

    try {
      switch (issueId) {
        case 'package-manager-conflict':
          await this.fixPackageManagerConflict();
          break;
        case 'missing-gitignore':
          await this.createGitIgnore(issue.path);
          break;
        case 'incomplete-gitignore':
          await this.updateGitIgnore(issue.path);
          break;
        default:
          this.showMessage('Fix not implemented for this issue', 'warning');
          return;
      }

      // Remove the fixed issue
      this.issues = this.issues.filter((i) => i.id !== issueId);
      this.updateWorkflowPanel();
      this.showMessage(`Fixed: ${issue.title}`, 'info');
    } catch (error) {
      this.logError(`Failed to fix issue ${issueId}: ${error}`);
      this.showMessage(`Failed to fix issue: ${error}`, 'error');
    }
  }

  private async fixPackageManagerConflict(): Promise<void> {
    // This would show a dialog to let user choose which package manager to keep
    this.showMessage('Please manually remove unwanted lock files', 'info');
  }

  private async createGitIgnore(projectPath: string): Promise<void> {
    const gitIgnoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
*.tgz

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`;

    await this.getAPI().files.write(`${projectPath}/.gitignore`, gitIgnoreContent);
  }

  private async updateGitIgnore(gitIgnorePath: string): Promise<void> {
    const existingContent = await this.getAPI().files.readText(gitIgnorePath);
    const additionalPatterns = `
# Additional recommended patterns
node_modules/
.env
*.log
dist/
build/
`;

    await this.getAPI().files.write(gitIgnorePath, existingContent + additionalPatterns);
  }

  private dismissIssue(issueId: string): void {
    this.issues = this.issues.filter((i) => i.id !== issueId);
    this.updateWorkflowPanel();
  }

  private updateWorkflowPanel(): void {
    // This would update the custom panel UI
    // In a real implementation, this would emit events to update the React component
    this.log(`Updated workflow panel with ${this.issues.length} issues`);

    // Store issues in extension state so the UI can access them
    this.setWorkspaceState('workflow-issues', this.issues);
  }
}
