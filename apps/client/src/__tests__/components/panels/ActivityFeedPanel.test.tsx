import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityFeedPanel from '@/components/panels/ActivityFeedPanel';
import type { ActivityEntry, ActivityFilter } from '@/hooks/use-activity-feed';

describe('ActivityFeedPanel', () => {
  const now = Date.now();

  const sampleEntries: ActivityEntry[] = [
    {
      id: 'act-1',
      type: 'created',
      path: 'C:\\Projects\\src\\new-file.ts',
      name: 'new-file.ts',
      timestamp: now - 10_000, // 10 seconds ago = "just now"
    },
    {
      id: 'act-2',
      type: 'modified',
      path: 'C:\\Projects\\src\\index.ts',
      name: 'index.ts',
      timestamp: now - 120_000, // 2 minutes ago = "last 5 minutes"
    },
    {
      id: 'act-3',
      type: 'deleted',
      path: 'C:\\Projects\\old-file.js',
      name: 'old-file.js',
      timestamp: now - 600_000, // 10 minutes ago = "last 30 minutes"
    },
    {
      id: 'act-4',
      type: 'renamed',
      path: 'C:\\Projects\\src\\renamed.ts',
      name: 'renamed.ts',
      oldPath: 'C:\\Projects\\src\\old-name.ts',
      timestamp: now - 2_000_000, // ~33 minutes ago = "earlier today"
    },
  ];

  const defaultProps = {
    entries: sampleEntries,
    filteredEntries: sampleEntries,
    activeFilter: 'all' as ActivityFilter,
    setActiveFilter: vi.fn(),
    isPaused: false,
    togglePause: vi.fn(),
    clearFeed: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders filter chips', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
      expect(screen.getByText('Deleted')).toBeInTheDocument();
      expect(screen.getByText('Renamed')).toBeInTheDocument();
    });

    it('renders activity entries', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByText('new-file.ts')).toBeInTheDocument();
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('old-file.js')).toBeInTheDocument();
      expect(screen.getByText('renamed.ts')).toBeInTheDocument();
    });

    it('shows time bucket headers', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByText('Just Now')).toBeInTheDocument();
      expect(screen.getByText('Last 5 minutes')).toBeInTheDocument();
      expect(screen.getByText('Last 30 minutes')).toBeInTheDocument();
      expect(screen.getByText('Earlier today')).toBeInTheDocument();
    });

    it('shows relative timestamps', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      // Check that relative time text elements exist (e.g., "10s ago", "2m ago")
      const secondsAgo = screen.getAllByText(/\ds ago/);
      expect(secondsAgo.length).toBeGreaterThanOrEqual(1);
      const minutesAgo = screen.getAllByText(/\dm ago/);
      expect(minutesAgo.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "from oldname" for renamed entries', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByText('from old-name.ts')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no entries', () => {
      render(<ActivityFeedPanel {...defaultProps} entries={[]} filteredEntries={[]} />);
      expect(screen.getByText('No activity recorded yet')).toBeInTheDocument();
    });
  });

  describe('Filter chips', () => {
    it('calls setActiveFilter when clicking a filter', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Created'));
      expect(defaultProps.setActiveFilter).toHaveBeenCalledWith('created');
    });

    it('calls setActiveFilter with modified filter', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Modified'));
      expect(defaultProps.setActiveFilter).toHaveBeenCalledWith('modified');
    });
  });

  describe('Pause/Resume', () => {
    it('renders pause button when not paused', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByTitle('Pause feed')).toBeInTheDocument();
    });

    it('renders resume button when paused', () => {
      render(<ActivityFeedPanel {...defaultProps} isPaused={true} />);
      expect(screen.getByTitle('Resume feed')).toBeInTheDocument();
    });

    it('calls togglePause when pause button is clicked', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Pause feed'));
      expect(defaultProps.togglePause).toHaveBeenCalled();
    });

    it('shows paused banner when paused', () => {
      render(<ActivityFeedPanel {...defaultProps} isPaused={true} />);
      expect(screen.getByText(/Feed paused — entries are being collected/)).toBeInTheDocument();
    });

    it('does not show paused banner when not paused', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(
        screen.queryByText(/Feed paused — entries are being collected/),
      ).not.toBeInTheDocument();
    });
  });

  describe('Clear feed', () => {
    it('renders clear button', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      expect(screen.getByTitle('Clear activity feed')).toBeInTheDocument();
    });

    it('calls clearFeed when clear button is clicked', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Clear activity feed'));
      expect(defaultProps.clearFeed).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('calls onNavigate when clicking a non-deleted entry', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      // Click on the created entry
      fireEvent.click(screen.getByText('new-file.ts'));
      expect(defaultProps.onNavigate).toHaveBeenCalled();
    });
  });

  describe('Bucket counts', () => {
    it('shows entry count in each bucket header', () => {
      render(<ActivityFeedPanel {...defaultProps} />);
      // Each bucket has 1 entry, so multiple "(1)" spans exist
      const counts = screen.getAllByText('(1)');
      expect(counts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
