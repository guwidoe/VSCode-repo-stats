import React from 'react';
import { useStore } from '../../store';
import { ContributorCard } from './ContributorCard';
import { CommitsChart } from './CommitsChart';

export const ContributorsPanel: React.FC = () => {
  const { contributors, timePeriod, setTimePeriod } = useStore();

  const timePeriodOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'last3Months', label: 'Last 3 Months' },
    { value: 'lastMonth', label: 'Last Month' },
  ] as const;

  // Aggregate weekly commits for the chart
  const aggregateCommits = React.useMemo(() => {
    const weeklyMap = new Map<string, number>();

    contributors.forEach((contributor) => {
      contributor.weeklyActivity?.forEach((week) => {
        const current = weeklyMap.get(week.week) || 0;
        weeklyMap.set(week.week, current + week.commits);
      });
    });

    return Array.from(weeklyMap.entries())
      .map(([week, commits]) => ({ week, commits }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [contributors]);

  if (contributors.length === 0) {
    return (
      <div className="panel">
        <p>No contributor data available.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="frequency-controls">
        {timePeriodOptions.map((option) => (
          <button
            key={option.value}
            className={`toggle-button ${timePeriod === option.value ? 'active' : ''}`}
            onClick={() => setTimePeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {aggregateCommits.length > 0 && (
        <CommitsChart data={aggregateCommits} />
      )}

      <div className="contributors-grid">
        {contributors.map((contributor, index) => (
          <ContributorCard
            key={contributor.email}
            contributor={contributor}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
};
