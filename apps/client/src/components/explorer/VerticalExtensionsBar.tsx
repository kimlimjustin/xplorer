import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { extensionHost } from '@/lib/extension-host';
import { Eye, Search, Puzzle, ShoppingCart, Settings, Activity } from 'lucide-react';

interface VerticalExtensionsBarProps {
  rightPanelTab: string;
  setRightPanelTab: (tab: string) => void;
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  'data-tour'?: string;
}

const VerticalExtensionsBar = ({
  rightPanelTab,
  setRightPanelTab,
  rightSidebarCollapsed,
  setRightSidebarCollapsed,
  'data-tour': dataTour,
}: VerticalExtensionsBarProps) => {
  const [, setLocation] = useLocation();
  const [, forceUpdate] = useState(0);

  // Re-render when extension host changes (panels added/removed/toggled)
  useEffect(() => {
    const unsubscribe = extensionHost.onChange(() => {
      forceUpdate((n) => n + 1);
    });
    return unsubscribe;
  }, []);

  // Dynamic panels from extension host
  const registeredPanels = extensionHost.getRegisteredPanels();

  // Core panels (always shown, part of the app core)
  const corePanels = [
    { id: 'preview', icon: <Eye size={18} />, label: 'File Preview' },
    { id: 'tokenizer', icon: <Search size={18} />, label: 'Content Search' },
  ];

  // System panels (always shown, not extension-managed)
  const systemPanels = [
    { id: 'performance', icon: <Activity size={18} />, label: 'Performance' },
    { id: 'extensions', icon: <Puzzle size={18} />, label: 'Extensions' },
    { id: 'marketplace', icon: <ShoppingCart size={18} />, label: 'Marketplace' },
  ];

  const handlePanelClick = (id: string) => {
    setRightPanelTab(id);
    if (rightSidebarCollapsed) {
      setRightSidebarCollapsed(false);
    }
  };

  const btnClass = (id: string) =>
    `w-10 h-10 mx-1 mb-1 rounded flex items-center justify-center text-lg transition-colors ${
      rightPanelTab === id && !rightSidebarCollapsed
        ? 'bg-xp-blue text-white'
        : 'hover:bg-xp-surface-light'
    }`;

  return (
    <div
      data-tour={dataTour}
      className="w-12 bg-xp-surface border-l border-xp-border flex flex-col"
    >
      <div className="flex flex-col py-2">
        {/* Core panels (always available) */}
        {corePanels.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => handlePanelClick(id)}
            className={btnClass(id)}
            title={label}
          >
            {icon}
          </button>
        ))}

        {/* Separator between core and extension panels */}
        {registeredPanels.length > 0 && (
          <div className="mx-2 my-1 border-t border-xp-border" />
        )}

        {/* Extension-managed panel icons */}
        {registeredPanels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => handlePanelClick(panel.id)}
            className={btnClass(panel.id)}
            title={panel.title}
          >
            {panel.icon}
          </button>
        ))}

        {/* Separator before system panels */}
        <div className="mx-2 my-1 border-t border-xp-border" />

        {/* System panels */}
        {systemPanels.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => handlePanelClick(id)}
            className={btnClass(id)}
            title={label}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Settings */}
      <div className="p-2 border-t border-xp-border">
        <button
          onClick={() => setLocation('/settings')}
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-xp-surface-light"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}

export default VerticalExtensionsBar;
