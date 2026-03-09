import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useVsCodeApi } from './useVsCodeApi';
import { processEvolutionSeries } from '../components/evolution/evolutionUtils';
import type { EvolutionDimension, EvolutionTimeSeriesData } from '../types';

export function useEvolutionPanelState() {
  const evolutionData = useStore((state) => state.evolutionData);
  const evolutionStatus = useStore((state) => state.evolutionStatus);
  const evolutionError = useStore((state) => state.evolutionError);
  const evolutionLoading = useStore((state) => state.evolutionLoading);
  const settings = useStore((state) => state.settings);
  const data = useStore((state) => state.data);
  const { requestEvolutionAnalysis, requestEvolutionRefresh } = useVsCodeApi();

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
      points: processed.snapshots.length,
      filledPeriods,
      explanation: buildTimelineExplanation(
        samplingMode,
        settings.evolution.showInactivePeriods
      ),
    };
  }, [processed, settings]);

  return {
    evolutionData,
    evolutionStatus,
    evolutionError,
    evolutionLoading,
    settings,
    data,
    dimension,
    setDimension,
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
