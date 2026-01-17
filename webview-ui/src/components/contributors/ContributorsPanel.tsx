/**
 * Contributors Panel - Shows contributor statistics and charts.
 *
 * Uses useDeferredValue to keep UI controls responsive while expensive
 * chart/list re-renders happen in the background.
 */

import { useDeferredValue } from 'react';
import { useStore, selectFilteredContributors, selectTimeRangeWeeks } from '../../store';
import { ContributorCard } from './ContributorCard';
import { CommitsChart } from './CommitsChart';
import { TimeRangeSlider } from './TimeRangeSlider';
import { GranularityToggle } from './GranularityToggle';
import './ContributorsPanel.css';

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

  if (!data) {return null;}

  // Show a subtle indicator when data is stale (optional visual feedback)
  const isStale = contributors !== deferredContributors ||
                  timeRangeWeeks !== deferredTimeRangeWeeks ||
                  contributorGranularity !== deferredGranularity;

  return (
    <div className={`contributors-panel ${isStale ? 'updating' : ''}`}>
      <div className="panel-header">
        <h2>Contributors</h2>
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
        {deferredContributors.map((contributor, index) => (
          <ContributorCard
            key={contributor.email}
            contributor={contributor}
            rank={index + 1}
            timeRangeWeeks={deferredTimeRangeWeeks}
            granularity={deferredGranularity}
          />
        ))}
      </div>

      {deferredContributors.length === 0 && (
        <div className="empty-state">
          <p>No contributors found for the selected time period.</p>
        </div>
      )}
    </div>
  );
}
