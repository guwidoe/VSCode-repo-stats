/**
 * Contributors Panel - Shows contributor statistics and charts.
 */

import { useStore, selectFilteredContributors } from '../../store';
import { ContributorCard } from './ContributorCard';
import { CommitsChart } from './CommitsChart';
import { TimePeriodFilter } from './TimePeriodFilter';
import './ContributorsPanel.css';

export function ContributorsPanel() {
  const contributors = useStore(selectFilteredContributors);
  const data = useStore((state) => state.data);

  if (!data) {return null;}

  return (
    <div className="contributors-panel">
      <div className="panel-header">
        <h2>Contributors</h2>
        <TimePeriodFilter />
      </div>

      <div className="commits-chart-container">
        <h3>Commits Over Time</h3>
        <CommitsChart contributors={contributors} />
      </div>

      <div className="contributors-grid">
        {contributors.map((contributor, index) => (
          <ContributorCard
            key={contributor.email}
            contributor={contributor}
            rank={index + 1}
          />
        ))}
      </div>

      {contributors.length === 0 && (
        <div className="empty-state">
          <p>No contributors found for the selected time period.</p>
        </div>
      )}
    </div>
  );
}
