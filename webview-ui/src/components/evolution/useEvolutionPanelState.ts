import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { processEvolutionSeries, type EvolutionAxisMode } from './evolutionUtils';
import type { EvolutionDimension, EvolutionTimeSeriesData } from '../../types';

export function useEvolutionPanelState() {
  const evolutionData = useStore((state) => state.evolutionData);
  const evolutionStatus = useStore((state) => state.evolutionStatus);
  const evolutionError = useStore((state) => state.evolutionError);
  const evolutionLoading = useStore((state) => state.evolutionLoading);
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { requestEvolutionAnalysis, requestEvolutionRefresh } = useVsCodeApi();

  const [dimension, setDimension] = useState<EvolutionDimension>('cohort');
  const [axisMode, setAxisMode] = useState<EvolutionAxisMode>('time');
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
    if (!sourceData || !settings) {
      return null;
    }

    return processEvolutionSeries(
      sourceData,
      maxSeries,
      normalize,
      dimension,
      settings.evolution.showInactivePeriods
    );
  }, [sourceData, maxSeries, normalize, dimension, settings]);

  const timeline = useMemo(() => {
    if (!processed || !settings) {
      return null;
    }

    const samplingMode = processed.snapshots[0]?.samplingMode ?? settings.evolution.samplingMode;
    const filledPeriods = processed.snapshots.filter((snapshot) => snapshot.synthetic).length;

    return {
      samplingLabel: describeSamplingMode(samplingMode),
      axisLabel: describeAxisMode(axisMode),
      points: processed.snapshots.length,
      filledPeriods,
      explanation: buildTimelineExplanation(
        samplingMode,
        axisMode,
        settings.evolution.showInactivePeriods
      ),
    };
  }, [axisMode, processed, settings]);

  return {
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
    runLabel: evolutionStatus === 'stale' ? 'Recompute Evolution' : 'Run Evolution Analysis',
    requestEvolutionRefresh,
  };
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

function describeAxisMode(mode: EvolutionAxisMode): string {
  switch (mode) {
    case 'commit':
      return 'Commit progression';
    case 'time':
    default:
      return 'Calendar time';
  }
}

function buildTimelineExplanation(
  mode: 'time' | 'commit' | 'auto',
  axisMode: EvolutionAxisMode,
  showInactivePeriods: boolean
): string {
  const axisCopy = axisMode === 'commit'
    ? 'Charts are currently displayed on a commit-progression axis instead of calendar time.'
    : 'Charts are currently displayed on a calendar-time axis.';
  const gapCopy = showInactivePeriods
    ? 'Inactive periods insert unsampled gap markers so the broader timeline stays visible without turning the lines into stair-steps.'
    : 'Only directly sampled snapshots are plotted; inactive periods are skipped.';

  switch (mode) {
    case 'commit':
      return `Snapshots were selected by commit interval rather than uniform calendar time. ${axisCopy} ${gapCopy}`;
    case 'auto':
      return `Snapshots are auto-distributed across repository history, so spacing is intentionally non-linear. ${axisCopy} ${gapCopy}`;
    case 'time':
    default:
      return `Snapshots are selected by elapsed time. ${axisCopy} ${gapCopy}`;
  }
}

function selectDimensionData(
  data: {
    cohorts: EvolutionTimeSeriesData;
    authors: EvolutionTimeSeriesData;
    extensions: EvolutionTimeSeriesData;
    directories: EvolutionTimeSeriesData;
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
      return data.extensions;
    case 'dir':
      return data.directories;
    case 'domain':
      return data.domains;
  }
}
