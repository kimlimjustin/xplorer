import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBuiltinTemplates,
  getCustomTemplates,
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  extractVariables,
  renderTemplate,
  getDefaultVariables,
  TEMPLATE_CATEGORIES,
  type FileTemplate,
} from '@/lib/file-templates';

// ── localStorage mock ─────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(),
  });
});

// ── Built-in templates ──────────────────────────────────────────────────

describe('built-in templates', () => {
  it('returns non-empty list of builtin templates', () => {
    const templates = getBuiltinTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('all builtin templates have isBuiltin=true', () => {
    const templates = getBuiltinTemplates();
    expect(templates.every((t) => t.isBuiltin)).toBe(true);
  });

  it('all builtin templates have required fields', () => {
    for (const t of getBuiltinTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.filename).toBeTruthy();
      expect(t.content).toBeTruthy();
      expect(['document', 'code', 'config', 'web', 'custom']).toContain(t.category);
    }
  });

  it('includes commonly expected templates', () => {
    const names = getBuiltinTemplates().map((t) => t.name);
    expect(names).toContain('README.md');
    expect(names).toContain('.gitignore (Node)');
    expect(names).toContain('package.json');
    expect(names).toContain('Dockerfile');
  });
});

// ── Custom templates ────────────────────────────────────────────────────

describe('custom templates', () => {
  it('returns empty array when no custom templates exist', () => {
    expect(getCustomTemplates()).toEqual([]);
  });

  it('saves and retrieves a custom template', () => {
    saveCustomTemplate({
      name: 'My Template',
      filename: 'myfile.txt',
      extension: '.txt',
      content: 'Hello World',
      category: 'custom',
    });

    const customs = getCustomTemplates();
    expect(customs).toHaveLength(1);
    expect(customs[0].name).toBe('My Template');
    expect(customs[0].isBuiltin).toBe(false);
    expect(customs[0].id).toMatch(/^custom-/);
  });

  it('accumulates multiple custom templates', () => {
    saveCustomTemplate({
      name: 'T1',
      filename: 'f1',
      extension: '.txt',
      content: 'a',
      category: 'custom',
    });
    saveCustomTemplate({
      name: 'T2',
      filename: 'f2',
      extension: '.txt',
      content: 'b',
      category: 'code',
    });

    expect(getCustomTemplates()).toHaveLength(2);
  });

  it('deletes a custom template by id', () => {
    saveCustomTemplate({
      name: 'Delete Me',
      filename: 'del.txt',
      extension: '.txt',
      content: 'x',
      category: 'custom',
    });
    const customs = getCustomTemplates();
    expect(customs).toHaveLength(1);

    deleteCustomTemplate(customs[0].id);
    expect(getCustomTemplates()).toHaveLength(0);
  });

  it('deleting non-existent id does not affect others', () => {
    saveCustomTemplate({
      name: 'Keep',
      filename: 'keep.txt',
      extension: '.txt',
      content: 'y',
      category: 'custom',
    });
    deleteCustomTemplate('nonexistent-id');
    expect(getCustomTemplates()).toHaveLength(1);
  });
});

// ── getAllTemplates ─────────────────────────────────────────────────────

describe('getAllTemplates', () => {
  it('returns builtins + custom templates combined', () => {
    saveCustomTemplate({
      name: 'Custom',
      filename: 'custom.txt',
      extension: '.txt',
      content: 'c',
      category: 'custom',
    });

    const all = getAllTemplates();
    const builtinCount = getBuiltinTemplates().length;
    expect(all).toHaveLength(builtinCount + 1);
    // Builtins come first
    expect(all[0].isBuiltin).toBe(true);
    // Custom comes last
    expect(all[all.length - 1].name).toBe('Custom');
  });
});

// ── extractVariables ────────────────────────────────────────────────────

describe('extractVariables', () => {
  it('extracts template variables from content', () => {
    const vars = extractVariables('Hello {{name}}, welcome to {{project}}!');
    expect(vars).toContain('name');
    expect(vars).toContain('project');
    expect(vars).toHaveLength(2);
  });

  it('de-duplicates repeated variables', () => {
    const vars = extractVariables('{{x}} and {{x}} again');
    expect(vars).toEqual(['x']);
  });

  it('returns empty array for content with no variables', () => {
    expect(extractVariables('No variables here')).toEqual([]);
  });

  it('handles multiple occurrences of various variables', () => {
    const vars = extractVariables('{{project_name}} v{{version}} by {{author}} ({{project_name}})');
    expect(vars).toContain('project_name');
    expect(vars).toContain('version');
    expect(vars).toContain('author');
    expect(vars).toHaveLength(3);
  });
});

// ── renderTemplate ──────────────────────────────────────────────────────

describe('renderTemplate', () => {
  const template: FileTemplate = {
    id: 'test',
    name: 'Test',
    filename: 'test.txt',
    extension: '.txt',
    content: '# {{project_name}}\nBy {{author}} ({{year}})',
    category: 'document',
    isBuiltin: false,
  };

  it('replaces all variable placeholders', () => {
    const result = renderTemplate(template, {
      project_name: 'MyApp',
      author: 'Alice',
      year: '2026',
    });
    expect(result).toBe('# MyApp\nBy Alice (2026)');
  });

  it('leaves unmatched variables as-is', () => {
    const result = renderTemplate(template, { project_name: 'MyApp' });
    expect(result).toContain('MyApp');
    expect(result).toContain('{{author}}');
    expect(result).toContain('{{year}}');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const t: FileTemplate = {
      ...template,
      content: '{{name}} is {{name}}',
    };
    const result = renderTemplate(t, { name: 'Bob' });
    expect(result).toBe('Bob is Bob');
  });

  it('handles empty variables record', () => {
    const result = renderTemplate(template, {});
    expect(result).toBe(template.content);
  });
});

// ── getDefaultVariables ──────────────────────────────────────────────────

describe('getDefaultVariables', () => {
  it('extracts project name from Unix path', () => {
    const vars = getDefaultVariables('/home/user/my-app');
    expect(vars.project_name).toBe('my-app');
    expect(vars.title).toBe('my-app');
  });

  it('extracts project name from Windows path', () => {
    const vars = getDefaultVariables('C:\\Users\\Alice\\Projects\\cool-project');
    expect(vars.project_name).toBe('cool-project');
  });

  it('provides current year', () => {
    const vars = getDefaultVariables('/test');
    expect(vars.year).toBe(new Date().getFullYear().toString());
  });

  it('provides current date in ISO format', () => {
    const vars = getDefaultVariables('/test');
    expect(vars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to "my-project" for empty path segments', () => {
    const vars = getDefaultVariables('/');
    expect(vars.project_name).toBe('my-project');
  });

  it('provides a default author', () => {
    const vars = getDefaultVariables('/test');
    expect(vars.author).toBe('Author');
  });
});

// ── Storage edge cases ──────────────────────────────────────────────────

describe('storage edge cases', () => {
  it('handles corrupted custom templates JSON', () => {
    store['xplorer:custom-templates'] = '{bad json';
    expect(getCustomTemplates()).toEqual([]);
  });

  it('handles non-array custom templates', () => {
    store['xplorer:custom-templates'] = '"string"';
    expect(getCustomTemplates()).toEqual([]);
  });
});

// ── TEMPLATE_CATEGORIES ─────────────────────────────────────────────────

describe('TEMPLATE_CATEGORIES', () => {
  it('includes "all" and the 5 category types', () => {
    const values = TEMPLATE_CATEGORIES.map((c) => c.value);
    expect(values).toContain('all');
    expect(values).toContain('document');
    expect(values).toContain('code');
    expect(values).toContain('config');
    expect(values).toContain('web');
    expect(values).toContain('custom');
  });
});
