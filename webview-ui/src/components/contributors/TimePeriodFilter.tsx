/**
 * Time Period Filter - Dropdown for filtering by time period.
 */

import { useStore } from '../../store';
import type { TimePeriod } from '../../types';
import './TimePeriodFilter.css';

const TIME_PERIODS: { id: TimePeriod; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: 'year', label: 'Last Year' },
  { id: '6months', label: 'Last 6 Months' },
  { id: '3months', label: 'Last 3 Months' },
  { id: 'month', label: 'Last Month' },
];

export function TimePeriodFilter() {
  const { timePeriod, setTimePeriod } = useStore();

  return (
    <div className="time-period-filter">
      <label htmlFor="time-period">Time Period:</label>
      <select
        id="time-period"
        value={timePeriod}
        onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
      >
        {TIME_PERIODS.map((period) => (
          <option key={period.id} value={period.id}>
            {period.label}
          </option>
        ))}
      </select>
    </div>
  );
}
