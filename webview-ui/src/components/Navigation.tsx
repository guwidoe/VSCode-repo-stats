import React from 'react';
import { useStore } from '../store';

export const Navigation: React.FC = () => {
  const { activeView, setActiveView, repoInfo } = useStore();

  return (
    <div>
      {repoInfo && (
        <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
          {repoInfo.name} • {repoInfo.branch} • {repoInfo.totalCommits.toLocaleString()} commits • {repoInfo.totalFiles.toLocaleString()} files • {repoInfo.totalLines.toLocaleString()} lines
        </div>
      )}
      <nav className="navigation">
        <button
          className={`nav-button ${activeView === 'contributors' ? 'active' : ''}`}
          onClick={() => setActiveView('contributors')}
        >
          Contributors
        </button>
        <button
          className={`nav-button ${activeView === 'frequency' ? 'active' : ''}`}
          onClick={() => setActiveView('frequency')}
        >
          Code Frequency
        </button>
        <button
          className={`nav-button ${activeView === 'treemap' ? 'active' : ''}`}
          onClick={() => setActiveView('treemap')}
        >
          Treemap
        </button>
      </nav>
    </div>
  );
};
