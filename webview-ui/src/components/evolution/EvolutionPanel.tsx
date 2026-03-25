import { useEvolutionPanelState } from './useEvolutionPanelState';
import type { EvolutionProgressStage } from '../../types';
import { EvolutionControls } from './EvolutionControls';
import { EvolutionStackChart } from './EvolutionStackChart';
import { EvolutionLineChart } from './EvolutionLineChart';
import { EvolutionDistributionChart } from './EvolutionDistributionChart';
import { EvolutionStateView } from './EvolutionStateView';
import './EvolutionPanel.css';

function formatStageLabel(stage?: EvolutionProgressStage): string | undefined {
  switch (stage) {
    case 'preparing':
      return 'Preparing history';
    case 'sampling':
      return 'Selecting snapshots';
    case 'analyzing':
      return 'Analyzing snapshots';
    case 'finalizing':
      return 'Finalizing charts';
    default:
      return undefined;
  }
}

function formatEtaLabel(etaSeconds?: number): string | undefined {
  if (!etaSeconds || etaSeconds <= 0) {
    return undefined;
  }

  if (etaSeconds < 60) {
    return `~${etaSeconds}s remaining`;
  }

  const minutes = Math.floor(etaSeconds / 60);
  const seconds = etaSeconds % 60;
  return `~${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`;
}

function getEvolutionProgressDetails(loading: {
  currentRepositoryLabel?: string;
  totalRepositories?: number;
  currentRepositoryIndex?: number;
  totalSnapshots?: number;
  currentSnapshotIndex?: number;
  etaSeconds?: number;
  stage?: EvolutionProgressStage;
}) {
  const repositoryLabel = loading.currentRepositoryLabel && loading.totalRepositories
    ? `${loading.currentRepositoryIndex ?? '?'} / ${loading.totalRepositories} — ${loading.currentRepositoryLabel}`
    : undefined;
  const snapshotLabel = loading.totalSnapshots !== undefined
    ? loading.currentSnapshotIndex !== undefined
      ? `${loading.currentSnapshotIndex} / ${loading.totalSnapshots}`
      : `${loading.totalSnapshots} selected`
    : undefined;

  return {
    repositoryLabel,
    snapshotLabel,
    etaLabel: formatEtaLabel(loading.etaSeconds),
    stageLabel: formatStageLabel(loading.stage),
  };
}

function getProvisionalCopy(isPreliminary: boolean): { badge: string; description: string } {
  if (isPreliminary) {
    return {
      badge: 'Preliminary charts',
      description: 'Showing partial evolution data from the current recompute. Final series may still change.',
    };
  }

  return {
    badge: 'Recompute in progress',
    description: 'Showing the last completed evolution charts while the new recompute is still running.',
  };
}

