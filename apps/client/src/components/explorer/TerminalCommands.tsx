import { TauriAPI } from '@/lib/tauri-api';
import { PATH_SEPARATOR, isWindows, joinPath } from '@/lib/constants';
import { formatFileSize } from '@/lib/utils';

const customCommands = new Set([
  'help',
  'clear',
  'ls',
  'dir',
  'pwd',
  'cd',
  'open',
  'mkdir',
  'explorer',
  'tree',
  'find',
  'size',
]);

export const TerminalCommands = {
  async execute(
    command: string,
    terminalCwd: string,
    setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
    setTerminalCwd: React.Dispatch<React.SetStateAction<string>>,
    setCurrentPath: (path: string) => void,
    refetch: () => void,
  ) {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      setTerminalHistory((prev) => [...prev, '']);
      return;
    }

    const prompt = `${terminalCwd.split(/[\\/]/).pop() || terminalCwd}> ${command}`;
    setTerminalHistory((prev) => [...prev, prompt]);

    const cmd = trimmedCommand.toLowerCase().split(' ')[0];
    const args = trimmedCommand.split(' ').slice(1);

    try {
      // Check if it's a custom file explorer command
      if (customCommands.has(cmd)) {
        await executeCustomCommand(
          cmd,
          args,
          terminalCwd,
          setTerminalHistory,
          setTerminalCwd,
          setCurrentPath,
          refetch,
        );
      } else {
        await executeSystemCommand(trimmedCommand, terminalCwd, setTerminalHistory);
      }
    } catch (error) {
      setTerminalHistory((prev) => [...prev, `Error: ${error}`, '']);
    }
  },
};

async function executeCustomCommand(
  cmd: string,
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
  setTerminalCwd: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPath: (path: string) => void,
  refetch: () => void,
) {
  switch (cmd) {
    case 'help':
      setTerminalHistory((prev) => [
        ...prev,
        'Xplorer File Explorer Terminal',
        '─────────────────────────────────',
        'Custom Commands:',
        '  help           - Show this help',
        '  clear          - Clear terminal',
        '  ls, dir        - List directory contents',
        '  cd <path>      - Change directory',
        '  pwd            - Print working directory',
        '  open <file>    - Open file with default application',
        '  mkdir <name>   - Create directory',
        '  explorer       - Open current directory in file explorer',
        '  tree           - Display directory tree',
        '  find <name>    - Find files by name',
        '  size <path>    - Show size of a file or directory',
        '',
        'System Commands:',
        '  Any Windows command (dir, type, copy, move, del, etc.)',
        '  PowerShell commands (Get-ChildItem, Copy-Item, etc.)',
        '  Git commands (git status, git add, git commit, etc.)',
        '  Node.js/npm commands (npm install, node script.js, etc.)',
        '  Python commands (python script.py, pip install, etc.)',
        '',
        'Examples:',
        '  dir /b          - List files in brief format',
        '  git status      - Check git repository status',
        '  npm install     - Install npm dependencies',
        '  python --version - Check Python version',
        '',
      ]);
      break;

    case 'ls':
    case 'dir':
      try {
        const dirFiles = await TauriAPI.readDirectory(terminalCwd);
        setTerminalHistory((prev) => [
          ...prev,
          'Directory listing:',
          ...dirFiles.map(
            (f) => `${f.is_dir ? 'd' : '-'}  ${f.name.padEnd(30)} ${formatFileSize(f.size)}`,
          ),
          '',
        ]);
      } catch (error) {
        setTerminalHistory((prev) => [...prev, `Error reading directory: ${error}`, '']);
      }
      break;

    case 'pwd':
      setTerminalHistory((prev) => [...prev, terminalCwd, '']);
      break;

    case 'cd':
      await handleChangeDirectory(
        args,
        terminalCwd,
        setTerminalHistory,
        setTerminalCwd,
        setCurrentPath,
      );
      break;

    case 'clear':
      setTerminalHistory(['']);
      break;

    case 'open':
      await handleOpenFile(args, terminalCwd, setTerminalHistory);
      break;

    case 'mkdir':
      await handleCreateDirectory(args, terminalCwd, setTerminalHistory, refetch);
      break;

    case 'explorer':
      try {
        await TauriAPI.openInTerminal(terminalCwd);
        setTerminalHistory((prev) => [...prev, `Opening ${terminalCwd} in file explorer...`, '']);
      } catch (error) {
        setTerminalHistory((prev) => [...prev, `Error opening file explorer: ${error}`, '']);
      }
      break;

    case 'tree':
      await handleTreeCommand(terminalCwd, setTerminalHistory);
      break;

    case 'find':
      await handleFindCommand(args, terminalCwd, setTerminalHistory);
      break;

    case 'size':
      await handleSizeCommand(args, terminalCwd, setTerminalHistory);
      break;
  }
}

async function executeSystemCommand(
  command: string,
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
) {
  try {
    const result = await TauriAPI.executeCommand(command, terminalCwd);

    if (result.stdout) {
      const lines = result.stdout.trim().split('\n');
      setTerminalHistory((prev) => [...prev, ...lines]);
    }

    if (result.stderr) {
      const errorLines = result.stderr.trim().split('\n');
      setTerminalHistory((prev) => [...prev, ...errorLines.map((line) => `Error: ${line}`)]);
    }

    if (result.exit_code !== 0 && !result.stdout && !result.stderr) {
      setTerminalHistory((prev) => [...prev, `Command exited with code ${result.exit_code}`]);
    }

    setTerminalHistory((prev) => [...prev, '']);
  } catch (error) {
    setTerminalHistory((prev) => [...prev, `Failed to execute command: ${error}`, '']);
  }
}

