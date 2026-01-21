interface LimitWarningProps {
  totalCount: number;
  limit: number;
}

export function LimitWarning({ totalCount, limit }: LimitWarningProps) {
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="limit-warning">
      <span className="warning-icon">&#9888;</span>
      <span className="warning-text">
        <strong>Partial data:</strong> Only {formatNumber(limit)} of {formatNumber(totalCount)} commits analyzed.
        Increase <code>repoStats.maxCommitsToAnalyze</code> in settings for complete statistics.
      </span>
    </div>
  );
}
