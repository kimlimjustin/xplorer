import { Theme } from '@xplorer/extension-sdk';

Theme.register({
  id: 'ocean-deep',
  name: 'Ocean Deep',
  background: 'linear-gradient(180deg, #071422 0%, #0a1a2e 40%, #0d2035 70%, #071422 100%)',
  colors: {
    bg: '#071422',
    surface: '#0d1f30',
    surfaceLight: '#142a3d',
    border: '#1a3348',
    borderLight: '#254560',
    text: '#c8e0f0',
    textMuted: '#7aa0b8',
    textSecondary: '#5a7a8f',
    blue: '#00b8d4',
    blueDark: '#0090a8',
    green: '#00e5a0',
    orange: '#ff9248',
    pink: '#ff6baa',
    red: '#ff6b6b',
    yellow: '#ffd166',
    cyan: '#4ee8e0',
    purple: '#8b6bff',
  },
  css: `
.theme-ocean-deep .file-item.selected {
  background-color: rgba(0, 184, 212, 0.15);
  border: 1px solid rgba(0, 184, 212, 0.3);
  box-shadow: 0 0 15px rgba(0, 184, 212, 0.1);
}
.theme-ocean-deep .sidebar-item.active { background-color: rgba(0, 184, 212, 0.2); }
.theme-ocean-deep .tab-item.active { border-bottom-color: #00b8d4; box-shadow: 0 2px 8px rgba(0, 184, 212, 0.2); }
.theme-ocean-deep ::-webkit-scrollbar-thumb { background: #1a3348; border-radius: 4px; }
.theme-ocean-deep ::selection { background-color: rgba(0, 184, 212, 0.3); }
`,
});
