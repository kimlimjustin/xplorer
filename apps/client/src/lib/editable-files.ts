// Shared utility for determining which files can be edited in the built-in editor.

export const EDITABLE_EXTENSIONS = new Set([
  'txt',
  'md',
  'json',
  'js',
  'ts',
  'jsx',
  'tsx',
  'css',
  'html',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'sh',
  'bash',
  'zsh',
  'py',
  'rb',
  'rs',
  'go',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'php',
  'sql',
  'graphql',
  'proto',
  'svg',
  'lua',
  'vim',
  'gitignore',
  'dockerfile',
  'makefile',
  'cmake',
  'gradle',
  'properties',
  'log',
  'csv',
  'tsv',
  'rtf',
]);

const EDITABLE_NAMES = new Set([
  'makefile',
  'dockerfile',
  'jenkinsfile',
  'vagrantfile',
  'procfile',
]);

export const getFileExtension = (name: string) : string => {
  const lower = name.toLowerCase();
  // Handle dotfiles like .gitignore, .env
  if (lower.startsWith('.') && !lower.includes('.', 1)) {
    return lower.slice(1);
  }
  const parts = lower.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export const isEditableFile = (file: { name: string; is_dir: boolean }) : boolean => {
  if (file.is_dir) return false;
  const ext = getFileExtension(file.name);
  if (EDITABLE_NAMES.has(file.name.toLowerCase())) return true;
  return EDITABLE_EXTENSIONS.has(ext);
}
