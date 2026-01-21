/**
 * Summary Card for displaying aggregate statistics.
 */

interface Props {
  label: string;
  value: number;
  color: string;
  prefix?: string;
}

function formatLargeNumber(num: number): string {
  const absNum = Math.abs(num);
  if (absNum >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (absNum >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function SummaryCard({ label, value, color, prefix = '' }: Props) {
  const formattedValue = value >= 0 ? `${prefix}${formatLargeNumber(value)}` : formatLargeNumber(value);

  return (
    <div className="summary-card">
      <span className="summary-label">{label}</span>
      <span className="summary-value" style={{ color }}>
        {formattedValue}
      </span>
    </div>
  );
}
