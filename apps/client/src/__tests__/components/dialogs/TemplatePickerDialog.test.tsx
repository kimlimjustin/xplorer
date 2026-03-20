import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplatePickerDialog from '@/components/dialogs/TemplatePickerDialog';
import type { FileTemplate } from '@/lib/file-templates';

// Mock file-templates module — all data must be defined inside the factory
// because vi.mock is hoisted above any top-level variable declarations.
vi.mock('@/lib/file-templates', () => {
  const templates: FileTemplate[] = [
    {
      id: 'builtin-readme',
      name: 'README.md',
      filename: 'README.md',
      extension: '.md',
      category: 'document',
      isBuiltin: true,
      content: '# {{project_name}}\n\n## Description\n',
    },
    {
      id: 'builtin-gitignore-node',
      name: '.gitignore (Node)',
      filename: '.gitignore',
      extension: '',
      category: 'config',
      isBuiltin: true,
      content: 'node_modules/\ndist/\n.env\n',
    },
    {
      id: 'builtin-index-html',
      name: 'index.html',
      filename: 'index.html',
      extension: '.html',
      category: 'web',
      isBuiltin: true,
      content:
        '<!DOCTYPE html>\n<html>\n<head><title>{{title}}</title></head>\n<body><h1>{{title}}</h1></body>\n</html>\n',
    },
    {
      id: 'builtin-package-json',
      name: 'package.json',
      filename: 'package.json',
      extension: '.json',
      category: 'config',
      isBuiltin: true,
      content: '{\n  "name": "{{project_name}}"\n}\n',
    },
    {
      id: 'custom-template-1',
      name: 'My Custom Template',
      filename: 'custom.ts',
      extension: '.ts',
      category: 'custom',
      isBuiltin: false,
      content: 'export const {{project_name}} = {};\n',
    },
  ];

  const categories: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'document', label: 'Document' },
    { value: 'code', label: 'Code' },
    { value: 'config', label: 'Config' },
    { value: 'web', label: 'Web' },
    { value: 'custom', label: 'Custom' },
  ];

  return {
    getAllTemplates: vi.fn(() => templates),
    extractVariables: vi.fn((content: string) => {
      const regex = /\{\{(\w+)\}\}/g;
      const vars = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        vars.add(match[1]);
      }
      return Array.from(vars);
    }),
    renderTemplate: vi.fn((template: { content: string }, variables: Record<string, string>) => {
      let result = template.content;
      for (const [key, value] of Object.entries(variables)) {
        const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(re, value);
      }
      return result;
    }),
    getDefaultVariables: vi.fn((currentPath: string) => {
      const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const projectName = parts[parts.length - 1] || 'my-project';
      return {
        project_name: projectName,
        year: '2026',
        date: '2026-03-17',
        author: 'Author',
        title: projectName,
      };
    }),
    deleteCustomTemplate: vi.fn(),
    TEMPLATE_CATEGORIES: categories,
  };
});

const { deleteCustomTemplate, getAllTemplates } = await import('@/lib/file-templates');

