import type { ExtensionSettings } from '../types';
import {
  applySettingsPatch,
  settingsAffectCoreAnalysis,
  settingsAffectEvolutionAnalysis,
} from '../../../src/shared/settings';

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

export function getOptimisticStalenessForSettingsChange({
  currentSettings,
  nextSettings,
  hasCoreData,
  hasEvolutionData,
  currentStaleness,
}: SettingsStalenessInput): { coreStale: boolean; evolutionStale: boolean } {
  const mergedSettings = applySettingsPatch(currentSettings, nextSettings);

  const coreSettingsChanged = settingsAffectCoreAnalysis(currentSettings, mergedSettings);
  const evolutionSettingsChanged = settingsAffectEvolutionAnalysis(currentSettings, mergedSettings);

  return {
    coreStale: currentStaleness.coreStale || (hasCoreData && coreSettingsChanged),
    evolutionStale:
      currentStaleness.evolutionStale || (hasEvolutionData && evolutionSettingsChanged),
  };
}
