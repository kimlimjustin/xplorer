import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
    // Include real Xplorer client components for class scanning
    '../client/src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Xplorer Glass theme colors (CSS variable-based, matching the real app)
        xp: {
          bg: 'var(--xp-bg)',
          surface: 'var(--xp-surface)',
          'surface-light': 'var(--xp-surface-light)',
          popover: 'var(--xp-popover)',
          border: 'var(--xp-border)',
          text: 'var(--xp-text)',
          'text-secondary': 'var(--xp-text-secondary)',
          'text-muted': 'var(--xp-text-muted)',
          blue: 'var(--xp-blue)',
          green: 'var(--xp-green)',
          orange: 'var(--xp-orange)',
          red: 'var(--xp-red)',
          purple: 'var(--xp-purple)',
          pink: 'var(--xp-pink)',
          cyan: 'var(--xp-cyan)',
          yellow: 'var(--xp-yellow)',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
