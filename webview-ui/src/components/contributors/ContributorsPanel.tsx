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

  const contributors = useStore(selectFilteredContributors);
  const timeRangeWeeks = useStore(selectTimeRangeWeeks);
  const contributorGranularity = useStore((state) => state.contributorGranularity);

  const deferredContributors = useDeferredValue(contributors);
  const deferredTimeRangeWeeks = useDeferredValue(timeRangeWeeks);
  const deferredGranularity = useDeferredValue(contributorGranularity);
  const contributorCommitSummaryByEmail = new Map(
    (data?.commitAnalytics.contributorSummaries ?? []).map((summary) => [
      summary.authorEmail.toLowerCase(),
      summary,
    ])
  );

  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  useEffect(() => {
    if (deferredContributors.length <= INITIAL_DISPLAY_COUNT) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [deferredContributors.length]);

  const handleShowMore = useCallback(() => {
    setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
  }, []);

  if (!data) {return null;}

  const isStale = contributors !== deferredContributors ||
                  timeRangeWeeks !== deferredTimeRangeWeeks ||
                  contributorGranularity !== deferredGranularity;

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
            commitSummary={contributorCommitSummaryByEmail.get(contributor.email.toLowerCase())}
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
