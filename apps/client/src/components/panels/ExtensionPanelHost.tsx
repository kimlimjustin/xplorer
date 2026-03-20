import React from 'react';
import { extensionHost } from '@/lib/extension-host';

interface ExtensionPanelHostProps {
  panelId: string;
  builtinProps?: Record<string, unknown>;
}

const ExtensionPanelHost = ({ panelId, builtinProps }: ExtensionPanelHostProps) => {
  const panel = extensionHost.getPanel(panelId);

  if (!panel) {
    return <div className="p-4 text-sm text-xp-text-muted">Panel not found: {panelId}</div>;
  }

  try {
    return panel.render(builtinProps || {});
  } catch (err) {
    return (
      <div className="p-4 text-sm text-red-400">
        Error rendering panel "{panel.title}": {String(err)}
      </div>
    );
  }
}

export default ExtensionPanelHost;
