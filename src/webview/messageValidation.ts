import type {
  ExtensionSettings,
  EvolutionSamplingMode,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
  WebviewMessage,
} from '../types/index.js';
import { REPO_SCOPABLE_SETTING_KEYS } from '../types/index.js';

const SETTING_WRITE_TARGETS = ['global', 'repo'] as const satisfies readonly SettingWriteTarget[];
const EVOLUTION_SAMPLING_MODES = ['time', 'commit', 'auto'] as const satisfies readonly EvolutionSamplingMode[];
const TREEMAP_COLOR_MODES = ['language', 'age', 'complexity', 'density'] as const;
const GRANULARITY_MODES = ['auto', 'weekly', 'monthly'] as const;
const OVERVIEW_DISPLAY_MODES = ['percent', 'count'] as const;
const TREEMAP_AGE_RANGE_MODES = ['auto', 'custom'] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEnumValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isSettingWriteTarget(value: unknown): value is SettingWriteTarget {
  return isEnumValue(value, SETTING_WRITE_TARGETS);
}

function isRepoScopableSettingKey(value: unknown): value is RepoScopableSettingKey {
  return typeof value === 'string' && REPO_SCOPABLE_SETTING_KEYS.includes(value as RepoScopableSettingKey);
}

function isTooltipSettings(value: unknown): value is ExtensionSettings['tooltipSettings'] {
  if (!isRecord(value)) {
    return false;
  }

  return isBoolean(value.showLinesOfCode)
    && isBoolean(value.showFileSize)
    && isBoolean(value.showLanguage)
    && isBoolean(value.showLastModified)
    && isBoolean(value.showComplexity)
    && isBoolean(value.showCommentLines)
    && isBoolean(value.showCommentRatio)
    && isBoolean(value.showBlankLines)
    && isBoolean(value.showCodeDensity)
    && isBoolean(value.showFileCount);
}

function isTreemapSettings(value: unknown): value is ExtensionSettings['treemap'] {
  if (!isRecord(value)) {
    return false;
  }

  return isEnumValue(value.ageColorRangeMode, TREEMAP_AGE_RANGE_MODES)
    && typeof value.ageColorNewestDate === 'string'
    && typeof value.ageColorOldestDate === 'string';
}

function isEvolutionSettings(value: unknown): value is ExtensionSettings['evolution'] {
  if (!isRecord(value)) {
    return false;
  }

  return isBoolean(value.autoRun)
    && isEnumValue(value.samplingMode, EVOLUTION_SAMPLING_MODES)
    && isNumber(value.snapshotIntervalDays)
    && isBoolean(value.showInactivePeriods)
    && isNumber(value.maxSnapshots)
    && isNumber(value.maxSeries)
    && typeof value.cohortFormat === 'string';
}

function isPartialExtensionSettings(value: unknown): value is Partial<ExtensionSettings> {
  if (!isRecord(value)) {
    return false;
  }

  return (value.excludePatterns === undefined || isStringArray(value.excludePatterns))
    && (value.maxCommitsToAnalyze === undefined || isNumber(value.maxCommitsToAnalyze))
    && (value.defaultColorMode === undefined || isEnumValue(value.defaultColorMode, TREEMAP_COLOR_MODES))
    && (value.generatedPatterns === undefined || isStringArray(value.generatedPatterns))
    && (value.binaryExtensions === undefined || isStringArray(value.binaryExtensions))
    && (value.locExcludedExtensions === undefined || isStringArray(value.locExcludedExtensions))
    && (value.showEmptyTimePeriods === undefined || isBoolean(value.showEmptyTimePeriods))
    && (value.defaultGranularityMode === undefined || isEnumValue(value.defaultGranularityMode, GRANULARITY_MODES))
    && (value.autoGranularityThreshold === undefined || isNumber(value.autoGranularityThreshold))
    && (value.overviewDisplayMode === undefined || isEnumValue(value.overviewDisplayMode, OVERVIEW_DISPLAY_MODES))
    && (value.tooltipSettings === undefined || isTooltipSettings(value.tooltipSettings))
    && (value.treemap === undefined || isTreemapSettings(value.treemap))
    && (value.evolution === undefined || isEvolutionSettings(value.evolution));
}

