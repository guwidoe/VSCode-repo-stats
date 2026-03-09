/**
 * Main App component for the Repo Stats webview.
 */

import { useEffect, useMemo } from 'react';
import type { RepositoryOption } from './types';
import { useStore } from './store';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { Navigation } from './components/Navigation';
import { OverviewPanel } from './components/overview/OverviewPanel';
import { ContributorsPanel } from './components/contributors/ContributorsPanel';
import { CommitsPanel } from './components/commits/CommitsPanel';
import { FilesPanel } from './components/files/FilesPanel';
import { CodeFrequencyPanel } from './components/frequency/CodeFrequencyPanel';
import { TreemapPanel } from './components/treemap/TreemapPanel';
import { EvolutionPanel } from './components/evolution/EvolutionPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { AboutPanel } from './components/about/AboutPanel';
import { LoadingState } from './components/common/LoadingState';
import { ErrorState } from './components/common/ErrorState';
import { EmptyState } from './components/common/EmptyState';
import { LimitWarning } from './components/common/LimitWarning';
import './App.css';

function formatRepositoryOption(option: RepositoryOption): string {
  if (option.relativePath === '.') {
    return `${option.name} — ${option.workspaceFolderName}`;
  }

  return `${option.name} — ${option.workspaceFolderName}/${option.relativePath}`;
}

export function App() {
  const {
    activeView,
    loading,
    error,
    data,
    settings,
    coreStale,
    evolutionStale,
    availableRepositories,
    selectedRepoPath,
  } = useStore();
  const { requestRefresh, selectRepository } = useVsCodeApi();

  const selectedRepository = useMemo(
    () => availableRepositories.find((repository) => repository.path === selectedRepoPath) ?? null,
    [availableRepositories, selectedRepoPath]
  );

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
          {data ? (
            <span className="repo-info">
              {data.repository.name} ({data.repository.branch})
            </span>
          ) : selectedRepository ? (
            <span className="repo-info">{formatRepositoryOption(selectedRepository)}</span>
          ) : null}
          {availableRepositories.length > 1 && selectedRepoPath && (
            <label className="repo-selector">
              <span className="repo-selector-label">Repository</span>
              <select
                className="repo-selector-input"
                value={selectedRepoPath}
                onChange={(event) => selectRepository(event.target.value)}
              >
                {availableRepositories.map((repository) => (
                  <option key={repository.path} value={repository.path}>
                    {formatRepositoryOption(repository)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="header-actions">
          {(coreStale || evolutionStale) && (
            <span className="stale-indicator">
              Stale: {coreStale && 'Core'}{coreStale && evolutionStale && ' + '}{evolutionStale && 'Evolution'}
            </span>
          )}
          <button
            className="refresh-button"
            onClick={requestRefresh}
            disabled={loading.isLoading}
          >
            Refresh
          </button>
        </div>
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

        {/* Evolution is intentionally on-demand and independent from global analysis loading */}
        {activeView === 'evolution' && (
          settings
            ? <EvolutionPanel />
            : <LoadingState phase="Loading settings..." progress={0} />
        )}

        {/* Core views depend on settings + global analysis */}
        {activeView !== 'settings' && activeView !== 'about' && activeView !== 'evolution' && (
          <>
            {error && !loading.isLoading && <ErrorState message={error} onRetry={requestRefresh} />}
            {!error && !settings && <LoadingState phase="Loading settings..." progress={0} />}
            {settings && !error && !data && loading.isLoading && (
              <LoadingState phase={loading.phase} progress={loading.progress} />
            )}
            {settings && !error && data && (
              <>
                {loading.isLoading && (
                  <div className="live-update-banner" role="status" aria-live="polite">
                    <div className="live-update-banner-text">{loading.phase}</div>
                    <div className="live-update-banner-track">
                      <div
                        className="live-update-banner-fill"
                        style={{ width: `${Math.max(0, Math.min(100, loading.progress))}%` }}
                      />
                    </div>
                  </div>
                )}
                {activeView === 'overview' && <OverviewPanel />}
                {activeView === 'files' && <FilesPanel />}
                {activeView === 'contributors' && <ContributorsPanel />}
                {activeView === 'commits' && <CommitsPanel />}
                {activeView === 'frequency' && <CodeFrequencyPanel />}
                {activeView === 'treemap' && <TreemapPanel />}
              </>
            )}
            {settings && !loading.isLoading && !error && !data && (
              <EmptyState onRequest={requestRefresh} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
