import React from 'react';
import ActivityFeedPanel from './ActivityFeedPanel';
import { useActivityFeed } from '@/hooks/use-activity-feed';

const ActivityFeedWrapper = ({ onNavigate }: { onNavigate?: (path: string) => void }) => {
  const feed = useActivityFeed();
  return (
    <ActivityFeedPanel
      entries={feed.entries}
      filteredEntries={feed.filteredEntries}
      activeFilter={feed.activeFilter}
      setActiveFilter={feed.setActiveFilter}
      isPaused={feed.isPaused}
      togglePause={feed.togglePause}
      clearFeed={feed.clearFeed}
      onNavigate={onNavigate}
    />
  );
};

export default ActivityFeedWrapper;
