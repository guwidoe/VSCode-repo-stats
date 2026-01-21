interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-icon">!</div>
      <h2>Analysis Failed</h2>
      <p>{message}</p>
      <button className="retry-button" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}
