import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import type { EvolutionDimension, EvolutionTimeSeriesData } from '../../types';
import { EvolutionControls } from './EvolutionControls';
import { EvolutionStackChart } from './EvolutionStackChart';
import { EvolutionLineChart } from './EvolutionLineChart';
import { EvolutionDistributionChart } from './EvolutionDistributionChart';
import { EvolutionStateView } from './EvolutionStateView';
import { processEvolutionSeries } from './evolutionUtils';
import './EvolutionPanel.css';

export function EvolutionPanel() {
  const evolutionData = useStore((state) => state.evolutionData);
  const evolutionStatus = useStore((state) => state.evolutionStatus);
  const evolutionError = useStore((state) => state.evolutionError);
  const evolutionLoading = useStore((state) => state.evolutionLoading);
  const settings = useStore((state) => state.settings)!;
  const data = useStore((state) => state.data);

  const {
    requestEvolutionAnalysis,
    requestEvolutionRefresh,
  } = useVsCodeApi();

  const [dimension, setDimension] = useState<EvolutionDimension>('cohort');
  const [normalize, setNormalize] = useState(false);
  const [maxSeries, setMaxSeries] = useState(settings.evolution.maxSeries);

  useEffect(() => {
    setMaxSeries(settings.evolution.maxSeries);
  }, [settings]);

  useEffect(() => {
    requestEvolutionAnalysis();
  }, [requestEvolutionAnalysis]);

  const sourceData = useMemo(() => {
    if (!evolutionData) {
      return null;
    }

    return selectDimensionData(evolutionData, dimension);
  }, [evolutionData, dimension]);

  const processed = useMemo(() => {
    if (!sourceData) {
      return null;
    }

    return processEvolutionSeries(
      sourceData,
      maxSeries,
      normalize,
      dimension,
      settings.evolution.showInactivePeriods
    );
  }, [sourceData, maxSeries, normalize, dimension, settings.evolution.showInactivePeriods]);

  const runLabel = evolutionStatus === 'stale' ? 'Recompute Evolution' : 'Run Evolution Analysis';

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

  if (!evolutionData || !processed) {
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

      {settings?.includeSubmodules && data?.submodules && data.submodules.count > 0 && (
        <div className="evolution-note-banner">
          Evolution analysis uses parent-repo history only. Submodule repositories are not aggregated in this tab.
        </div>
      )}

      <EvolutionControls
        dimension={dimension}
        onDimensionChange={setDimension}
        normalize={normalize}
        onNormalizeChange={setNormalize}
        maxSeries={maxSeries}
        onMaxSeriesChange={setMaxSeries}
        onRun={requestEvolutionRefresh}
        runLabel={runLabel}
      />

      <div className="evolution-timeline-note">
        <div className="evolution-timeline-pill">
          Sampling: {describeSamplingMode(processed.snapshots[0]?.samplingMode ?? settings.evolution.samplingMode)}
        </div>
        <div className="evolution-timeline-pill">
          Points: {processed.snapshots.length.toLocaleString()}
        </div>
        {processed.snapshots.some((snapshot) => snapshot.synthetic) && (
          <div className="evolution-timeline-pill">
            Filled periods: {processed.snapshots.filter((snapshot) => snapshot.synthetic).length.toLocaleString()}
          </div>
        )}
        <p className="evolution-timeline-copy">
          {buildTimelineExplanation(
            processed.snapshots[0]?.samplingMode ?? settings.evolution.samplingMode,
            settings.evolution.showInactivePeriods
          )}
        </p>
      </div>

      <div className="evolution-chart-grid">
        <section className="evolution-chart-card">
          <h3>Stacked Ownership Over Time</h3>
          <EvolutionStackChart data={processed} normalize={normalize} />
        </section>

        <section className="evolution-chart-card">
          <h3>Trend Lines</h3>
          <EvolutionLineChart data={processed} normalize={normalize} />
        </section>

        <section className="evolution-chart-card evolution-chart-card-full">
          <h3>Latest Distribution</h3>
          <EvolutionDistributionChart data={processed} />
        </section>
      </div>
    </div>
  );
}

function describeSamplingMode(mode: 'time' | 'commit' | 'auto'): string {
  switch (mode) {
    case 'commit':
      return 'Commit-based';
    case 'auto':
      return 'Auto-distributed';
    case 'time':
    default:
      return 'Time-based';
  }
}

function buildTimelineExplanation(
  mode: 'time' | 'commit' | 'auto',
  showInactivePeriods: boolean
): string {
  const gapCopy = showInactivePeriods
    ? 'Inactive periods are filled with carry-forward ownership so flat stretches remain visible.'
    : 'Only directly sampled snapshots are plotted; inactive periods are skipped.';

  switch (mode) {
    case 'commit':
      return `The x-axis still shows real commit dates, but snapshots were selected by commit interval rather than uniform calendar time. ${gapCopy}`;
    case 'auto':
      return `The x-axis shows real commit dates while snapshots are auto-distributed across repository history, so spacing is intentionally non-linear in time. ${gapCopy}`;
    case 'time':
    default:
      return `Snapshots are selected by elapsed time. ${gapCopy}`;
  }
}

function selectDimensionData(
  data: {
    cohorts: EvolutionTimeSeriesData;
    authors: EvolutionTimeSeriesData;
    exts: EvolutionTimeSeriesData;
    dirs: EvolutionTimeSeriesData;
    domains: EvolutionTimeSeriesData;
  },
  dimension: EvolutionDimension
): EvolutionTimeSeriesData {
  switch (dimension) {
    case 'cohort':
      return data.cohorts;
    case 'author':
      return data.authors;
    case 'ext':
      return data.exts;
    case 'dir':
      return data.dirs;
    case 'domain':
      return data.domains;
  }
}
