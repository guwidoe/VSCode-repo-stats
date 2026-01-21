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
import { SettingsPanel } from './components/settings/SettingsPanel';
import { AboutPanel } from './components/about/AboutPanel';
import { LoadingState } from './components/common/LoadingState';
import { ErrorState } from './components/common/ErrorState';
import { EmptyState } from './components/common/EmptyState';
import { LimitWarning } from './components/common/LimitWarning';
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
        {/* Settings and About views work regardless of data/loading state */}
        {activeView === 'settings' && <SettingsPanel />}
        {activeView === 'about' && <AboutPanel />}

        {/* Other views require data */}
        {activeView !== 'settings' && activeView !== 'about' && (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
