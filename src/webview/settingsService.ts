import * as vscode from 'vscode';
import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  SettingWriteTarget,
} from '../types/index.js';
import { buildScopedSettingValue } from './scopedSettings.js';
import {
  flattenSettingsUpdate,
  settingsAffectCoreAnalysis,
} from '../shared/settings.js';
import type { RepositoryContext } from './context.js';

export class RepositorySettingsService {
  async updateSettings(
    repository: RepositoryContext | undefined,
    settings: Partial<ExtensionSettings>,
    target: SettingWriteTarget
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const configTarget = this.toConfigurationTarget(repository, target);
    const previousSettings = this.getSettings(repository);

    for (const update of flattenSettingsUpdate(settings)) {
      await config.update(update.key, update.value, configTarget);
    }

    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  async updateScopedSetting<K extends RepoScopableSettingKey>(
    repository: RepositoryContext | undefined,
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    await config.update(key, value, this.toConfigurationTarget(repository, target));
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  async resetScopedSettingOverride(
    repository: RepositoryContext | undefined,
    key: RepoScopableSettingKey
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    if (!repository?.workspaceFolder) {
      throw new Error('Repo-scoped settings are only available for repositories inside the current workspace.');
    }

    await config.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  getRepoScopedSettings(repository?: RepositoryContext): RepoScopedSettings {
    const config = this.getConfig(repository);

    return {
      excludePatterns: this.getScopedSettingValue(config, 'excludePatterns'),
      generatedPatterns: this.getScopedSettingValue(config, 'generatedPatterns'),
      binaryExtensions: this.getScopedSettingValue(config, 'binaryExtensions'),
      locExcludedExtensions: this.getScopedSettingValue(config, 'locExcludedExtensions'),
      maxCommitsToAnalyze: this.getScopedSettingValue(config, 'maxCommitsToAnalyze'),
      'evolution.samplingMode': this.getScopedSettingValue(config, 'evolution.samplingMode'),
      'evolution.snapshotIntervalDays': this.getScopedSettingValue(config, 'evolution.snapshotIntervalDays'),
      'evolution.showInactivePeriods': this.getScopedSettingValue(config, 'evolution.showInactivePeriods'),
      'evolution.maxSnapshots': this.getScopedSettingValue(config, 'evolution.maxSnapshots'),
      'evolution.maxSeries': this.getScopedSettingValue(config, 'evolution.maxSeries'),
      'evolution.cohortFormat': this.getScopedSettingValue(config, 'evolution.cohortFormat'),
    };
  }

  getSettings(repository?: RepositoryContext): ExtensionSettings {
    const config = this.getConfig(repository);

    return {
      excludePatterns: this.getRequiredConfigValue<string[]>(config, 'excludePatterns'),
      maxCommitsToAnalyze: this.getRequiredConfigValue<number>(config, 'maxCommitsToAnalyze'),
      defaultColorMode: this.getRequiredConfigValue<'language' | 'age' | 'complexity' | 'density'>(config, 'defaultColorMode'),
      generatedPatterns: this.getRequiredConfigValue<string[]>(config, 'generatedPatterns'),
      binaryExtensions: this.getRequiredConfigValue<string[]>(config, 'binaryExtensions'),
      locExcludedExtensions: this.getRequiredConfigValue<string[]>(config, 'locExcludedExtensions'),
      showEmptyTimePeriods: this.getRequiredConfigValue<boolean>(config, 'showEmptyTimePeriods'),
      defaultGranularityMode: this.getRequiredConfigValue<'auto' | 'weekly' | 'monthly'>(config, 'defaultGranularityMode'),
      autoGranularityThreshold: this.getRequiredConfigValue<number>(config, 'autoGranularityThreshold'),
      overviewDisplayMode: this.getRequiredConfigValue<'percent' | 'count'>(config, 'overviewDisplayMode'),
      tooltipSettings: this.getRequiredConfigValue<ExtensionSettings['tooltipSettings']>(config, 'tooltipSettings'),
      treemap: {
        ageColorRangeMode: this.getRequiredConfigValue<ExtensionSettings['treemap']['ageColorRangeMode']>(config, 'treemap.ageColorRangeMode'),
        ageColorNewestDate: this.getRequiredConfigValue<string>(config, 'treemap.ageColorNewestDate'),
        ageColorOldestDate: this.getRequiredConfigValue<string>(config, 'treemap.ageColorOldestDate'),
      },
      evolution: {
        autoRun: this.getRequiredConfigValue<boolean>(config, 'evolution.autoRun'),
        samplingMode: this.getRequiredConfigValue<ExtensionSettings['evolution']['samplingMode']>(config, 'evolution.samplingMode'),
        snapshotIntervalDays: this.getRequiredConfigValue<number>(config, 'evolution.snapshotIntervalDays'),
        showInactivePeriods: this.getRequiredConfigValue<boolean>(config, 'evolution.showInactivePeriods'),
        maxSnapshots: this.getRequiredConfigValue<number>(config, 'evolution.maxSnapshots'),
        maxSeries: this.getRequiredConfigValue<number>(config, 'evolution.maxSeries'),
        cohortFormat: this.getRequiredConfigValue<string>(config, 'evolution.cohortFormat'),
      },
    };
  }

  canUseRepoScope(repository?: RepositoryContext): boolean {
    return repository?.workspaceFolder !== undefined;
  }

  private getConfig(repository?: RepositoryContext): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('repoStats', repository?.workspaceFolder?.uri ?? repository?.rootUri);
  }

  private getRequiredConfigValue<T>(config: vscode.WorkspaceConfiguration, key: string): T {
    const value = config.get<T>(key);
    if (value === undefined) {
      throw new Error(
        `Missing required configuration value: repoStats.${key}. ` +
        'Check package.json contributes.configuration defaults and user/workspace settings.'
      );
    }
    return value;
  }

  private getScopedSettingValue<K extends RepoScopableSettingKey>(
    config: vscode.WorkspaceConfiguration,
    key: K
  ): RepoScopedSettings[K] {
    const inspect = config.inspect<RepoScopableSettingValueMap[K]>(key);
    if (!inspect) {
      throw new Error(
        `Missing inspect data for configuration value: repoStats.${key}. ` +
        'Check package.json contributes.configuration registration.'
      );
    }

    return buildScopedSettingValue(inspect);
  }

  private toConfigurationTarget(
    repository: RepositoryContext | undefined,
    target: SettingWriteTarget
  ): vscode.ConfigurationTarget {
    if (target === 'repo') {
      if (!repository?.workspaceFolder) {
        throw new Error('Repo-scoped settings are only available for repositories inside the current workspace.');
      }
      return vscode.ConfigurationTarget.WorkspaceFolder;
    }

    return vscode.ConfigurationTarget.Global;
  }
}
