import { useMemo, useState } from 'react';
import type {
  CommitMetadataBuiltInExtractorConfig,
  CommitMetadataBucketMode,
  CommitMetadataCalendarGranularity,
  CommitMetadataChartType,
  CommitMetadataCommitBucketStrategy,
  CommitMetadataExtractorConfig,
  CommitMetadataMetric,
  CommitMetadataMultiValueMode,
  CommitMetadataRegexExtractorConfig,
  CommitMetadataSettings as CommitMetadataSettingsValue,
  RepoScopedSettings,
  SettingWriteTarget,
} from '../../types';
import { NumberSetting } from './NumberSetting';
import { SelectSetting } from './SelectSetting';
import { ScopedSettingHeader } from './ScopedSettingHeader';
import { getScopedSettingDisplayValue } from '../../utils/scopedSettings';

interface Props {
  scopedSettings: RepoScopedSettings;
  repoScopeAvailable: boolean;
  updateScopedSetting: (
    key: 'commitMetadata',
    value: CommitMetadataSettingsValue,
    target: SettingWriteTarget
  ) => void;
  resetScopedSetting: (key: 'commitMetadata') => void;
}

const BUILT_IN_EXAMPLES: Partial<Record<CommitMetadataBuiltInExtractorConfig['builtInId'], string>> = {
  conventionalType: 'feat(ui): add chart → feat',
  conventionalScope: 'feat(ui): add chart → ui',
  bracketTag: '[bug] fix parser → bug',
  hashTag: '#security harden auth → security',
  issueKey: 'PROJ-123 add workflow → PROJ-123',
  author: 'Commit author name',
  repository: 'Repository path/id in multi-repo targets',
  commitSize: '1–10, 11–100, 101–500 changed lines',
  fileCount: '1 file, 2–5 files, 6–20 files',
  directory: 'src/app.ts → src',
  fileExtension: 'src/app.ts → .ts',
};

function parseAliases(value: string): Record<string, string> {
  return Object.fromEntries(value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [from, to] = line.split('=').map((part) => part.trim());
      return from && to ? [from, to] : null;
    })
    .filter((entry): entry is [string, string] => Boolean(entry)));
}

function formatAliases(aliases: Record<string, string>): string {
  return Object.entries(aliases).map(([from, to]) => `${from}=${to}`).join('\n');
}