export function EvolutionPanel() {
  const {
    evolutionData,
    evolutionStatus,
    evolutionError,
    evolutionLoading,
    evolutionPresentation,
    settings,
    data,
    dimension,
    setDimension,
    axisMode,
    setAxisMode,
    normalize,
    setNormalize,
    maxSeries,
    setMaxSeries,
    processed,
    timeline,
    runLabel,
    requestEvolutionRefresh,
    cancelEvolutionAnalysis,
  } = useEvolutionPanelState();

  if (!settings) {
    return null;
  }

  const progressDetails = getEvolutionProgressDetails(evolutionLoading);
  const showProvisionalBanner = evolutionLoading.isLoading && Boolean(evolutionData && processed && timeline);
  const provisionalCopy = getProvisionalCopy(
    evolutionPresentation.displayedResultKind === 'preliminary'
      && evolutionPresentation.displayedResultSource === 'activeRun'
  );

  if (evolutionStatus === 'loading' && !evolutionData) {

    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Analyzing repository evolution"
          message={evolutionLoading.phase}
          actionLabel="Cancel Evolution Analysis"
          onAction={cancelEvolutionAnalysis}
          loading
          progress={evolutionLoading.progress}
          stageLabel={progressDetails.stageLabel}
          repositoryLabel={progressDetails.repositoryLabel}
          snapshotLabel={progressDetails.snapshotLabel}
          etaLabel={progressDetails.etaLabel}
        />
      </div>
    );
  }

  if (evolutionStatus === 'error') {
    if (!evolutionError) {
      throw new Error('Evolution status is error but no error message is set.');
    }

    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Evolution analysis failed"
          message={evolutionError}
          actionLabel="Retry Evolution Analysis"
          onAction={requestEvolutionRefresh}
        />
      </div>
    );
  }

  if (!evolutionData || !processed || !timeline) {
    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Evolution analysis is on-demand"
          message="This view uses blame-based historical snapshots and can be slower on very large repositories. Run it when you need deep ownership history insights."
          actionLabel="Run Evolution Analysis"
          onAction={requestEvolutionRefresh}
        />
      </div>
    );
  }

  const targetLabel = data?.target?.label ?? data?.repositories?.[0]?.name ?? 'Evolution';
  const memberHeads = evolutionData.memberHeads ?? [];

  return (
    <div className="evolution-panel">
      <div className="panel-header">
        <h2>Evolution</h2>
        <span className="evolution-meta">
          {targetLabel}
          {memberHeads.length === 1
            ? ` • ${memberHeads[0]?.branch ?? ''} • ${memberHeads[0]?.headSha.slice(0, 8) ?? ''}`
            : memberHeads.length > 1
              ? ` • ${memberHeads.length} repos • merged history`
              : ''}
        </span>
      </div>

      {evolutionStatus === 'stale' && (
        <div className="evolution-stale-banner">
          Evolution data is stale (repository or settings changed).
          <button onClick={requestEvolutionRefresh}>Recompute</button>
        </div>
      )}

      {showProvisionalBanner && (
        <div className="evolution-progress-banner" role="status" aria-live="polite">
          <div className="evolution-progress-banner-header">
            <div>
              <div className="evolution-progress-banner-badge">{provisionalCopy.badge}</div>
              <div className="evolution-progress-banner-title">
                {evolutionLoading.phase || 'Recomputing evolution charts...'}
              </div>
              <div className="evolution-progress-banner-copy">{provisionalCopy.description}</div>
            </div>
            <div className="evolution-progress-banner-actions">
              <button
                className="evolution-run-button evolution-run-button-secondary"
                type="button"
                onClick={cancelEvolutionAnalysis}
              >
                Cancel
              </button>
              <button
                className="evolution-run-button"
                type="button"
                onClick={requestEvolutionRefresh}
              >
                Restart Evolution Analysis
              </button>
            </div>
          </div>

          {(progressDetails.stageLabel || progressDetails.repositoryLabel || progressDetails.snapshotLabel || progressDetails.etaLabel) && (
            <dl className="evolution-progress-details evolution-progress-banner-details">
              {progressDetails.stageLabel && (
                <div className="evolution-progress-detail-row">
                  <dt>Stage</dt>
                  <dd>{progressDetails.stageLabel}</dd>
                </div>
              )}
              {progressDetails.repositoryLabel && (
                <div className="evolution-progress-detail-row">
                  <dt>Repository</dt>
                  <dd>{progressDetails.repositoryLabel}</dd>
                </div>
              )}
              {progressDetails.snapshotLabel && (
                <div className="evolution-progress-detail-row">
                  <dt>Snapshots</dt>
                  <dd>{progressDetails.snapshotLabel}</dd>
                </div>
              )}
              {progressDetails.etaLabel && (
                <div className="evolution-progress-detail-row">
                  <dt>ETA</dt>
                  <dd>{progressDetails.etaLabel}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="evolution-progress-track" aria-hidden="true">
            <div
              className="evolution-progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, evolutionLoading.progress))}%` }}
            />
          </div>
        </div>
      )}

      <EvolutionControls
        dimension={dimension}
        onDimensionChange={setDimension}
        axisMode={axisMode}
        onAxisModeChange={setAxisMode}
        normalize={normalize}
        onNormalizeChange={setNormalize}
        maxSeries={maxSeries}
        onMaxSeriesChange={setMaxSeries}
        onRun={requestEvolutionRefresh}
        runLabel={runLabel}
      />

      <div className="evolution-timeline-note">
        <div className="evolution-timeline-pill">
          Sampling: {timeline.samplingLabel}
        </div>
        <div className="evolution-timeline-pill">
          X-axis: {timeline.axisLabel}
        </div>
        <div className="evolution-timeline-pill">
          Points: {timeline.points.toLocaleString()}
        </div>
        {timeline.filledPeriods > 0 && (
          <div className="evolution-timeline-pill">
            Filled periods: {timeline.filledPeriods.toLocaleString()}
          </div>
        )}
        <p className="evolution-timeline-copy">
          {timeline.explanation}
        </p>
      </div>

      <div className="evolution-chart-grid">
        <section className="evolution-chart-card">
          <h3>Stacked Ownership Over Time</h3>
          <EvolutionStackChart data={processed} normalize={normalize} axisMode={axisMode} />
        </section>

        <section className="evolution-chart-card">
          <h3>Trend Lines</h3>
          <EvolutionLineChart data={processed} normalize={normalize} axisMode={axisMode} />
        </section>

        <section className="evolution-chart-card evolution-chart-card-full">
          <h3>Latest Distribution</h3>
          <EvolutionDistributionChart data={processed} />
        </section>
      </div>
    </div>
  );
}
