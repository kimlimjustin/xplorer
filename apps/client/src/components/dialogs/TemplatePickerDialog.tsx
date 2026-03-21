import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  getAllTemplates,
  extractVariables,
  renderTemplate,
  getDefaultVariables,
  deleteCustomTemplate,
  type FileTemplate,
  type TemplateCategory,
  TEMPLATE_CATEGORIES,
} from '@/lib/file-templates';

// ── Props ───────────────────────────────────────────────────────────────────

interface TemplatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFile: (filename: string, content: string) => void;
  currentPath: string;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    animation: 'fadeIn 150ms ease-out',
  },
  dialog: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '780px',
    maxHeight: '80vh',
    margin: '0 16px',
    borderRadius: '12px',
    backgroundColor: 'var(--xp-popover)',
    border: '1px solid var(--xp-border)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    animation: 'slideUp 200ms ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--xp-text)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebar: {
    width: '160px',
    flexShrink: 0,
    borderRight: '1px solid var(--xp-border)',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    overflowY: 'auto' as const,
  },
  categoryBtn: (active: boolean) => ({
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--xp-text)' : 'var(--xp-text-secondary)',
    backgroundColor: active ? 'var(--xp-surface-hover)' : 'transparent',
    transition: 'background-color 120ms, color 120ms',
  }),
  mainPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
    overflow: 'hidden',
  },
  templateGrid: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '10px',
    alignContent: 'start',
  },
  templateCard: (selected: boolean) => ({
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${selected ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
    backgroundColor: selected ? 'var(--xp-surface-hover)' : 'var(--xp-surface)',
    cursor: 'pointer',
    transition: 'border-color 120ms, background-color 120ms',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  }),
  cardName: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--xp-text)',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  cardExt: {
    fontSize: '11px',
    color: 'var(--xp-text-secondary)',
    fontFamily: 'monospace',
  },
  cardSnippet: {
    fontSize: '10px',
    color: 'var(--xp-text-secondary)',
    fontFamily: 'monospace',
    whiteSpace: 'pre' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    maxHeight: '36px',
    lineHeight: '12px',
  },
  cardCategory: {
    fontSize: '10px',
    color: 'var(--xp-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  configPanel: {
    borderTop: '1px solid var(--xp-border)',
    padding: '16px 20px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  configRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--xp-text-secondary)',
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  preview: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-bg)',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: 'var(--xp-text-secondary)',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: '1.5',
    wordBreak: 'break-all' as const,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  footerLink: {
    fontSize: '12px',
    color: 'var(--xp-blue)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  footerActions: {
    display: 'flex',
    gap: '8px',
  },
  btnCancel: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'transparent',
    color: 'var(--xp-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  btnCreate: (disabled: boolean) => ({
    padding: '6px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: disabled ? 'var(--xp-surface-hover)' : 'var(--xp-blue)',
    color: disabled ? 'var(--xp-text-secondary)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    opacity: disabled ? 0.5 : 1,
  }),
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    color: 'var(--xp-text-secondary)',
    fontSize: '13px',
    fontStyle: 'italic' as const,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--xp-text-secondary)',
    padding: '2px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};

// ── File icon SVG ───────────────────────────────────────────────────────────