function getRegexError(extractor: CommitMetadataRegexExtractorConfig): string | null {
  try {
    const regex = new RegExp(extractor.regex, extractor.flags);
    const match = regex.exec(`[${extractor.captureGroup}] example`);
    if (extractor.captureGroup && !/^\d+$/.test(extractor.captureGroup) && !match?.groups?.[extractor.captureGroup]) {
      return `Regex is valid. Capture group “${extractor.captureGroup}” will be checked against real commit messages.`;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid regular expression';
  }
}

function createCustomExtractor(): CommitMetadataRegexExtractorConfig {
  const id = `custom-${Date.now()}`;
  return {
    id,
    name: 'Custom Regex Extractor',
    enabled: true,
    dimension: 'custom',
    includeUnmatched: false,
    unmatchedValue: 'Unmatched',
    aliases: {},
    kind: 'regex',
    regex: '\\[(?<tag>[^\\]]+)\\]',
    flags: 'g',
    captureGroup: 'tag',
    normalization: 'lowercase',
  };
}

export function CommitMetadataSettings({
  scopedSettings,
  repoScopeAvailable,
  updateScopedSetting,
  resetScopedSetting,
}: Props) {
  const [target, setTarget] = useState<SettingWriteTarget>(
    scopedSettings.commitMetadata.source === 'repo' ? 'repo' : 'global'
  );
  const resolvedTarget = target === 'repo' && !repoScopeAvailable ? 'global' : target;
  const metadata = getScopedSettingDisplayValue(scopedSettings, 'commitMetadata', resolvedTarget);

  const builtInExtractors = useMemo(
    () => metadata.extractors.filter((extractor): extractor is CommitMetadataBuiltInExtractorConfig => extractor.kind === 'builtIn'),
    [metadata.extractors]
  );
  const customExtractors = useMemo(
    () => metadata.extractors.filter((extractor): extractor is CommitMetadataRegexExtractorConfig => extractor.kind === 'regex'),
    [metadata.extractors]
  );

  const updateMetadata = (next: CommitMetadataSettingsValue) => updateScopedSetting('commitMetadata', next, resolvedTarget);
  const updateExtractor = (extractorId: string, patch: Partial<CommitMetadataExtractorConfig>) => {
    updateMetadata({
      ...metadata,
      extractors: metadata.extractors.map((extractor) => (
        extractor.id === extractorId ? { ...extractor, ...patch } as CommitMetadataExtractorConfig : extractor
      )),
    });
  };
  const removeExtractor = (extractorId: string) => {
    const nextExtractors = metadata.extractors.filter((extractor) => extractor.id !== extractorId);
    updateMetadata({
      ...metadata,
      extractors: nextExtractors,
      defaultExtractorId: metadata.defaultExtractorId === extractorId
        ? nextExtractors[0]?.id ?? ''
        : metadata.defaultExtractorId,
    });
  };

  const header = (
    <ScopedSettingHeader
      target={resolvedTarget}
      source={scopedSettings.commitMetadata.source}
      hasRepoOverride={scopedSettings.commitMetadata.repoValue !== undefined}
      repoScopeAvailable={repoScopeAvailable}
      onTargetChange={(nextTarget) => setTarget(nextTarget === 'repo' && !repoScopeAvailable ? 'global' : nextTarget)}
      onResetRepoOverride={() => resetScopedSetting('commitMetadata')}
    />
  );

  return (
    <div className="settings-sections commit-metadata-settings">
      <section className="setting-section">
        <div className="setting-header">
          <div className="setting-header-main">
            <h3 className="setting-title">Commit Metadata Extractors</h3>
            <p className="setting-description">Enable built-in dimensions or add regex extractors for team-specific tags, ticket keys, and categories.</p>
          </div>
          <div className="setting-header-aside">{header}</div>
        </div>

        <div className="commit-metadata-settings-grid">
          {builtInExtractors.map((extractor) => renderBuiltInExtractorCard(extractor, updateExtractor))}
        </div>
      </section>

      <section className="setting-section">
        <div className="setting-header">
          <div className="setting-header-main">
            <h3 className="setting-title">Custom Regex Extractors</h3>
            <p className="setting-description">Use named or numeric capture groups. Alias lines use <code>from=to</code>, one per line.</p>
          </div>
          <button
            type="button"
            className="settings-action-button"
            onClick={() => updateMetadata({ ...metadata, extractors: [...metadata.extractors, createCustomExtractor()] })}
          >
            Add custom extractor
          </button>
        </div>

        {customExtractors.length === 0 ? (
          <p className="commit-metadata-settings-empty">No custom extractors yet.</p>
        ) : (
          <div className="commit-metadata-settings-list">
            {customExtractors.map((extractor) => renderRegexExtractorCard(extractor, updateExtractor, removeExtractor))}
          </div>
        )}
      </section>

      <SelectSetting
        title="Default Extractor"
        description="Initial dimension shown in the Commits → Metadata Trends view."
        value={metadata.defaultExtractorId}
        options={metadata.extractors.map((extractor) => ({ value: extractor.id, label: extractor.name }))}
        onChange={(value) => updateMetadata({ ...metadata, defaultExtractorId: value })}
      />

      <SelectSetting
        title="Default Bucket Mode"
        description="Choose whether Metadata Trends starts with calendar time or commit-count buckets."
        value={metadata.defaultBucketMode}
        options={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'commitCount', label: 'Commit count' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, defaultBucketMode: value as CommitMetadataBucketMode })}
      />

      <SelectSetting
        title="Default Calendar Granularity"
        description="Calendar bucket size used by default."
        value={metadata.defaultCalendarGranularity}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'quarter', label: 'Quarter' },
          { value: 'year', label: 'Year' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, defaultCalendarGranularity: value as CommitMetadataCalendarGranularity })}
      />

      <SelectSetting
        title="Default Commit Bucket Strategy"
        description="Commit-count bucketing can use fixed-size windows or split history into equal buckets."
        value={metadata.defaultCommitBucketStrategy}
        options={[
          { value: 'fixedSize', label: 'Every N commits' },
          { value: 'equalBuckets', label: 'Equal buckets' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, defaultCommitBucketStrategy: value as CommitMetadataCommitBucketStrategy })}
      />

      <NumberSetting
        title="Default Commit Bucket Size"
        description="Number of commits per bucket when using fixed-size commit buckets."
        value={metadata.defaultCommitBucketSize}
        min={1}
        max={10000}
        onChange={(value) => updateMetadata({ ...metadata, defaultCommitBucketSize: value })}
      />

      <NumberSetting
        title="Default Equal Bucket Count"
        description="Number of buckets when splitting history into equal commit-count buckets."
        value={metadata.defaultCommitBucketCount}
        min={1}
        max={200}
        onChange={(value) => updateMetadata({ ...metadata, defaultCommitBucketCount: value })}
      />

      <SelectSetting
        title="Default Metric"
        description="Metric used for chart values by default."
        value={metadata.defaultMetric}
        options={[
          { value: 'commits', label: 'Commits' },
          { value: 'additions', label: 'Additions' },
          { value: 'deletions', label: 'Deletions' },
          { value: 'changedLines', label: 'Changed lines' },
          { value: 'filesChanged', label: 'Files changed' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, defaultMetric: value as CommitMetadataMetric })}
      />

      <SelectSetting
        title="Default Chart Type"
        description="Initial visualization in the Metadata Trends view."
        value={metadata.defaultChartType}
        options={[
          { value: 'stackedBar', label: 'Stacked bar' },
          { value: 'normalizedStackedBar', label: '100% stacked bar' },
          { value: 'heatmap', label: 'Heatmap' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, defaultChartType: value as CommitMetadataChartType })}
      />

      <SelectSetting
        title="Multi-value Mode"
        description="How to count commits matching multiple values for the same extractor."
        value={metadata.multiValueMode}
        options={[
          { value: 'countEach', label: 'Count once for each value' },
          { value: 'split', label: 'Split weight across values' },
          { value: 'first', label: 'Use first value only' },
        ]}
        onChange={(value) => updateMetadata({ ...metadata, multiValueMode: value as CommitMetadataMultiValueMode })}
      />

      <NumberSetting
        title="Maximum Series"
        description="Maximum number of metadata values shown before grouping or hiding the rest."
        value={metadata.maxSeries}
        min={1}
        max={100}
        onChange={(value) => updateMetadata({ ...metadata, maxSeries: value })}
      />
    </div>
  );
}

