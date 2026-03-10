import { useEvolutionPanelState } from '../../hooks/useEvolutionPanelState';
import { EvolutionControls } from './EvolutionControls';
import { EvolutionStackChart } from './EvolutionStackChart';
import { EvolutionLineChart } from './EvolutionLineChart';
import { EvolutionDistributionChart } from './EvolutionDistributionChart';
import { EvolutionStateView } from './EvolutionStateView';
import './EvolutionPanel.css';

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
  } = useEvolutionPanelState();

  if (!settings) {
    return null;
  }

  if (evolutionStatus === 'loading') {
    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Analyzing repository evolution"
          message={evolutionLoading.phase}
          loading
          progress={evolutionLoading.progress}
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

  return (
    <div className="evolution-panel">
      <div className="panel-header">
        <h2>Evolution</h2>
        <span className="evolution-meta">
          {data?.repository.name} • {evolutionData.branch} • {evolutionData.headSha.slice(0, 8)}
        </span>
      </div>

      {evolutionStatus === 'stale' && (
        <div className="evolution-stale-banner">
          Evolution data is stale (repository or settings changed).
          <button onClick={requestEvolutionRefresh}>Recompute</button>
        </div>
      )}

      {settings.includeSubmodules && data?.submodules && data.submodules.count > 0 && (
        <div className="evolution-note-banner">
          Evolution analysis uses parent-repo history only. Submodule repositories are not aggregated in this tab.
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
