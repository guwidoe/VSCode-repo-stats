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
    repository: RepositoryContext,
    settings: Partial<ExtensionSettings>,
    target: SettingWriteTarget
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const configTarget = this.toConfigurationTarget(target);
    const previousSettings = this.getSettings(repository);

    for (const update of flattenSettingsUpdate(settings)) {
      await config.update(update.key, update.value, configTarget);
    }

    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  async updateScopedSetting<K extends RepoScopableSettingKey>(
    repository: RepositoryContext,
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    await config.update(key, value, this.toConfigurationTarget(target));
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  async resetScopedSettingOverride(
    repository: RepositoryContext,
    key: RepoScopableSettingKey
  ): Promise<boolean> {
    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    await config.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  getRepoScopedSettings(repository: RepositoryContext): RepoScopedSettings {
    const config = this.getConfig(repository);

    return {
      excludePatterns: this.getScopedSettingValue(config, 'excludePatterns'),
      generatedPatterns: this.getScopedSettingValue(config, 'generatedPatterns'),
      binaryExtensions: this.getScopedSettingValue(config, 'binaryExtensions'),
      locExcludedExtensions: this.getScopedSettingValue(config, 'locExcludedExtensions'),
      includeSubmodules: this.getScopedSettingValue(config, 'includeSubmodules'),
      maxCommitsToAnalyze: this.getScopedSettingValue(config, 'maxCommitsToAnalyze'),
      'evolution.samplingMode': this.getScopedSettingValue(config, 'evolution.samplingMode'),
      'evolution.snapshotIntervalDays': this.getScopedSettingValue(config, 'evolution.snapshotIntervalDays'),
      'evolution.snapshotIntervalCommits': this.getScopedSettingValue(config, 'evolution.snapshotIntervalCommits'),
      'evolution.showInactivePeriods': this.getScopedSettingValue(config, 'evolution.showInactivePeriods'),
      'evolution.maxSnapshots': this.getScopedSettingValue(config, 'evolution.maxSnapshots'),
      'evolution.maxSeries': this.getScopedSettingValue(config, 'evolution.maxSeries'),
      'evolution.cohortFormat': this.getScopedSettingValue(config, 'evolution.cohortFormat'),
    };
  }

  getSettings(repository: RepositoryContext): ExtensionSettings {
    const config = this.getConfig(repository);

    return {
      excludePatterns: this.getRequiredConfigValue<string[]>(config, 'excludePatterns'),
      maxCommitsToAnalyze: this.getRequiredConfigValue<number>(config, 'maxCommitsToAnalyze'),
      defaultColorMode: this.getRequiredConfigValue<'language' | 'age' | 'complexity' | 'density'>(config, 'defaultColorMode'),
      generatedPatterns: this.getRequiredConfigValue<string[]>(config, 'generatedPatterns'),
      binaryExtensions: this.getRequiredConfigValue<string[]>(config, 'binaryExtensions'),
      locExcludedExtensions: this.getRequiredConfigValue<string[]>(config, 'locExcludedExtensions'),
      includeSubmodules: this.getRequiredConfigValue<boolean>(config, 'includeSubmodules'),
      showEmptyTimePeriods: this.getRequiredConfigValue<boolean>(config, 'showEmptyTimePeriods'),
      defaultGranularityMode: this.getRequiredConfigValue<'auto' | 'weekly' | 'monthly'>(config, 'defaultGranularityMode'),
      autoGranularityThreshold: this.getRequiredConfigValue<number>(config, 'autoGranularityThreshold'),
      overviewDisplayMode: this.getRequiredConfigValue<'percent' | 'count'>(config, 'overviewDisplayMode'),
      tooltipSettings: this.getRequiredConfigValue<ExtensionSettings['tooltipSettings']>(config, 'tooltipSettings'),
      evolution: {
        autoRun: this.getRequiredConfigValue<boolean>(config, 'evolution.autoRun'),
        samplingMode: this.getRequiredConfigValue<ExtensionSettings['evolution']['samplingMode']>(config, 'evolution.samplingMode'),
        snapshotIntervalDays: this.getRequiredConfigValue<number>(config, 'evolution.snapshotIntervalDays'),
        snapshotIntervalCommits: this.getRequiredConfigValue<number>(config, 'evolution.snapshotIntervalCommits'),
        showInactivePeriods: this.getRequiredConfigValue<boolean>(config, 'evolution.showInactivePeriods'),
        maxSnapshots: this.getRequiredConfigValue<number>(config, 'evolution.maxSnapshots'),
        maxSeries: this.getRequiredConfigValue<number>(config, 'evolution.maxSeries'),
        cohortFormat: this.getRequiredConfigValue<string>(config, 'evolution.cohortFormat'),
      },
    };
  }

  private getConfig(repository: RepositoryContext): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('repoStats', repository.workspaceFolder.uri);
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

    return buildScopedSettingValue(inspect) as unknown as RepoScopedSettings[K];
  }

  private toConfigurationTarget(target: SettingWriteTarget): vscode.ConfigurationTarget {
    return target === 'repo'
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : vscode.ConfigurationTarget.Global;
  }
}