describe('TemplatePickerDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreateFile: vi.fn(),
    currentPath: '/home/user/my-project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<TemplatePickerDialog {...defaultProps} isOpen={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders the dialog when isOpen is true', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Basic Rendering', () => {
    it('displays "New from Template" as the title', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('New from Template')).toBeInTheDocument();
    });

    it('has the correct aria-label', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'New from Template');
    });

    it('displays a close button', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('displays Cancel button', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('displays Create button', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
  });

  describe('Category Sidebar', () => {
    it('displays all category buttons', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Document')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Config')).toBeInTheDocument();
      expect(screen.getByText('Web')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('defaults to "All" category showing all templates', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('.gitignore (Node)')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();
    });

    it('filters templates when a category is selected', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Document'));

      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.queryByText('.gitignore (Node)')).not.toBeInTheDocument();
      expect(screen.queryByText('index.html')).not.toBeInTheDocument();
    });

    it('shows config templates when Config category is selected', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Config'));

      expect(screen.getByText('.gitignore (Node)')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
      expect(screen.queryByText('README.md')).not.toBeInTheDocument();
    });

    it('shows empty state for categories with no templates', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Code'));

      expect(screen.getByText('No templates in this category.')).toBeInTheDocument();
    });
  });

  describe('Template Grid', () => {
    it('displays template names', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('.gitignore (Node)')).toBeInTheDocument();
      expect(screen.getByText('index.html')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('displays template category labels on cards', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getAllByText('document').length).toBeGreaterThan(0);
      expect(screen.getAllByText('config').length).toBeGreaterThan(0);
    });

    it('displays content snippets', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      expect(screen.getByText(/# \{\{project_name\}\}/)).toBeInTheDocument();
    });

    it('allows selecting a template by clicking its card', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByText('Filename')).toBeInTheDocument();
    });
  });

  describe('Template Selection and Configuration', () => {
    it('shows filename input after selecting a template', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByDisplayValue('README.md')).toBeInTheDocument();
    });

    it('populates filename from selected template', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByDisplayValue('README.md')).toHaveValue('README.md');
    });

    it('allows editing the filename', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      const filenameInput = screen.getByDisplayValue('README.md');
      fireEvent.change(filenameInput, { target: { value: 'CONTRIBUTING.md' } });
      expect(filenameInput).toHaveValue('CONTRIBUTING.md');
    });

    it('shows variable inputs for templates with variables', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByText('project name')).toBeInTheDocument();
    });

    it('shows Preview section after selecting a template', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('renders template content in preview with default variable values', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      expect(screen.getByText(/# my-project/)).toBeInTheDocument();
    });

    it('updates preview when variable values change', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      // Find the variable input for project_name
      const variableInputs = screen.getAllByRole('textbox');
      const projectNameInput = variableInputs.find(
        (input) => (input as HTMLInputElement).placeholder === 'my-project',
      );
      if (projectNameInput) {
        fireEvent.change(projectNameInput, { target: { value: 'awesome-app' } });
        expect(screen.getByText(/# awesome-app/)).toBeInTheDocument();
      }
    });
  });

  describe('Create Action', () => {
    it('disables Create button when no template is selected', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      const createBtn = screen.getByText('Create');
      expect(createBtn.closest('button')).toBeDisabled();
    });

    it('enables Create button when a template is selected and filename is provided', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      const createBtn = screen.getByText('Create');
      expect(createBtn.closest('button')).not.toBeDisabled();
    });

    it('disables Create button when filename is empty', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      const filenameInput = screen.getByDisplayValue('README.md');
      fireEvent.change(filenameInput, { target: { value: '' } });

      const createBtn = screen.getByText('Create');
      expect(createBtn.closest('button')).toBeDisabled();
    });

    it('calls onCreateFile and onClose when Create is clicked', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));
      fireEvent.click(screen.getByText('Create'));

      expect(defaultProps.onCreateFile).toHaveBeenCalledWith('README.md', expect.any(String));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('passes rendered content with variables replaced to onCreateFile', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));
      fireEvent.click(screen.getByText('Create'));

      const [, content] = defaultProps.onCreateFile.mock.calls[0];
      expect(content).toContain('# my-project');
      expect(content).not.toContain('{{project_name}}');
    });
  });

  describe('Delete Custom Template', () => {
    it('shows delete button on custom (non-builtin) templates', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /Delete template My Custom Template/ }),
      ).toBeInTheDocument();
    });

    it('does not show delete button on builtin templates', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      expect(
        screen.queryByRole('button', { name: /Delete template README/ }),
      ).not.toBeInTheDocument();
    });

    it('calls deleteCustomTemplate when delete button is clicked', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      const deleteBtn = screen.getByRole('button', {
        name: /Delete template My Custom Template/,
      });
      fireEvent.click(deleteBtn);

      expect(deleteCustomTemplate).toHaveBeenCalledWith('custom-template-1');
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close (X) button is clicked', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      render(<TemplatePickerDialog {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reopen Behavior', () => {
    it('resets state when dialog is reopened', () => {
      const { rerender } = render(<TemplatePickerDialog {...defaultProps} />);

      // Select a template
      fireEvent.click(screen.getByText('README.md'));
      expect(screen.getByText('Filename')).toBeInTheDocument();

      // Close
      rerender(<TemplatePickerDialog {...defaultProps} isOpen={false} />);

      // Reopen
      rerender(<TemplatePickerDialog {...defaultProps} isOpen={true} />);

      // Should be back to no template selected
      const createBtn = screen.getByText('Create');
      expect(createBtn.closest('button')).toBeDisabled();
    });
  });

  describe('Template Keyboard Navigation', () => {
    it('allows selecting templates via Enter key', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      // Template cards have role="button" and tabIndex={0}
      const templateCards = screen.getAllByRole('button');
      const readmeCard = templateCards.find((el) => el.textContent?.includes('README.md'));

      if (readmeCard) {
        fireEvent.keyDown(readmeCard, { key: 'Enter' });
        expect(screen.getByText('Filename')).toBeInTheDocument();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty template list gracefully', () => {
      vi.mocked(getAllTemplates).mockReturnValueOnce([]);

      render(<TemplatePickerDialog {...defaultProps} />);

      expect(screen.getByText('No templates in this category.')).toBeInTheDocument();
    });

    it('handles whitespace-only filename as invalid', () => {
      render(<TemplatePickerDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('README.md'));

      const filenameInput = screen.getByDisplayValue('README.md');
      fireEvent.change(filenameInput, { target: { value: '   ' } });

      const createBtn = screen.getByText('Create');
      expect(createBtn.closest('button')).toBeDisabled();
    });
  });
});
