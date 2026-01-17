/**
 * Contributors Panel - Shows contributor statistics and charts.
 *
 * Uses useDeferredValue to keep UI controls responsive while expensive
 * chart/list re-renders happen in the background.
 *
 * Limits displayed contributors to batches of 100 (with "Show more" button)
 * to keep DOM size manageable for large repos.
 */

import { useState, useEffect, useDeferredValue, useCallback } from 'react';
import { useStore, selectFilteredContributors, selectTimeRangeWeeks } from '../../store';
import { ContributorCard } from './ContributorCard';
import { CommitsChart } from './CommitsChart';
import { TimeRangeSlider } from './TimeRangeSlider';
import { GranularityToggle } from './GranularityToggle';
import './ContributorsPanel.css';

const INITIAL_DISPLAY_COUNT = 100;
const LOAD_MORE_COUNT = 50;

export function ContributorsPanel() {
  const data = useStore((state) => state.data);

  // Get current values from store
  const contributors = useStore(selectFilteredContributors);
  const timeRangeWeeks = useStore(selectTimeRangeWeeks);
  const contributorGranularity = useStore((state) => state.contributorGranularity);

  // Defer expensive data - React will show stale values while computing new ones
  // This keeps the UI controls (slider, toggle) responsive
  const deferredContributors = useDeferredValue(contributors);
  const deferredTimeRangeWeeks = useDeferredValue(timeRangeWeeks);
  const deferredGranularity = useDeferredValue(contributorGranularity);

  // Pagination: how many contributors to display
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Reset display count when filtered contributors change significantly
  // (e.g., new time range selected that reduces total count)
  useEffect(() => {
    if (deferredContributors.length <= INITIAL_DISPLAY_COUNT) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [deferredContributors.length]);

  const handleShowMore = useCallback(() => {
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  }, []);

  if (!data) {return null;}

  // Show a subtle indicator when data is stale (optional visual feedback)
  const isStale = contributors !== deferredContributors ||
                  timeRangeWeeks !== deferredTimeRangeWeeks ||
                  contributorGranularity !== deferredGranularity;

  // Slice contributors to only render what we need
  const visibleContributors = deferredContributors.slice(0, displayCount);
  const hasMore = deferredContributors.length > displayCount;
  const remainingCount = deferredContributors.length - displayCount;

  return (
    <div className={`contributors-panel ${isStale ? 'updating' : ''}`}>
      <div className="panel-header">
        <h2>Contributors ({deferredContributors.length})</h2>
        <div className="panel-controls">
          <GranularityToggle />
          <TimeRangeSlider />
        </div>
      </div>

      <div className="commits-chart-container">
        <h3>Commits Over Time</h3>
        <CommitsChart contributors={deferredContributors} granularity={deferredGranularity} />
      </div>

      <div className="contributors-grid">
        {visibleContributors.map((contributor, index) => (
          <ContributorCard
            key={contributor.email}
            contributor={contributor}
            rank={index + 1}
            timeRangeWeeks={deferredTimeRangeWeeks}
            granularity={deferredGranularity}
          />
        ))}
      </div>

      {hasMore && (
        <div className="show-more-container">
          <button className="show-more-btn" onClick={handleShowMore}>
            Show more ({Math.min(remainingCount, LOAD_MORE_COUNT)} of {remainingCount} remaining)
          </button>
        </div>
      )}

      {deferredContributors.length === 0 && (
        <div className="empty-state">
          <p>No contributors found for the selected time period.</p>
        </div>
      )}
    </div>
  );
}
