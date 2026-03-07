import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScopedSettingHeader } from './ScopedSettingHeader';

describe('ScopedSettingHeader', () => {
  it('shows the repo settings file hint when repo scope is selected', () => {
    render(
      <ScopedSettingHeader
        target="repo"
        source="repo"
        hasRepoOverride
        onTargetChange={vi.fn()}
        onResetRepoOverride={vi.fn()}
      />
    );

    expect(screen.getByText('Saved to')).toBeInTheDocument();
    expect(screen.getByText('.vscode/settings.json')).toBeInTheDocument();
  });

  it('hides the repo settings file hint when global scope is selected', () => {
    const onTargetChange = vi.fn();

    render(
      <ScopedSettingHeader
        target="global"
        source="global"
        hasRepoOverride={false}
        onTargetChange={onTargetChange}
        onResetRepoOverride={vi.fn()}
      />
    );

    expect(screen.queryByText('.vscode/settings.json')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Repo' }));
    expect(onTargetChange).toHaveBeenCalledWith('repo');
  });

  it('supports compact rendering for dense settings groups', () => {
    const { container } = render(
      <ScopedSettingHeader
        target="repo"
        source="repo"
        hasRepoOverride
        compact
        onTargetChange={vi.fn()}
        onResetRepoOverride={vi.fn()}
      />
    );

    expect(container.firstChild).toHaveClass('scoped-setting-header', 'compact');
  });
});
