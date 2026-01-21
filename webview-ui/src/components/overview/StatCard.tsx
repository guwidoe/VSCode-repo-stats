/**
 * Stat card showing a big number with label and optional subtitle.
 */

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
}

export function StatCard({ label, value, subtitle, icon }: StatCardProps) {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString()
    : value;

  return (
    <div className="stat-card">
      {icon && <span className="stat-card-icon">{icon}</span>}
      <div className="stat-card-content">
        <span className="stat-card-value">{formattedValue}</span>
        <span className="stat-card-label">{label}</span>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