async function handleChangeDirectory(
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
  setTerminalCwd: React.Dispatch<React.SetStateAction<string>>,
  setCurrentPath: (path: string) => void,
) {
  if (args.length === 0) {
    setTerminalHistory((prev) => [...prev, terminalCwd, '']);
    return;
  }

  const targetPath = args[0];

  try {
    let resolvedPath = terminalCwd;

    if (targetPath === '..') {
      const parts = terminalCwd.split(/[\\/]/).filter(Boolean);
      if (parts.length > 1) {
        parts.pop();
        resolvedPath = isWindows ? parts.join(PATH_SEPARATOR) : `/${parts.join('/')}`;
      } else {
        resolvedPath = isWindows ? parts[0] + PATH_SEPARATOR : '/';
      }
    } else if (targetPath.startsWith('/') || targetPath.match(/^[A-Z]:\\/i)) {
      resolvedPath = targetPath;
    } else {
      resolvedPath = terminalCwd.endsWith(PATH_SEPARATOR)
        ? terminalCwd + targetPath
        : terminalCwd + PATH_SEPARATOR + targetPath;
    }

    // Verify directory exists
    await TauriAPI.readDirectory(resolvedPath);
    setTerminalCwd(resolvedPath);
    setCurrentPath(resolvedPath);
    setTerminalHistory((prev) => [...prev, '']);
  } catch {
    setTerminalHistory((prev) => [...prev, `cd: ${targetPath}: No such file or directory`, '']);
  }
}

async function handleOpenFile(
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
) {
  if (args.length === 0) {
    setTerminalHistory((prev) => [...prev, 'Usage: open <filename>', '']);
    return;
  }

  const fileName = args[0];
  const filePath =
    fileName.includes(PATH_SEPARATOR) || fileName.includes('/')
      ? fileName
      : joinPath(terminalCwd, fileName);

  try {
    await TauriAPI.openFile(filePath);
    setTerminalHistory((prev) => [...prev, `Opening ${fileName}...`, '']);
  } catch {
    setTerminalHistory((prev) => [...prev, `open: ${fileName}: No such file or directory`, '']);
  }
}

async function handleCreateDirectory(
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
  refetch: () => void,
) {
  if (args.length === 0) {
    setTerminalHistory((prev) => [...prev, 'Usage: mkdir <dirname>', '']);
    return;
  }

  const dirName = args[0];
  const dirPath = joinPath(terminalCwd, dirName);

  try {
    await TauriAPI.createDirRecursive(dirPath);
    setTerminalHistory((prev) => [...prev, `Created directory: ${dirName}`, '']);
    refetch();
  } catch {
    setTerminalHistory((prev) => [...prev, `mkdir: Failed to create directory ${dirName}`, '']);
  }
}

async function handleTreeCommand(
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
) {
  try {
    const tree = await buildDirectoryTree(terminalCwd, 0, 3); // Max depth 3
    setTerminalHistory((prev) => [...prev, `Directory tree for ${terminalCwd}:`, ...tree, '']);
  } catch (error) {
    setTerminalHistory((prev) => [...prev, `Error building directory tree: ${error}`, '']);
  }
}

async function buildDirectoryTree(
  dirPath: string,
  currentDepth: number,
  maxDepth: number,
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const files = await TauriAPI.readDirectory(dirPath);
  const tree: string[] = [];
  const indent = '  '.repeat(currentDepth);

  for (const file of files) {
    const prefix = file.is_dir ? '[dir]' : '     ';
    tree.push(`${indent}${prefix} ${file.name}`);

    if (file.is_dir && currentDepth < maxDepth - 1) {
      try {
        const subtree = await buildDirectoryTree(file.path, currentDepth + 1, maxDepth);
        tree.push(...subtree);
      } catch {
        // Skip directories we can't access
      }
    }
  }

  return tree;
}

async function handleFindCommand(
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
) {
  if (args.length === 0) {
    setTerminalHistory((prev) => [...prev, 'Usage: find <pattern>', '']);
    return;
  }

  const pattern = args[0];

  try {
    // For now, use a simple file name search since we don't have the Tauri method yet
    const files = await TauriAPI.readDirectory(terminalCwd);
    const matches = files.filter((f) => f.name.toLowerCase().includes(pattern.toLowerCase()));

    if (matches.length > 0) {
      setTerminalHistory((prev) => [
        ...prev,
        `Found ${matches.length} matches for "${pattern}":`,
        ...matches.map((f) => `- ${f.name} (${f.is_dir ? 'directory' : 'file'})`),
        '',
      ]);
    } else {
      setTerminalHistory((prev) => [...prev, `No files found matching "${pattern}"`, '']);
    }
  } catch (error) {
    setTerminalHistory((prev) => [...prev, `Error searching for files: ${error}`, '']);
  }
}

async function handleSizeCommand(
  args: string[],
  terminalCwd: string,
  setTerminalHistory: React.Dispatch<React.SetStateAction<string[]>>,
) {
  const pathToCheck = args.length > 0 ? args[0] : '.';
  let fullPath: string;
  if (pathToCheck === '.') {
    fullPath = terminalCwd;
  } else if (pathToCheck.includes(PATH_SEPARATOR) || pathToCheck.includes('/')) {
    fullPath = pathToCheck;
  } else {
    fullPath = joinPath(terminalCwd, pathToCheck);
  }

  try {
    const dirSize = await TauriAPI.getDirSize(fullPath);
    setTerminalHistory((prev) => [
      ...prev,
      `Size information for ${pathToCheck}:`,
      `Total size: ${formatFileSize(dirSize.total_size)}`,
      `Files: ${dirSize.file_count}`,
      `Directories: ${dirSize.dir_count}`,
      '',
    ]);
  } catch (error) {
    setTerminalHistory((prev) => [...prev, `Error getting size information: ${error}`, '']);
  }
}