const FileIcon = ({ extension }: { extension: string }) => {
  let color = 'var(--xp-text-secondary)';
  if (['.ts', '.tsx'].includes(extension)) color = 'var(--xp-blue)';
  else if (['.js', '.jsx'].includes(extension)) color = 'var(--xp-yellow)';
  else if (['.json'].includes(extension)) color = 'var(--xp-green)';
  else if (['.md'].includes(extension)) color = 'var(--xp-purple)';
  else if (['.html'].includes(extension)) color = 'var(--xp-orange, #e67e22)';
  else if (['.yml', '.yaml'].includes(extension)) color = 'var(--xp-cyan, var(--xp-blue))';

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

// ── Component ───────────────────────────────────────────────────────────────

const TemplatePickerDialog = ({
  isOpen,
  onClose,
  onCreateFile,
  currentPath,
}: TemplatePickerDialogProps) => {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<FileTemplate | null>(null);
  const [filename, setFilename] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});

  const templates = useMemo(() => getAllTemplates(), []);

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

  const defaultVars = useMemo(() => getDefaultVariables(currentPath), [currentPath]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setActiveCategory('all');
      setSelectedTemplate(null);
      setFilename('');
      setVariables({});
    }
  }, [isOpen]);

  // When a template is selected, initialize filename and variables
  useEffect(() => {
    if (selectedTemplate) {
      setFilename(selectedTemplate.filename);
      const vars = extractVariables(selectedTemplate.content);
      const initialVars: Record<string, string> = {};
      for (const v of vars) {
        initialVars[v] = defaultVars[v] || '';
      }
      setVariables(initialVars);
    }
  }, [selectedTemplate, defaultVars]);

  const renderedContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return renderTemplate(selectedTemplate, variables);
  }, [selectedTemplate, variables]);

  const templateVars = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractVariables(selectedTemplate.content);
  }, [selectedTemplate]);

  const handleVariableChange = useCallback((key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCreate = useCallback(() => {
    if (!selectedTemplate || !filename.trim()) return;
    onCreateFile(filename.trim(), renderedContent);
    onClose();
  }, [selectedTemplate, filename, renderedContent, onCreateFile, onClose]);

  const handleDeleteCustom = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteCustomTemplate(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    },
    [selectedTemplate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      style={s.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="New from Template"
    >
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <h2 style={s.title}>New from Template</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Category sidebar */}
          <div style={s.sidebar}>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                style={s.categoryBtn(activeCategory === cat.value)}
                onClick={() => setActiveCategory(cat.value)}
                onMouseEnter={(e) => {
                  if (activeCategory !== cat.value) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--xp-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeCategory !== cat.value) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div style={s.mainPanel}>
            {filteredTemplates.length === 0 ? (
              <div style={s.emptyState}>No templates in this category.</div>
            ) : (
              <div style={s.templateGrid}>
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={s.templateCard(selectedTemplate?.id === template.id)}
                    onClick={() => setSelectedTemplate(template)}
                    onMouseEnter={(e) => {
                      if (selectedTemplate?.id !== template.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTemplate?.id !== template.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTemplate(template);
                      }
                    }}
                  >
                    <div style={s.cardHeader}>
                      <FileIcon extension={template.extension} />
                      <span style={s.cardName}>{template.name}</span>
                      {!template.isBuiltin && (
                        <button
                          style={s.deleteBtn}
                          onClick={(e) => handleDeleteCustom(e, template.id)}
                          title="Delete custom template"
                          aria-label={`Delete template ${template.name}`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span style={s.cardCategory}>{template.category}</span>
                    <div style={s.cardSnippet}>{template.content.slice(0, 80)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Configuration panel (shown when a template is selected) */}
            {selectedTemplate && (
              <div style={s.configPanel}>
                <div style={s.configRow}>
                  {/* Filename input */}
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Filename</label>
                    <input
                      style={s.input}
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder={selectedTemplate.filename}
                      autoFocus
                    />
                  </div>
                  {/* Variable inputs */}
                  {templateVars.map((varName) => (
                    <div key={varName} style={s.fieldGroup}>
                      <label style={s.label}>{varName.replace(/_/g, ' ')}</label>
                      <input
                        style={s.input}
                        value={variables[varName] || ''}
                        onChange={(e) => handleVariableChange(varName, e.target.value)}
                        placeholder={defaultVars[varName] || varName}
                      />
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                <div>
                  <span style={s.label}>Preview</span>
                  <div style={s.preview}>{renderedContent}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <div>{/* Placeholder for future "Manage Custom Templates" link */}</div>
          <div style={s.footerActions}>
            <button style={s.btnCancel} onClick={onClose}>
              Cancel
            </button>
            <button
              style={s.btnCreate(!selectedTemplate || !filename.trim())}
              onClick={handleCreate}
              disabled={!selectedTemplate || !filename.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TemplatePickerDialog);
