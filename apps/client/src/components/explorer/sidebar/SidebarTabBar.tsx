import React from 'react';
import { FolderTree, Search } from 'lucide-react';

interface SidebarTab {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface SidebarTabBarProps {
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  extensionTabs: SidebarTab[];
}

const TAB_CLASS_ACTIVE = 'bg-xp-blue/15 text-xp-blue';
const TAB_CLASS_INACTIVE = 'text-xp-text-muted hover:bg-xp-surface-light hover:text-xp-text';

const SidebarTabBar = ({ activeTabId, onTabClick, extensionTabs }: SidebarTabBarProps) => {
  const tabClass = (tabId: string) =>
    `flex items-center justify-center rounded transition-colors ${
      activeTabId === tabId ? TAB_CLASS_ACTIVE : TAB_CLASS_INACTIVE
    }`;

  return (
    <div
      className="border-xp-border border-b"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        gap: '2px',
        flexShrink: 0,
      }}
      role="tablist"
      aria-label="Sidebar tabs"
    >
      {/* Explorer tab */}
      <button
        role="tab"
        onClick={() => onTabClick('__explorer__')}
        className={tabClass('__explorer__')}
        style={{ width: 28, height: 28, padding: 0 }}
        aria-label="File explorer"
        aria-selected={activeTabId === '__explorer__'}
        title="File Explorer"
      >
        <FolderTree size={15} />
      </button>

      {/* Search tab */}
      <button
        role="tab"
        onClick={() => onTabClick('__search__')}
        className={tabClass('__search__')}
        style={{ width: 28, height: 28, padding: 0 }}
        aria-label="Search files (Ctrl+Shift+F)"
        aria-selected={activeTabId === '__search__'}
        title="Search (Ctrl+Shift+F)"
      >
        <Search size={15} />
      </button>

      {/* Extension-registered sidebar tabs */}
      {extensionTabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          onClick={() => onTabClick(tab.id)}
          className={tabClass(tab.id)}
          style={{ width: 28, height: 28, padding: 0 }}
          aria-label={tab.title}
          aria-selected={activeTabId === tab.id}
          title={tab.title}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
};

export default SidebarTabBar;
