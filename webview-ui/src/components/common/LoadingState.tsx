interface LoadingStateProps {
  phase: string;
  progress: number;
}

export function LoadingState({ phase, progress }: LoadingStateProps) {
  const displayPhase = phase.trim().length > 0 ? phase : '(phase missing)';

  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p className="loading-phase">{displayPhase}</p>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="loading-hint">
        This may take a moment for large repositories.
      </p>
    </div>
  );
}
