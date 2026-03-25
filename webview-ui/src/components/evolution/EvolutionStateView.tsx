interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  loading?: boolean;
  progress?: number;
  stageLabel?: string;
  repositoryLabel?: string;
  snapshotLabel?: string;
  etaLabel?: string;
}

export function EvolutionStateView({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  loading,
  progress,
  stageLabel,
  repositoryLabel,
  snapshotLabel,
  etaLabel,
}: Props) {
  const details = [
    stageLabel ? { label: 'Stage', value: stageLabel } : null,
    repositoryLabel ? { label: 'Repository', value: repositoryLabel } : null,
    snapshotLabel ? { label: 'Snapshots', value: snapshotLabel } : null,
    etaLabel ? { label: 'ETA', value: etaLabel } : null,
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <div className="evolution-state-view">
      <h3>{title}</h3>
      <p>{message}</p>
      {loading && details.length > 0 && (
        <dl className="evolution-progress-details">
          {details.map((detail) => (
            <div key={detail.label} className="evolution-progress-detail-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {loading && typeof progress === 'number' && (
        <div className="evolution-progress-track" aria-label="Evolution analysis progress">
          <div className="evolution-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="evolution-state-actions">
          {actionLabel && onAction && (
            <button className="evolution-run-button" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button className="evolution-run-button" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
