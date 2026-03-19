import type { ScopedSettingSource, SettingWriteTarget } from '../../types';
import { getScopedSettingSourceLabel } from '../../utils/scopedSettings';

interface ScopedSettingHeaderProps {
  target: SettingWriteTarget;
  source: ScopedSettingSource;
  hasRepoOverride: boolean;
  repoScopeAvailable?: boolean;
  compact?: boolean;
  onTargetChange: (target: SettingWriteTarget) => void;
  onResetRepoOverride: () => void;
}

export function ScopedSettingHeader({
  target,
  source,
  hasRepoOverride,
  repoScopeAvailable = true,
  compact = false,
  onTargetChange,
  onResetRepoOverride,
}: ScopedSettingHeaderProps) {
  return (
    <div className={`scoped-setting-header ${compact ? 'compact' : ''}`}>
      <div className="scoped-setting-targets" role="group" aria-label="Setting scope">
        <button
          type="button"
          className={`scoped-setting-target ${target === 'global' ? 'active' : ''}`}
          onClick={() => onTargetChange('global')}
        >
          Global
        </button>
        <button
          type="button"
          className={`scoped-setting-target ${target === 'repo' ? 'active' : ''}`}
          onClick={() => onTargetChange('repo')}
          disabled={!repoScopeAvailable}
          title={repoScopeAvailable ? undefined : 'Repo-scoped settings are only available when exactly one workspace repository is selected.'}
        >
          Repo
        </button>
      </div>

      {target === 'repo' && repoScopeAvailable && (
        <span className="scoped-setting-path-hint">
          Saved to <code>.vscode/settings.json</code>
        </span>
      )}

      <div className="scoped-setting-meta">
        <span className="scoped-setting-source">
          {getScopedSettingSourceLabel(source, target)}
        </span>
        {hasRepoOverride && (
          <button
            type="button"
            className="scoped-setting-reset"
            onClick={onResetRepoOverride}
          >
            Use Global
          </button>
        )}
      </div>
    </div>
  );
}
