import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter, type SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';
import { PreviewSkeleton } from '@/components/ui/Skeleton';

// Language mapping for file extensions
const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    vue: 'vue',
    svelte: 'svelte',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
  };

  return languageMap[ext] || 'text';
};

const CodePreview = ({ file, onError, onLoad }: PreviewProps) => {
  const RSH = SyntaxHighlighter as unknown as React.FC<SyntaxHighlighterProps>;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('text');

  useEffect(() => {
    const loadCode = async () => {
      try {
        setLoading(true);

        // Determine language from file extension
        const detectedLanguage = getLanguageFromExtension(file.name);
        setLanguage(detectedLanguage);

        // Read file content
        const fileContent = await TauriAPI.readTextFile(file.path);

        // Limit content for preview (first 2000 characters)
        const truncatedContent =
          file.size > 100000
            ? `${fileContent.slice(0, 2000)}\n... (file truncated for preview)`
            : fileContent;

        setContent(truncatedContent);
        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load code file';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.name, file.size]);

  return (
    <div className="flex h-full flex-col">
      {loading && <PreviewSkeleton />}

      {error ? (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <svg className="mx-auto mb-2 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12.316 3.051a1 1 0 01.633 1.265L11.83 8.843l.007.001c.378.114.688.459.736.847l.007.143v3.166c0 .414-.336.75-.75.75h-3.166c-.414 0-.75-.336-.75-.75V9.834a.75.75 0 01.743-.75h.007l-1.119-4.527a1 1 0 111.949-.482L9.25 7.334h1.5l.633-2.549a1 1 0 011.265-.633z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview code</p>
            <p className="mt-1 text-xs opacity-70">{error}</p>
          </div>
        </div>
      ) : null}
      {!error && content && (
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xp-text-muted bg-xp-bg rounded px-2 py-1 text-xs">
              {language}
            </span>
          </div>
          <div className="bg-xp-surface border-xp-border flex-1 overflow-hidden rounded border">
            <RSH
              language={language}
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '12px',
                fontSize: '11px',
                lineHeight: '1.4',
                height: '100%',
                backgroundColor: 'var(--xp-surface)',
                color: 'var(--xp-text)',
              }}
              showLineNumbers={true}
              wrapLines={true}
              wrapLongLines={true}
            >
              {content}
            </RSH>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodePreview;