function renderBuiltInExtractorCard(
  extractor: CommitMetadataBuiltInExtractorConfig,
  updateExtractor: (extractorId: string, patch: Partial<CommitMetadataExtractorConfig>) => void
) {
  return (
    <div key={extractor.id} className="commit-metadata-extractor-card">
      <label className="commit-metadata-toggle-row">
        <input
          type="checkbox"
          checked={extractor.enabled}
          onChange={(event) => updateExtractor(extractor.id, { enabled: event.target.checked })}
        />
        <strong>{extractor.name}</strong>
      </label>
      <span>{BUILT_IN_EXAMPLES[extractor.builtInId]}</span>
      <label>
        Dimension
        <input value={extractor.dimension} onChange={(event) => updateExtractor(extractor.id, { dimension: event.target.value })} />
      </label>
      <label>
        Unmatched label
        <input value={extractor.unmatchedValue} onChange={(event) => updateExtractor(extractor.id, { unmatchedValue: event.target.value })} />
      </label>
      <label className="commit-metadata-toggle-row">
        <input
          type="checkbox"
          checked={extractor.includeUnmatched}
          onChange={(event) => updateExtractor(extractor.id, { includeUnmatched: event.target.checked })}
        />
        Include unmatched commits for this extractor
      </label>
    </div>
  );
}

function renderRegexExtractorCard(
  extractor: CommitMetadataRegexExtractorConfig,
  updateExtractor: (extractorId: string, patch: Partial<CommitMetadataExtractorConfig>) => void,
  removeExtractor: (extractorId: string) => void
) {
  const regexError = getRegexError(extractor);
  return (
    <div key={extractor.id} className="commit-metadata-extractor-card commit-metadata-regex-card">
      <div className="commit-metadata-regex-header">
        <label className="commit-metadata-toggle-row">
          <input
            type="checkbox"
            checked={extractor.enabled}
            onChange={(event) => updateExtractor(extractor.id, { enabled: event.target.checked })}
          />
          <strong>{extractor.name}</strong>
        </label>
        <button type="button" className="settings-danger-button" onClick={() => removeExtractor(extractor.id)}>Remove</button>
      </div>

      <label>
        Name
        <input value={extractor.name} onChange={(event) => updateExtractor(extractor.id, { name: event.target.value })} />
      </label>
      <label>
        Regex
        <input value={extractor.regex} onChange={(event) => updateExtractor(extractor.id, { regex: event.target.value })} />
      </label>
      <div className="commit-metadata-settings-two-col">
        <label>
          Flags
          <input value={extractor.flags} onChange={(event) => updateExtractor(extractor.id, { flags: event.target.value })} />
        </label>
        <label>
          Capture group
          <input value={extractor.captureGroup} onChange={(event) => updateExtractor(extractor.id, { captureGroup: event.target.value })} />
        </label>
      </div>
      {regexError && <p className="commit-metadata-settings-error">{regexError}</p>}
      <div className="commit-metadata-settings-two-col">
        <label>
          Dimension
          <input value={extractor.dimension} onChange={(event) => updateExtractor(extractor.id, { dimension: event.target.value })} />
        </label>
        <label>
          Normalize
          <select value={extractor.normalization} onChange={(event) => updateExtractor(extractor.id, { normalization: event.target.value as CommitMetadataRegexExtractorConfig['normalization'] })}>
            <option value="none">None</option>
            <option value="lowercase">Lowercase</option>
            <option value="uppercase">Uppercase</option>
          </select>
        </label>
      </div>
      <label>
        Aliases
        <textarea value={formatAliases(extractor.aliases)} onChange={(event) => updateExtractor(extractor.id, { aliases: parseAliases(event.target.value) })} />
      </label>
      <label>
        Unmatched label
        <input value={extractor.unmatchedValue} onChange={(event) => updateExtractor(extractor.id, { unmatchedValue: event.target.value })} />
      </label>
    </div>
  );
}
