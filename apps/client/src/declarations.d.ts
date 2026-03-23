// Ambient module declarations for react-syntax-highlighter subpath imports.
// The package ships no TypeScript types; these declarations provide enough
// shape for PrismLight and its language/style helpers.

declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import { FC, CSSProperties } from 'react';

  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, CSSProperties>;
    customStyle?: CSSProperties;
    showLineNumbers?: boolean;
    wrapLines?: boolean;
    wrapLongLines?: boolean;
    children: string | string[];
    [key: string]: unknown;
  }

  // FC-compatible component with a static registerLanguage method
  const SyntaxHighlighter: FC<SyntaxHighlighterProps> & {
    registerLanguage: (name: string, language: unknown) => void;
  };
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  // CSSProperties-shaped style tokens keyed by class name
  type StyleMap = Record<string, Record<string, string | number>>;
  export const oneDark: StyleMap;
  export const dark: StyleMap;
  export const okaidia: StyleMap;
  const styles: Record<string, StyleMap>;
  export default styles;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/typescript' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/javascript' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/jsx' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/tsx' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/python' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/rust' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/go' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/java' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/c' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/cpp' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/json' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/yaml' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/toml' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/bash' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/css' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/markup' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/sql' {
  const lang: unknown;
  export default lang;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/markdown' {
  const lang: unknown;
  export default lang;
}
