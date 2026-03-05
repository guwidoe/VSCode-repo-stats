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
  const {
    evolutionData,
    evolutionStatus,
    evolutionError,
    evolutionLoading,
    settings,
    data,
  } = useStore();
  const {
    requestEvolutionAnalysis,
    requestEvolutionRefresh,
  } = useVsCodeApi();

  const [dimension, setDimension] = useState<EvolutionDimension>('cohort');
  const [normalize, setNormalize] = useState(false);
  const [maxSeries, setMaxSeries] = useState(settings?.evolution.maxSeries ?? 20);

  useEffect(() => {
    if (settings) {
      setMaxSeries(settings.evolution.maxSeries);
    }
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

    return processEvolutionSeries(sourceData, maxSeries, normalize, dimension);
  }, [sourceData, maxSeries, normalize, dimension]);

  const runLabel = evolutionStatus === 'stale' ? 'Recompute Evolution' : 'Run Evolution Analysis';

  if (evolutionStatus === 'loading') {
    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Analyzing repository evolution"
          message={evolutionLoading.phase || 'Preparing analysis...'}
          loading
          progress={evolutionLoading.progress}
        />
      </div>
    );
  }

  if (evolutionStatus === 'error') {
    return (
      <div className="evolution-panel">
        <div className="panel-header">
          <h2>Evolution</h2>
        </div>
        <EvolutionStateView
          title="Evolution analysis failed"
          message={evolutionError || 'An unexpected error occurred.'}
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
