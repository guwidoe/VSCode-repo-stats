import type {
  AnalysisResult,
  AnalysisTargetOption,
  RepositoryOption,
} from './analysis.js';
import type {
  EvolutionProgressStage,
  EvolutionResult,
} from './evolution.js';
import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  SettingWriteTarget,
} from './settings.js';

export type ExtensionMessage =
  | { type: 'analysisStarted' }
  | { type: 'analysisCancelled' }
  | { type: 'analysisProgress'; phase: string; progress: number }
  | { type: 'analysisComplete'; data: AnalysisResult }
  | { type: 'analysisError'; error: string }
  | {
      type: 'repositorySelectionLoaded';
      repositories: RepositoryOption[];
      selectedRepositoryIds: string[];
      selectedTarget: AnalysisTargetOption | null;
    }
  | { type: 'incrementalUpdate'; data: Partial<AnalysisResult> }
  | { type: 'evolutionStarted' }
  | { type: 'evolutionCancelled' }
  | {
      type: 'evolutionProgress';
      phase: string;
      progress: number;
      stage: EvolutionProgressStage;
      currentRepositoryLabel?: string;
      currentRepositoryIndex?: number;
      totalRepositories?: number;
      currentSnapshotIndex?: number;
      totalSnapshots?: number;
      etaSeconds?: number;
    }
  | { type: 'evolutionComplete'; data: EvolutionResult }
  | { type: 'evolutionError'; error: string }
  | { type: 'evolutionStale'; reason: string }
  | { type: 'stalenessStatus'; coreStale: boolean; evolutionStale: boolean }
  | {
      type: 'settingsLoaded';
      settings: ExtensionSettings;
      scopedSettings: RepoScopedSettings;
      repoScopeAvailable: boolean;
    };

export type WebviewMessage =
  | { type: 'requestAnalysis' }
  | { type: 'requestRefresh' }
  | { type: 'cancelAnalysis' }
  | { type: 'requestEvolutionAnalysis' }
  | { type: 'requestEvolutionRefresh' }
  | { type: 'cancelEvolutionAnalysis' }
  | { type: 'checkStaleness' }
  | { type: 'updateRepositorySelection'; repositoryIds: string[] }
  | { type: 'openFile'; path: string; repositoryId?: string }
  | { type: 'revealInExplorer'; path: string; repositoryId?: string }
  | { type: 'copyPath'; path: string; repositoryId?: string }
  | { type: 'getSettings' }
  | { type: 'updateSettings'; settings: Partial<ExtensionSettings>; target?: SettingWriteTarget }
  | {
      type: 'updateScopedSetting';
      key: RepoScopableSettingKey;
      value: RepoScopableSettingValueMap[RepoScopableSettingKey];
      target: SettingWriteTarget;
    }
  | { type: 'resetScopedSetting'; key: RepoScopableSettingKey };
