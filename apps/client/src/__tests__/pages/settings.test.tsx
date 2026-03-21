import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock wouter (already mocked globally, but we override for fine-grained control)
const mockSetLocation = vi.fn();
vi.mock('wouter', async () => {
  const React = await import('react');
  return {
    useLocation: vi.fn(() => ['/settings', mockSetLocation]),
    Route: ({ children }: { children: React.ReactNode }) => children,
    Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
      React.createElement('a', { href }, children),
  };
});

// Shared mock prop types for Radix UI
type MockProps = Record<string, unknown> & { children?: React.ReactNode };
type MockRef = React.Ref<HTMLElement>;

// Mock the radix-ui select so we can test theme/font-size interactions
vi.mock('@radix-ui/react-select', async () => {
  const React = await import('react');
  return {
    Root: ({ children, value }: MockProps) =>
      React.createElement('div', { 'data-testid': `select-root-${value}` }, children),
    Trigger: React.forwardRef(({ children, className, ...props }: MockProps, ref: MockRef) =>
      React.createElement('button', { ...props, ref, className }, children),
    ),
    Value: ({ children, placeholder }: MockProps) =>
      React.createElement('span', {}, children || (placeholder as string)),
    Content: ({ children }: MockProps) => React.createElement('div', {}, children),
    Item: React.forwardRef(({ children, value, ...props }: MockProps, ref: MockRef) =>
      React.createElement('option', { ...props, ref, value: value as string }, children),
    ),
    Icon: ({ children }: MockProps) => React.createElement('span', {}, children),
    Viewport: ({ children }: MockProps) => React.createElement('div', {}, children),
    ItemIndicator: ({ children }: MockProps) => React.createElement('span', {}, children),
    ItemText: ({ children }: MockProps) => React.createElement('span', {}, children),
    ScrollUpButton: React.forwardRef((props: MockProps, ref: MockRef) =>
      React.createElement('button', { ...props, ref }),
    ),
    ScrollDownButton: React.forwardRef((props: MockProps, ref: MockRef) =>
      React.createElement('button', { ...props, ref }),
    ),
    Portal: ({ children }: MockProps) => children,
    Group: ({ children }: MockProps) => React.createElement('div', {}, children),
    Label: ({ children }: MockProps) => React.createElement('span', {}, children),
    Separator: () => React.createElement('hr'),
  };
});

// Mock theme-registry
vi.mock('@/lib/theme-registry', () => ({
  useAllThemes: vi.fn(() => ({
    glass: {
      name: 'Xplorer Glass',
      primary: '#7c3aed',
      bg: '#0a0a1a',
      surface: '#1a1a2e',
      text: '#e2e8f0',
    },
    'tokyo-night': {
      name: 'Tokyo Night',
      primary: '#7aa2f7',
      bg: '#1a1b26',
      surface: '#24283b',
      text: '#c0caf5',
    },
    dracula: {
      name: 'Dracula',
      primary: '#bd93f9',
      bg: '#282a36',
      surface: '#44475a',
      text: '#f8f8f2',
    },
  })),
}));

// Mock agent-service
vi.mock('@/lib/agent-service', () => ({
  AgentService: {
    getSettings: vi.fn(() =>
      Promise.resolve({
        enabled: true,
        api_key: '',
        openai_api_key: '',
        model: 'claude-sonnet-4-6',
        max_turns: 25,
        auto_approve: false,
        thinking_enabled: false,
        thinking_budget: 10000,
      }),
    ),
    updateSettings: vi.fn(() => Promise.resolve()),
    getPermissions: vi.fn(() =>
      Promise.resolve({
        disabled_tools: [],
        auto_approve_tools: [],
        allowed_paths: [],
        blocked_paths: [],
        custom_blocked_commands: [],
        block_internet: true,
      }),
    ),
    updatePermissions: vi.fn(() => Promise.resolve()),
  },
}));

// Mock vim-mode hooks
vi.mock('@/hooks/use-vim-mode', () => ({
  isVimModeEnabled: vi.fn(() => false),
  setVimModeSetting: vi.fn(),
  isVimLearningModeEnabled: vi.fn(() => false),
  setVimLearningModeSetting: vi.fn(),
}));

// Mock tour hooks
vi.mock('@/hooks/use-tour', () => ({
  startTour: vi.fn(),
  resetTourCompleted: vi.fn(),
}));

// Mock beta warning dialog
vi.mock('@/components/dialogs/BetaWarningDialog', () => ({
  resetBetaWarning: vi.fn(),
}));

