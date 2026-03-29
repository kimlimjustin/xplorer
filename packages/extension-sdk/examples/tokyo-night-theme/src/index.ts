import { ThemeExtension } from '@xplorer/extension-sdk';

export class TokyoNightTheme extends ThemeExtension {
  constructor() {
    super({
      id: 'tokyo-night-theme',
      name: 'Tokyo Night Theme',
      version: '1.0.0',
      author: 'Xplorer Team',
      description: 'A beautiful dark theme inspired by Tokyo Night',
      keywords: ['theme', 'dark', 'tokyo', 'night'],
      icon: '🌃',
    });
  }

  getTheme() {
    return {
      name: 'Tokyo Night',
      displayName: 'Tokyo Night',
      type: 'dark' as const,
      colors: {
        // Core colors - Tokyo Night palette
        primary: '#7aa2f7', // Blue
        secondary: '#bb9af7', // Purple
        accent: '#73daca', // Cyan

        // Background colors
        background: '#1a1b26', // Dark background
        surface: '#24283b', // Slightly lighter surface
        overlay: '#414868', // Overlay background

        // Text colors
        text: '#c0caf5', // Main text (light blue-white)
        textSecondary: '#9aa5ce', // Secondary text
        textMuted: '#565f89', // Muted text

        // UI colors
        border: '#414868', // Border color
        hover: '#2f3349', // Hover state
        selected: '#364a82', // Selected state
        focus: '#7aa2f7', // Focus ring

        // Status colors
        success: '#9ece6a', // Green
        warning: '#e0af68', // Yellow
        error: '#f7768e', // Red
        info: '#7dcfff', // Light blue

        // File type colors
        fileColors: {
          folder: '#7aa2f7', // Blue for folders
          document: '#c0caf5', // Default text color
          image: '#bb9af7', // Purple for images
          video: '#f7768e', // Red for videos
          audio: '#73daca', // Cyan for audio
          archive: '#e0af68', // Yellow for archives
          code: '#9ece6a', // Green for code
          executable: '#ff9e64', // Orange for executables
        },
      },
      fonts: {
        main: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        mono: 'JetBrains Mono, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        ui: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        md: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
        lg: '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
      },
      animations: {
        duration: {
          fast: '150ms',
          normal: '250ms',
          slow: '350ms',
        },
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    };
  }

  getThemeVariants() {
    const baseTheme = this.getTheme();

    return {
      storm: {
        ...baseTheme,
        name: 'Tokyo Night Storm',
        displayName: 'Tokyo Night Storm',
        colors: {
          ...baseTheme.colors,
          background: '#24283b', // Storm variant background
          surface: '#2d3348', // Lighter surface for storm
        },
      },
      light: {
        ...baseTheme,
        name: 'Tokyo Night Light',
        displayName: 'Tokyo Night Light',
        type: 'light' as const,
        colors: {
          // Light variant colors
          primary: '#3760bf',
          secondary: '#8f5c99',
          accent: '#166775',

          background: '#d5d6db',
          surface: '#e1e2e7',
          overlay: '#c4c8da',

          text: '#343b58',
          textSecondary: '#565a6e',
          textMuted: '#8990b3',

          border: '#c4c8da',
          hover: '#cccdd7',
          selected: '#b6bcf0',
          focus: '#3760bf',

          success: '#485e30',
          warning: '#8f5e15',
          error: '#c64343',
          info: '#0f4b6e',

          fileColors: {
            folder: '#3760bf',
            document: '#343b58',
            image: '#8f5c99',
            video: '#c64343',
            audio: '#166775',
            archive: '#8f5e15',
            code: '#485e30',
            executable: '#b15c00',
          },
        },
      },
    };
  }

  getCustomCSS() {
    return `
      /* Tokyo Night custom scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: #1a1b26;
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #414868;
        border-radius: 4px;
        border: 1px solid #24283b;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: #565f89;
      }
      
      /* Custom selection colors */
      ::selection {
        background: #364a82;
        color: #c0caf5;
      }
      
      /* Tokyo Night specific animations */
      @keyframes xp-glow {
        0% { box-shadow: 0 0 5px #7aa2f7; }
        50% { box-shadow: 0 0 20px #7aa2f7, 0 0 30px #7aa2f7; }
        100% { box-shadow: 0 0 5px #7aa2f7; }
      }
      
      .tokyo-night-glow {
        animation: xp-glow 2s ease-in-out infinite;
      }
    `;
  }
}
