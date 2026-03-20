import { Theme } from '@xplorer/extension-sdk';

Theme.register({
  id: 'cyberpunk',
  name: 'Cyberpunk',
  background: 'linear-gradient(145deg, #0a0a0f 0%, #0d0815 30%, #130a18 60%, #0a0a0f 100%)',
  colors: {
    bg: '#0a0a0f',
    surface: '#151520',
    surfaceLight: '#1e1e2d',
    border: '#2a2a3a',
    borderLight: '#3a3a4a',
    text: '#e8e6e3',
    textMuted: '#8a8a9a',
    textSecondary: '#6b6b7b',
    blue: '#00fff0',
    blueDark: '#00c8c0',
    green: '#39ff14',
    orange: '#ff6b00',
    pink: '#ff2d95',
    red: '#ff003c',
    yellow: '#f0e130',
    cyan: '#00fff0',
    purple: '#b026ff',
  },
  css: `
.theme-cyberpunk .file-item.selected {
  background-color: rgba(240, 225, 48, 0.15);
  border: 1px solid rgba(240, 225, 48, 0.4);
  box-shadow: 0 0 15px rgba(240, 225, 48, 0.1), inset 0 0 15px rgba(240, 225, 48, 0.05);
}
.theme-cyberpunk .sidebar-item.active {
  background-color: rgba(0, 255, 240, 0.15);
  text-shadow: 0 0 8px rgba(0, 255, 240, 0.5);
}
.theme-cyberpunk .tab-item.active { border-bottom-color: #f0e130; box-shadow: 0 2px 8px rgba(240, 225, 48, 0.3); }
.theme-cyberpunk ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #f0e130, #00fff0); border-radius: 4px; }
.theme-cyberpunk ::selection { background-color: rgba(240, 225, 48, 0.3); color: #ffffff; }
`,
});