// Mock heavy sub-components that are not the focus of this test
vi.mock('@/components/TokenizerSettings', () => ({
  default: () => <div data-testid="tokenizer-settings">Tokenizer Settings</div>,
}));

vi.mock('@/components/KeyboardShortcutsSettings', () => ({
  default: () => <div data-testid="keyboard-shortcuts-settings">Keyboard Shortcuts Settings</div>,
}));

vi.mock('@/components/settings/BackupRestoreSettings', () => ({
  default: () => <div data-testid="backup-restore-settings">Backup Restore Settings</div>,
}));

vi.mock('@/components/settings/AuditLogSettings', () => ({
  default: () => <div data-testid="audit-log-settings">Audit Log Settings</div>,
}));

vi.mock('@/components/settings/VersioningSettings', () => ({
  default: () => <div data-testid="versioning-settings">Versioning Settings</div>,
}));

vi.mock('@/components/settings/ContextMenuRulesCard', () => ({
  default: () => <div data-testid="context-menu-rules">Context Menu Rules</div>,
}));

import Settings from '@/pages/settings';

/** Helper to click a sidebar tab by label text */
const clickSidebarTab = (label: string) => {
  // The sidebar is inside a <nav> element
  const nav = document.querySelector('nav')!;
  const navSection = within(nav);
  const tabButton = navSection.getByText(label).closest('button')!;
  fireEvent.click(tabButton);
};

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Page Layout', () => {
    it('renders the Settings heading', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
      });
    });

    it('renders the subtitle text', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Customize your Xplorer experience')).toBeInTheDocument();
      });
    });

    it('renders a back button with title', async () => {
      render(<Settings />);

      await waitFor(() => {
        const backBtn = screen.getByTitle('Back to Home');
        expect(backBtn).toBeInTheDocument();
      });
    });

    it('navigates home when back button is clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        const backBtn = screen.getByTitle('Back to Home');
        fireEvent.click(backBtn);
        expect(mockSetLocation).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Navigation Sidebar', () => {
    it('renders all settings tabs in the sidebar', async () => {
      render(<Settings />);

      const nav = document.querySelector('nav')!;
      const navSection = within(nav);

      await waitFor(() => {
        expect(navSection.getByText('General')).toBeInTheDocument();
        expect(navSection.getByText('File Explorer')).toBeInTheDocument();
        expect(navSection.getByText('Context Menu')).toBeInTheDocument();
        expect(navSection.getByText('AI Agent')).toBeInTheDocument();
        expect(navSection.getByText('Permissions')).toBeInTheDocument();
        expect(navSection.getByText('Indexing')).toBeInTheDocument();
        expect(navSection.getByText('Shortcuts')).toBeInTheDocument();
        expect(navSection.getByText('Marketplace')).toBeInTheDocument();
        expect(navSection.getByText('Accessibility')).toBeInTheDocument();
        expect(navSection.getByText('Backup & Restore')).toBeInTheDocument();
        expect(navSection.getByText('Audit Log')).toBeInTheDocument();
        expect(navSection.getByText('Versioning')).toBeInTheDocument();
      });
    });

    it('shows tab descriptions in the sidebar', async () => {
      render(<Settings />);

      const nav = document.querySelector('nav')!;
      const navSection = within(nav);

      await waitFor(() => {
        expect(navSection.getByText('Appearance, layout & system')).toBeInTheDocument();
        expect(navSection.getByText('Views & file display')).toBeInTheDocument();
        expect(navSection.getByText('Claude integration')).toBeInTheDocument();
      });
    });

    it('defaults to General tab as active', async () => {
      render(<Settings />);

      // The main content heading for the active tab
      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByRole('heading', { level: 2 })).toHaveTextContent('General');
      });
    });
  });

  describe('Tab Navigation', () => {
    it('switches to File Explorer tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('File Explorer');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Default View')).toBeInTheDocument();
        expect(mainSection.getByText('Show Hidden Files')).toBeInTheDocument();
      });
    });

    it('switches to AI Agent tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('AI Agent');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Enable Agent')).toBeInTheDocument();
        expect(mainSection.getByText('Auto-Approve Actions')).toBeInTheDocument();
      });
    });

    it('switches to Accessibility tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Accessibility');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Reduce Motion')).toBeInTheDocument();
        expect(mainSection.getByText('Enhanced Focus Indicators')).toBeInTheDocument();
      });
    });

    it('switches to Shortcuts tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Shortcuts');

      await waitFor(() => {
        expect(screen.getByText('Vim Mode')).toBeInTheDocument();
        expect(screen.getByTestId('keyboard-shortcuts-settings')).toBeInTheDocument();
      });
    });

    it('switches to Indexing tab and shows TokenizerSettings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Indexing');

      await waitFor(() => {
        expect(screen.getByTestId('tokenizer-settings')).toBeInTheDocument();
      });
    });

    it('switches to Marketplace tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Marketplace');

      await waitFor(() => {
        expect(screen.getByText('Marketplace API URL')).toBeInTheDocument();
      });
    });

    it('switches to Context Menu tab when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Context Menu');

      await waitFor(() => {
        expect(screen.getByTestId('context-menu-rules')).toBeInTheDocument();
      });
    });

    it('switches to Backup tab and shows BackupRestoreSettings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Backup & Restore');

      await waitFor(() => {
        expect(screen.getByTestId('backup-restore-settings')).toBeInTheDocument();
      });
    });

    it('switches to Audit Log tab and shows AuditLogSettings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Audit Log');

      await waitFor(() => {
        expect(screen.getByTestId('audit-log-settings')).toBeInTheDocument();
      });
    });

    it('switches to Versioning tab and shows VersioningSettings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Versioning');

      await waitFor(() => {
        expect(screen.getByTestId('versioning-settings')).toBeInTheDocument();
      });
    });
  });

  describe('General Tab - Settings Controls', () => {
    it('renders the Theme setting row', async () => {
      render(<Settings />);

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Theme')).toBeInTheDocument();
        expect(mainSection.getByText('Color scheme for the application')).toBeInTheDocument();
      });
    });

    it('renders the Font Size setting row', async () => {
      render(<Settings />);

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Font Size')).toBeInTheDocument();
        expect(mainSection.getByText('Base font size across the UI')).toBeInTheDocument();
      });
    });

    it('renders Animations toggle with correct initial state', async () => {
      render(<Settings />);

      await waitFor(() => {
        const animToggle = document.getElementById('animations') as HTMLButtonElement;
        expect(animToggle).toBeInTheDocument();
        expect(animToggle.getAttribute('aria-checked')).toBe('true');
      });
    });

    it('renders the Sidebar Width setting', async () => {
      render(<Settings />);

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Sidebar Width')).toBeInTheDocument();
      });
    });

    it('renders the Notifications toggle', async () => {
      render(<Settings />);

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Notifications')).toBeInTheDocument();
      });
    });

    it('renders the Auto Save toggle', async () => {
      render(<Settings />);

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Auto Save')).toBeInTheDocument();
      });
    });

    it('renders the Replay Tour button', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Replay Tour')).toBeInTheDocument();
      });
    });

    it('renders the Show Warning button for beta warning', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Show Warning')).toBeInTheDocument();
      });
    });

    it('renders the Reset button', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Reset all settings to defaults')).toBeInTheDocument();
      });
    });
  });

  describe('General Tab - Toggle Interactions', () => {
    it('toggles Animations setting when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        const animToggle = document.getElementById('animations') as HTMLButtonElement;
        expect(animToggle).toBeInTheDocument();
      });

      const animToggle = document.getElementById('animations') as HTMLButtonElement;
      // Initially true (checked)
      expect(animToggle.getAttribute('aria-checked')).toBe('true');

      // Click to toggle off
      fireEvent.click(animToggle);

      // After click: the component re-renders with the new value
      await waitFor(() => {
        const updatedToggle = document.getElementById('animations') as HTMLButtonElement;
        expect(updatedToggle.getAttribute('aria-checked')).toBe('false');
      });
    });

    it('toggles Notifications setting when clicked', async () => {
      render(<Settings />);

      await waitFor(() => {
        const notifToggle = document.getElementById('notifications') as HTMLButtonElement;
        expect(notifToggle).toBeInTheDocument();
      });

      const notifToggle = document.getElementById('notifications') as HTMLButtonElement;
      expect(notifToggle.getAttribute('aria-checked')).toBe('true');

      fireEvent.click(notifToggle);

      await waitFor(() => {
        const updatedToggle = document.getElementById('notifications') as HTMLButtonElement;
        expect(updatedToggle.getAttribute('aria-checked')).toBe('false');
      });
    });
  });

  describe('File Explorer Tab', () => {
    it('renders file explorer settings when that tab is active', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('File Explorer');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Default View')).toBeInTheDocument();
        expect(mainSection.getByText('Show Hidden Files')).toBeInTheDocument();
        expect(mainSection.getByText('File Extensions')).toBeInTheDocument();
        expect(mainSection.getByText('Auto-Calculate Folder Sizes')).toBeInTheDocument();
        expect(mainSection.getByText('Markdown Preview')).toBeInTheDocument();
      });
    });

    it('toggles Show Hidden Files', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('File Explorer');

      await waitFor(() => {
        const toggle = document.getElementById('hiddenFiles') as HTMLButtonElement;
        expect(toggle).toBeInTheDocument();
      });

      const toggle = document.getElementById('hiddenFiles') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);

      await waitFor(() => {
        const updatedToggle = document.getElementById('hiddenFiles') as HTMLButtonElement;
        expect(updatedToggle.getAttribute('aria-checked')).toBe('true');
      });
    });
  });

  describe('Accessibility Tab', () => {
    it('renders accessibility settings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Accessibility');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Reduce Motion')).toBeInTheDocument();
        expect(mainSection.getByText('Enhanced Focus Indicators')).toBeInTheDocument();
      });
    });

    it('toggles Reduce Motion setting', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Accessibility');

      await waitFor(() => {
        const toggle = document.getElementById('reducedMotion') as HTMLButtonElement;
        expect(toggle).toBeInTheDocument();
      });

      const toggle = document.getElementById('reducedMotion') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);

      await waitFor(() => {
        const updatedToggle = document.getElementById('reducedMotion') as HTMLButtonElement;
        expect(updatedToggle.getAttribute('aria-checked')).toBe('true');
      });
    });
  });

  describe('Permissions Tab', () => {
    it('renders permissions settings with tool listings', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Permissions');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Block Internet Access')).toBeInTheDocument();
        expect(mainSection.getByText('Read Tools')).toBeInTheDocument();
        expect(mainSection.getByText('Write Tools')).toBeInTheDocument();
      });
    });

    it('lists individual read tools', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Permissions');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        expect(mainSection.getByText('Read File')).toBeInTheDocument();
        expect(mainSection.getByText('List Directory')).toBeInTheDocument();
        expect(mainSection.getByText('Search Files')).toBeInTheDocument();
      });
    });

    it('lists individual write tools', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(document.querySelector('nav')).toBeInTheDocument();
      });

      clickSidebarTab('Permissions');

      const mainContent = document.querySelector('main')!;
      const mainSection = within(mainContent);

      await waitFor(() => {
        // Use getAllByText since some labels appear in both tool list and auto-approve list
        const writeFileElements = mainSection.getAllByText('Write File');
        expect(writeFileElements.length).toBeGreaterThanOrEqual(1);

        const createDirElements = mainSection.getAllByText('Create Directory');
        expect(createDirElements.length).toBeGreaterThanOrEqual(1);

        expect(mainSection.getAllByText('Rename').length).toBeGreaterThanOrEqual(1);
        expect(mainSection.getAllByText('Execute Command').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('LocalStorage Persistence', () => {
    it('saves settings to localStorage when changed', async () => {
      render(<Settings />);

      await waitFor(() => {
        const animToggle = document.getElementById('animations') as HTMLButtonElement;
        expect(animToggle).toBeInTheDocument();
      });

      const animToggle = document.getElementById('animations') as HTMLButtonElement;
      fireEvent.click(animToggle);

      // Wait for useEffect to persist
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem('xplorer:settings') || '{}');
        expect(saved.enableAnimations).toBe(false);
      });
    });

    it('loads saved settings from localStorage on mount', async () => {
      localStorage.setItem(
        'xplorer:settings',
        JSON.stringify({
          theme: 'tokyo-night',
          showHiddenFiles: true,
          enableMarkdownPreview: true,
          defaultView: 'list',
          enableAnimations: false,
          showFileExtensions: true,
          enableNotifications: false,
          autoSave: true,
          fontSize: 'large',
          sidebarWidth: 'wide',
          reducedMotion: false,
          enhancedFocus: false,
          autoCalculateFolderSizes: false,
        }),
      );

      render(<Settings />);

      await waitFor(() => {
        // Animations should be off because we set it to false
        const animToggle = document.getElementById('animations') as HTMLButtonElement;
        expect(animToggle.getAttribute('aria-checked')).toBe('false');

        // Notifications should be off
        const notifToggle = document.getElementById('notifications') as HTMLButtonElement;
        expect(notifToggle.getAttribute('aria-checked')).toBe('false');
      });
    });
  });
});
