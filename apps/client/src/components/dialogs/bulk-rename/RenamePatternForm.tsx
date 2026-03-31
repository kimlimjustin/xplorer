import React from 'react';
import {
  PRESETS,
  PATTERN_TEMPLATES,
  REGEX_SNIPPETS,
  ChevronIcon,
  type Preset,
  type PatternTemplate,
  type RegexSnippet,
} from '../bulk-rename-helpers';

interface RenamePatternFormProps {
  pattern: string;
  replacement: string;
  patternError: string | null;
  renaming: boolean;
  regexHelperOpen: boolean;
  activeTemplateLabel: string | null;
  patternInputRef: React.RefObject<HTMLInputElement | null>;
  onPatternChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onApplyPreset: (preset: Preset) => void;
  onApplyTemplate: (template: PatternTemplate) => void;
  onInsertRegexSnippet: (snippet: RegexSnippet) => void;
  onRegexHelperToggle: (open: boolean) => void;
}

const RenamePatternForm = ({
  pattern,
  replacement,
  patternError,
  renaming,
  regexHelperOpen,
  activeTemplateLabel,
  patternInputRef,
  onPatternChange,
  onReplacementChange,
  onApplyPreset,
  onApplyTemplate,
  onInsertRegexSnippet,
  onRegexHelperToggle,
}: RenamePatternFormProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {/* Pattern Template Buttons */}
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--xp-text-muted)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Pattern Templates
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PATTERN_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.label}
            onClick={() => onApplyTemplate(tmpl)}
            disabled={renaming}
            title={tmpl.description}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${activeTemplateLabel === tmpl.label ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
              background:
                activeTemplateLabel === tmpl.label
                  ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.15)'
                  : 'var(--xp-bg)',
              color: activeTemplateLabel === tmpl.label ? 'var(--xp-blue)' : 'var(--xp-text)',
              cursor: renaming ? 'not-allowed' : 'pointer',
              opacity: renaming ? 0.5 : 1,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'monospace',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            onMouseEnter={(e) => {
              if (!renaming && activeTemplateLabel !== tmpl.label) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTemplateLabel !== tmpl.label) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
              }
            }}
          >
            <span style={{ opacity: 0.7, fontSize: 11 }}>{tmpl.icon}</span>
            {tmpl.label}
          </button>
        ))}
      </div>
    </div>

    {/* Preset buttons */}
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--xp-text-muted)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Quick Presets
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onApplyPreset(preset)}
            disabled={renaming}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--xp-border)',
              background: 'var(--xp-bg)',
              cursor: renaming ? 'not-allowed' : 'pointer',
              opacity: renaming ? 0.5 : 1,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!renaming) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)' }}>
              {preset.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 2 }}>
              {preset.description}
            </div>
          </button>
        ))}
      </div>
    </div>

    {/* Pattern input */}
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--xp-text-muted)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Pattern (Regex)
      </label>
      <input
        ref={patternInputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={pattern}
        onChange={(e) => onPatternChange(e.target.value)}
        disabled={renaming}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: `1px solid ${patternError ? 'var(--xp-red)' : 'var(--xp-border)'}`,
          borderRadius: 8,
          backgroundColor: 'var(--xp-bg)',
          color: 'var(--xp-text)',
          fontFamily: 'monospace',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => {
          if (!patternError) e.currentTarget.style.borderColor = 'var(--xp-blue)';
        }}
        onBlur={(e) => {
          if (!patternError) e.currentTarget.style.borderColor = 'var(--xp-border)';
        }}
        placeholder="e.g. ^(.+)\.txt$ or find_this"
      />
      {patternError && (
        <p style={{ fontSize: 11, color: 'var(--xp-red)', marginTop: 4 }}>{patternError}</p>
      )}
      <p style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>
        Applied to the filename only (not the full path). Uses regex syntax.
      </p>
    </div>

    {/* Replacement input */}
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--xp-text-muted)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Replacement
      </label>
      <input
        type="text"
        value={replacement}
        onChange={(e) => onReplacementChange(e.target.value)}
        disabled={renaming}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--xp-border)',
          borderRadius: 8,
          backgroundColor: 'var(--xp-bg)',
          color: 'var(--xp-text)',
          fontFamily: 'monospace',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--xp-blue)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--xp-border)';
        }}
        placeholder="e.g. $1_renamed.txt or new_name"
      />
      <p style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>
        Supports{' '}
        <code
          style={{
            backgroundColor: 'var(--xp-bg)',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          $1
        </code>
        ,{' '}
        <code
          style={{
            backgroundColor: 'var(--xp-bg)',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          $2
        </code>{' '}
        (capture groups),{' '}
        <code
          style={{
            backgroundColor: 'var(--xp-bg)',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          {'{N}'}
        </code>{' '}
        (zero-padded),{' '}
        <code
          style={{
            backgroundColor: 'var(--xp-bg)',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 11,
          }}
        >
          {'{date}'}
        </code>{' '}
        (YYYY-MM-DD)
      </p>
    </div>

    {/* Regex Helper Panel (collapsible) */}
    <div
      style={{
        border: '1px solid var(--xp-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => onRegexHelperToggle(!regexHelperOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'var(--xp-bg)',
          border: 'none',
          color: 'var(--xp-text-muted)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
        }}
      >
        <ChevronIcon open={regexHelperOpen} />
        Regex Quick Reference
      </button>
      {regexHelperOpen && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-bg)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: 'var(--xp-text-muted)',
              marginTop: 0,
              marginBottom: 8,
            }}
          >
            Click a pattern to insert it into the search field.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {REGEX_SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                onClick={() => onInsertRegexSnippet(snippet)}
                title={snippet.description}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--xp-border)',
                  backgroundColor: 'var(--xp-surface)',
                  color: 'var(--xp-cyan)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-cyan)';
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--xp-surface-light)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface)';
                }}
              >
                {snippet.label}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
            }}
          >
            {REGEX_SNIPPETS.map((snippet) => (
              <div
                key={`${snippet.label}-desc`}
                style={{ fontSize: 10, color: 'var(--xp-text-muted)', padding: '1px 0' }}
              >
                <code style={{ color: 'var(--xp-cyan)', fontFamily: 'monospace' }}>
                  {snippet.label}
                </code>
                <span style={{ marginLeft: 6 }}>{snippet.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default RenamePatternForm;
