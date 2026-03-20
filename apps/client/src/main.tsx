import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';

// Expose React on window so extensions loaded via new Function() can access it
(window as unknown as Record<string, unknown>).React = React;
(window as unknown as Record<string, unknown>).ReactDOM = ReactDOM;

// Expose the Extension SDK so extensions can import from '@xplorer/extension-sdk'
import * as XplorerSDK from '@xplorer/extension-sdk';
(window as unknown as Record<string, unknown>).XplorerSDK = XplorerSDK;

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

createRoot(document.getElementById('root')!).render(<App />);
