// ── File Template System ─────────────────────────────────────────────────────

import { STORAGE_KEYS } from '@/lib/storage-keys';

export interface FileTemplate {
  id: string;
  name: string;
  filename: string;
  extension: string;
  content: string;
  category: 'document' | 'code' | 'config' | 'web' | 'custom';
  isBuiltin: boolean;
}

export type TemplateCategory = FileTemplate['category'];

export const TEMPLATE_CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'document', label: 'Document' },
  { value: 'code', label: 'Code' },
  { value: 'config', label: 'Config' },
  { value: 'web', label: 'Web' },
  { value: 'custom', label: 'Custom' },
];

// ── Built-in Templates ──────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: FileTemplate[] = [
  {
    id: 'builtin-readme',
    name: 'README.md',
    filename: 'README.md',
    extension: '.md',
    category: 'document',
    isBuiltin: true,
    content: `# {{project_name}}

## Description

## Installation

## Usage

## License
`,
  },
  {
    id: 'builtin-gitignore-node',
    name: '.gitignore (Node)',
    filename: '.gitignore',
    extension: '',
    category: 'config',
    isBuiltin: true,
    content: `node_modules/
dist/
.env
*.log
.DS_Store
`,
  },
  {
    id: 'builtin-gitignore-python',
    name: '.gitignore (Python)',
    filename: '.gitignore',
    extension: '',
    category: 'config',
    isBuiltin: true,
    content: `__pycache__/
*.pyc
venv/
.env
*.egg-info/
`,
  },
  {
    id: 'builtin-env-example',
    name: '.env.example',
    filename: '.env.example',
    extension: '',
    category: 'config',
    isBuiltin: true,
    content: `# Environment Variables
DATABASE_URL=
API_KEY=
PORT=3000
`,
  },
  {
    id: 'builtin-package-json',
    name: 'package.json',
    filename: 'package.json',
    extension: '.json',
    category: 'config',
    isBuiltin: true,
    content: `{
  "name": "{{project_name}}",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
`,
  },
  {
    id: 'builtin-index-html',
    name: 'index.html',
    filename: 'index.html',
    extension: '.html',
    category: 'web',
    isBuiltin: true,
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
</head>
<body>
  <h1>{{title}}</h1>
</body>
</html>
`,
  },
  {
    id: 'builtin-tsconfig',
    name: 'tsconfig.json',
    filename: 'tsconfig.json',
    extension: '.json',
    category: 'config',
    isBuiltin: true,
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,
  },
  {
    id: 'builtin-dockerfile',
    name: 'Dockerfile',
    filename: 'Dockerfile',
    extension: '',
    category: 'config',
    isBuiltin: true,
    content: `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
`,
  },
  {
    id: 'builtin-docker-compose',
    name: 'docker-compose.yml',
    filename: 'docker-compose.yml',
    extension: '.yml',
    category: 'config',
    isBuiltin: true,
    content: `version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - .:/app
      - /app/node_modules
`,
  },
  {
    id: 'builtin-license-mit',
    name: 'LICENSE (MIT)',
    filename: 'LICENSE',
    extension: '',
    category: 'document',
    isBuiltin: true,
    content: `MIT License

Copyright (c) {{year}} {{author}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
  },
];

// ── Storage Keys ────────────────────────────────────────────────────────────

const CUSTOM_TEMPLATES_KEY = STORAGE_KEYS.CUSTOM_TEMPLATES;

// ── Public API ──────────────────────────────────────────────────────────────

export const getBuiltinTemplates = (): FileTemplate[] => {
  return BUILTIN_TEMPLATES;
};

export const getCustomTemplates = (): FileTemplate[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FileTemplate[];
  } catch {
    return [];
  }
};

export const getAllTemplates = (): FileTemplate[] => {
  return [...getBuiltinTemplates(), ...getCustomTemplates()];
};

export const saveCustomTemplate = (template: Omit<FileTemplate, 'id' | 'isBuiltin'>): void => {
  const customs = getCustomTemplates();
  const newTemplate: FileTemplate = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isBuiltin: false,
  };
  customs.push(newTemplate);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customs));
};

export const deleteCustomTemplate = (id: string): void => {
  const customs = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customs));
};

/**
 * Extract all `{{variable}}` placeholders from template content.
 */
export const extractVariables = (content: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
};

/**
 * Replace `{{var}}` placeholders in template content with actual values.
 */
export const renderTemplate = (
  template: FileTemplate,
  variables: Record<string, string>,
): string => {
  let result = template.content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
};

/**
 * Return context-aware default values for common template variables.
 */
export const getDefaultVariables = (currentPath: string): Record<string, string> => {
  const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
  const projectName = parts[parts.length - 1] || 'my-project';

  return {
    project_name: projectName,
    year: new Date().getFullYear().toString(),
    date: new Date().toISOString().slice(0, 10),
    author: 'Author',
    title: projectName,
  };
};
