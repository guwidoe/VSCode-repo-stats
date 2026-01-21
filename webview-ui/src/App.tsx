/**
 * Main App component for the Repo Stats webview.
 */

import { useEffect } from 'react';
import { useStore } from './store';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { Navigation } from './components/Navigation';
import { OverviewPanel } from './components/overview/OverviewPanel';
import { ContributorsPanel } from './components/contributors/ContributorsPanel';
import { CodeFrequencyPanel } from './components/frequency/CodeFrequencyPanel';
import { TreemapPanel } from './components/treemap/TreemapPanel';
import './App.css';

export function App() {
  const { activeView, loading, error, data } = useStore();
  const { requestRefresh } = useVsCodeApi();

  // Request initial analysis on mount
  useEffect(() => {
    // Analysis is triggered by the extension when the webview opens
    // We don't need to request it manually
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Repository Statistics</h1>
          {data && (
            <span className="repo-info">
              {data.repository.name} ({data.repository.branch})
            </span>
          )}
        </div>
        <button
          className="refresh-button"
          onClick={requestRefresh}
          disabled={loading.isLoading}
        >
          Refresh
        </button>
      </header>

      <Navigation />

      {data?.limitReached && (
        <LimitWarning
          totalCount={data.repository.commitCount}
          limit={data.maxCommitsLimit}
        />
      )}

      <main className="app-content">
        {loading.isLoading && <LoadingState phase={loading.phase} progress={loading.progress} />}
        {error && <ErrorState message={error} onRetry={requestRefresh} />}
        {!loading.isLoading && !error && data && (
          <>
            {activeView === 'overview' && <OverviewPanel />}
            {activeView === 'contributors' && <ContributorsPanel />}
            {activeView === 'frequency' && <CodeFrequencyPanel />}
            {activeView === 'treemap' && <TreemapPanel />}
          </>
        )}
        {!loading.isLoading && !error && !data && (
          <EmptyState onRequest={requestRefresh} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

interface LoadingStateProps {
  phase: string;
  progress: number;
}

function LoadingState({ phase, progress }: LoadingStateProps) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p className="loading-phase">{phase || 'Analyzing repository...'}</p>
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

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
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

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  onRequest: () => void;
}

function EmptyState({ onRequest }: EmptyStateProps) {
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

// ============================================================================
// Limit Warning
// ============================================================================

interface LimitWarningProps {
  totalCount: number;
  limit: number;
}

function LimitWarning({ totalCount, limit }: LimitWarningProps) {
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
