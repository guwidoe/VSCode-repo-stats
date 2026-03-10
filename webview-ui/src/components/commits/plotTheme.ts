function readThemeVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export interface CommitPlotTheme {
  foreground: string;
  muted: string;
  border: string;
}

export function getCommitPlotTheme(): CommitPlotTheme {
  return {
    foreground: readThemeVar('--vscode-foreground', '#d4d4d4'),
    muted: readThemeVar('--vscode-descriptionForeground', '#9da1a6'),
    border: readThemeVar('--vscode-panel-border', 'rgba(255, 255, 255, 0.18)'),
  };
}
