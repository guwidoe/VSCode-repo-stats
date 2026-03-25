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

export function EvolutionPanel() {
  const {
    evolutionData,
    evolutionStatus,
    evolutionError,
    evolutionLoading,
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

  if (evolutionStatus === 'loading') {
    const repositoryLabel = evolutionLoading.currentRepositoryLabel && evolutionLoading.totalRepositories
      ? `${evolutionLoading.currentRepositoryIndex ?? '?'} / ${evolutionLoading.totalRepositories} — ${evolutionLoading.currentRepositoryLabel}`
      : undefined;
    const snapshotLabel = evolutionLoading.totalSnapshots !== undefined
      ? evolutionLoading.currentSnapshotIndex !== undefined
        ? `${evolutionLoading.currentSnapshotIndex} / ${evolutionLoading.totalSnapshots}`
        : `${evolutionLoading.totalSnapshots} selected`
      : undefined;

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
          stageLabel={formatStageLabel(evolutionLoading.stage)}
          repositoryLabel={repositoryLabel}
          snapshotLabel={snapshotLabel}
          etaLabel={formatEtaLabel(evolutionLoading.etaSeconds)}
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
