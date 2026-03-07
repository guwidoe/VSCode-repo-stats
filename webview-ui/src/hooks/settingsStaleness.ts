import type { ExtensionSettings } from '../types';

interface SettingsStalenessInput {
  currentSettings: ExtensionSettings;
  nextSettings: Partial<ExtensionSettings>;
  hasCoreData: boolean;
  hasEvolutionData: boolean;
  currentStaleness: {
    coreStale: boolean;
    evolutionStale: boolean;
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function evolutionSettingsEqual(
  current: ExtensionSettings['evolution'],
  next: ExtensionSettings['evolution']
): boolean {
  return (
    current.autoRun === next.autoRun &&
    current.snapshotIntervalDays === next.snapshotIntervalDays &&
    current.maxSnapshots === next.maxSnapshots &&
    current.maxSeries === next.maxSeries &&
    current.cohortFormat === next.cohortFormat
  );
}

export function getOptimisticStalenessForSettingsChange({
  currentSettings,
  nextSettings,
  hasCoreData,
  hasEvolutionData,
  currentStaleness,
}: SettingsStalenessInput): { coreStale: boolean; evolutionStale: boolean } {
  const mergedSettings: ExtensionSettings = {
    ...currentSettings,
    ...nextSettings,
  };

  const coreSettingsChanged =
    !arraysEqual(currentSettings.excludePatterns, mergedSettings.excludePatterns) ||
    currentSettings.maxCommitsToAnalyze !== mergedSettings.maxCommitsToAnalyze ||
    !arraysEqual(currentSettings.binaryExtensions, mergedSettings.binaryExtensions) ||
    !arraysEqual(currentSettings.locExcludedExtensions, mergedSettings.locExcludedExtensions) ||
    currentSettings.includeSubmodules !== mergedSettings.includeSubmodules;

  const evolutionSettingsChanged =
    !arraysEqual(currentSettings.excludePatterns, mergedSettings.excludePatterns) ||
    !arraysEqual(currentSettings.binaryExtensions, mergedSettings.binaryExtensions) ||
    !evolutionSettingsEqual(currentSettings.evolution, mergedSettings.evolution);

  return {
    coreStale: currentStaleness.coreStale || (hasCoreData && coreSettingsChanged),
    evolutionStale:
      currentStaleness.evolutionStale || (hasEvolutionData && evolutionSettingsChanged),
  };
}
