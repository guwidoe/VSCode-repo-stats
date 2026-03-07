import type { ScopedSettingSource, SettingWriteTarget } from '../../types';
import { getScopedSettingSourceLabel } from '../../utils/scopedSettings';

interface ScopedSettingHeaderProps {
  target: SettingWriteTarget;
  source: ScopedSettingSource;
  hasRepoOverride: boolean;
  onTargetChange: (target: SettingWriteTarget) => void;
  onResetRepoOverride: () => void;
}

export function ScopedSettingHeader({
  target,
  source,
  hasRepoOverride,
  onTargetChange,
  onResetRepoOverride,
}: ScopedSettingHeaderProps) {
  return (
    <div className="scoped-setting-header">
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
        >
          Repo
        </button>
      </div>

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
