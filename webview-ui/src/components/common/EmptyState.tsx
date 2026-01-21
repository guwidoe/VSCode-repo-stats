interface EmptyStateProps {
  onRequest: () => void;
}

export function EmptyState({ onRequest }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>No Data</h2>
      <p>No repository data is available.</p>
      <button className="retry-button" onClick={onRequest}>
        Analyze Repository
      </button>
    </div>
  );
}
