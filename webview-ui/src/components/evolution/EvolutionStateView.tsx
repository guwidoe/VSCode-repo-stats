interface Props {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  progress?: number;
}

export function EvolutionStateView({
  title,
  message,
  actionLabel,
  onAction,
  loading,
  progress,
}: Props) {
  return (
    <div className="evolution-state-view">
      <h3>{title}</h3>
      <p>{message}</p>
      {loading && typeof progress === 'number' && (
        <div className="evolution-progress-track" aria-label="Evolution analysis progress">
          <div className="evolution-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {actionLabel && onAction && (
        <button className="evolution-run-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