function isScopedSettingValue<K extends RepoScopableSettingKey>(
  key: K,
  value: unknown
): value is RepoScopableSettingValueMap[K] {
  switch (key) {
    case 'excludePatterns':
    case 'generatedPatterns':
    case 'binaryExtensions':
    case 'locExcludedExtensions':
      return isStringArray(value);
    case 'maxCommitsToAnalyze':
    case 'evolution.snapshotIntervalDays':
    case 'evolution.maxSnapshots':
    case 'evolution.maxSeries':
      return isNumber(value);
    case 'evolution.showInactivePeriods':
      return isBoolean(value);
    case 'evolution.samplingMode':
      return isEnumValue(value, EVOLUTION_SAMPLING_MODES);
    case 'evolution.cohortFormat':
      return typeof value === 'string';
  }
}

function isPathMessagePayload(record: UnknownRecord): record is UnknownRecord & { path: string; repositoryId?: string } {
  return typeof record.path === 'string'
    && (record.repositoryId === undefined || typeof record.repositoryId === 'string');
}

export function validateLogicalPath(logicalPath: string): void {
  if (logicalPath.length === 0) {
    throw new Error('Repo Stats received an empty path from the webview.');
  }

  if (logicalPath.includes('\0')) {
    throw new Error('Repo Stats rejected a path with invalid characters from the webview.');
  }

  const normalized = logicalPath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    throw new Error('Repo Stats rejected an absolute path from the webview.');
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new Error('Repo Stats rejected a path traversal request from the webview.');
  }
}

export function resolveContainedPath(repoPath: string, relativePath: string, pathModule: Pick<typeof import('path'), 'resolve' | 'sep'>): string {
  const normalizedRelativePath = relativePath.replace(/\\/g, '/');
  if (normalizedRelativePath.length > 0) {
    const segments = normalizedRelativePath.split('/');
    if (segments.some((segment) => segment === '..')) {
      throw new Error('Repo Stats rejected a path outside the selected repository.');
    }
  }

  const resolvedRepoPath = pathModule.resolve(repoPath);
  const resolvedTargetPath = pathModule.resolve(resolvedRepoPath, normalizedRelativePath);
  if (
    resolvedTargetPath !== resolvedRepoPath
    && !resolvedTargetPath.startsWith(`${resolvedRepoPath}${pathModule.sep}`)
  ) {
    throw new Error('Repo Stats rejected a path outside the selected repository.');
  }

  return resolvedTargetPath;
}

export function parseWebviewMessage(message: unknown): WebviewMessage {
  if (!isRecord(message) || typeof message.type !== 'string') {
    throw new Error('Received malformed webview message payload.');
  }

  switch (message.type) {
    case 'requestAnalysis':
    case 'requestRefresh':
    case 'requestEvolutionAnalysis':
    case 'requestEvolutionRefresh':
    case 'checkStaleness':
    case 'getSettings':
      return { type: message.type };

    case 'updateRepositorySelection':
      if (!isStringArray(message.repositoryIds)) {
        throw new Error('Expected repositoryIds to be an array of strings.');
      }
      return { type: 'updateRepositorySelection', repositoryIds: message.repositoryIds };

    case 'openFile':
    case 'revealInExplorer':
      if (!isPathMessagePayload(message)) {
        throw new Error(`Expected ${message.type} to include a string path payload.`);
      }
      return {
        type: message.type,
        path: message.path,
        repositoryId: message.repositoryId,
      };

    case 'copyPath':
      if (!isPathMessagePayload(message)) {
        throw new Error('Expected copyPath to include a string path payload.');
      }
      return { type: 'copyPath', path: message.path, repositoryId: message.repositoryId };

    case 'updateSettings':
      if (!isPartialExtensionSettings(message.settings)) {
        throw new Error('Received invalid settings payload from webview.');
      }
      if (message.target !== undefined && !isSettingWriteTarget(message.target)) {
        throw new Error('Received invalid settings target from webview.');
      }
      return {
        type: 'updateSettings',
        settings: message.settings,
        target: message.target,
      };

    case 'updateScopedSetting':
      if (!isRepoScopableSettingKey(message.key)) {
        throw new Error('Received invalid scoped setting key from webview.');
      }
      if (!isSettingWriteTarget(message.target)) {
        throw new Error('Received invalid scoped setting target from webview.');
      }
      if (!isScopedSettingValue(message.key, message.value)) {
        throw new Error(`Received invalid value for scoped setting ${message.key}.`);
      }
      return {
        type: 'updateScopedSetting',
        key: message.key,
        value: message.value,
        target: message.target,
      };

    case 'resetScopedSetting':
      if (!isRepoScopableSettingKey(message.key)) {
        throw new Error('Received invalid scoped setting key from webview.');
      }
      return { type: 'resetScopedSetting', key: message.key };

    default:
      throw new Error(`Received unknown webview message type: ${message.type}`);
  }
}
