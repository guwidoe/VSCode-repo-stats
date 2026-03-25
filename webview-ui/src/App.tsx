/**
 * Main App component for the Repo Stats webview.
 */

import { useEffect, useMemo } from 'react';
import type { AnalysisTargetOption, RepositoryOption } from './types';
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
  if (option.workspaceFolderName) {
    if (option.relativePath && option.relativePath !== '.') {
      return `${option.workspaceFolderName}/${option.relativePath}`;
    }

    return option.workspaceFolderName;
  }

  return option.name;
}

function formatTargetSummary(option: AnalysisTargetOption | null): string {
  if (!option) {
    return 'No repositories selected';
  }

  return option.description ? `${option.label} • ${option.description}` : option.label;
}

function isNestedRepository(parentPath: string, childPath: string): boolean {
  const normalizedParent = parentPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedChild = childPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalizedChild.startsWith(`${normalizedParent}/`);
}

function getTopLevelRepositoryIds(repositories: RepositoryOption[]): string[] {
  return repositories
    .filter((repository) => !repositories.some((candidate) => (
      candidate.path !== repository.path && isNestedRepository(candidate.path, repository.path)
    )))
    .map((repository) => repository.path);
}

function formatRepositorySelectionSummary(
  repositories: RepositoryOption[],
  selectedRepositories: RepositoryOption[]
): string {
  if (selectedRepositories.length === 0) {
    return 'No repositories selected';
  }

  if (selectedRepositories.length === 1) {
    return formatRepositoryOption(selectedRepositories[0]);
  }

  if (selectedRepositories.length === repositories.length) {
    return `All repositories (${repositories.length})`;
  }

  return `${selectedRepositories.length} of ${repositories.length} repositories`;
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
    selectedRepositoryIds,
    selectedTarget,
  } = useStore();
  const { requestRefresh, cancelAnalysis, updateRepositorySelection } = useVsCodeApi();

  const selectedRepositories = useMemo(() => {
    const selectedIds = new Set(selectedRepositoryIds);
    return availableRepositories.filter((repository) => selectedIds.has(repository.path));
  }, [availableRepositories, selectedRepositoryIds]);

  const allRepositoryIds = useMemo(
    () => availableRepositories.map((repository) => repository.path),
    [availableRepositories]
  );
  const topLevelRepositoryIds = useMemo(
    () => getTopLevelRepositoryIds(availableRepositories),
    [availableRepositories]
  );

  const toggleRepository = (repositoryId: string) => {
    const selectedIds = new Set(selectedRepositoryIds);
    if (selectedIds.has(repositoryId)) {
      selectedIds.delete(repositoryId);
    } else {
      selectedIds.add(repositoryId);
    }

    updateRepositorySelection(
      availableRepositories
        .map((repository) => repository.path)
        .filter((repositoryPath) => selectedIds.has(repositoryPath))
    );
  };

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
              {data.target.label}
              {data.repositories.length === 1 ? ` (${data.repositories[0]?.branch ?? ''})` : ` • ${data.repositories.length} repos`}
            </span>
          ) : (
            <span className="repo-info">{formatTargetSummary(selectedTarget)}</span>
          )}
          {availableRepositories.length > 0 && (
            <details className="repo-selector">
              <summary className="repo-selector-trigger">
                <span className="repo-selector-label">Repositories</span>
                <span className="repo-selector-trigger-text">
                  {formatRepositorySelectionSummary(availableRepositories, selectedRepositories)}
                </span>
              </summary>
              <div className="repo-selector-popover">
                <div className="repo-selector-actions-row">
                  <button
                    className="repo-selector-action"
                    type="button"
                    onClick={() => updateRepositorySelection(allRepositoryIds)}
                  >
                    All
                  </button>
                  <button
                    className="repo-selector-action"
                    type="button"
                    onClick={() => updateRepositorySelection(topLevelRepositoryIds)}
                  >
                    Top-level
                  </button>
                  <button
                    className="repo-selector-action"
                    type="button"
                    onClick={() => updateRepositorySelection([])}
                  >
                    None
                  </button>
                </div>
                <div className="repo-selector-list">
                  {availableRepositories.map((repository) => {
                    const checked = selectedRepositoryIds.includes(repository.path);
                    return (
                      <label key={repository.path} className="repo-selector-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRepository(repository.path)}
                        />
                        <span className="repo-selector-item-text">
                          <span className="repo-selector-item-name">{repository.name}</span>
                          <span className="repo-selector-item-meta">{formatRepositoryOption(repository)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          )}
        </div>
        <div className="header-actions">
          {(coreStale || evolutionStale) && (
            <span className="stale-indicator">
              Stale: {coreStale && 'Core'}{coreStale && evolutionStale && ' + '}{evolutionStale && 'Evolution'}
            </span>
          )}
          {loading.isLoading ? (
            <button
              className="refresh-button"
              onClick={cancelAnalysis}
            >
              Cancel Refresh
            </button>
          ) : (
            <button
              className="refresh-button"
              onClick={requestRefresh}
            >
              Refresh
            </button>
          )}
        </div>
      </header>

      <Navigation />

      {data?.limitReached && (
        <LimitWarning
          totalCount={data.repositories.reduce((sum, repository) => sum + repository.commitCount, 0)}
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
