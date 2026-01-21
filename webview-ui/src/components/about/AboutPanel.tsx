/**
 * AboutPanel - Information about the extension, developer, and helpful links.
 */

import { useStore } from '../../store';
import './AboutPanel.css';

const GITHUB_REPO = 'https://github.com/guwidoe/vscode-repo-stats';
const ISSUE_TRACKER = 'https://github.com/guwidoe/vscode-repo-stats/issues';

export function AboutPanel() {
  const data = useStore((state) => state.data);

  return (
    <div className="about-panel">
      <div className="about-hero">
        <div className="about-logo">
          <span className="logo-icon">📊</span>
        </div>
        <h1 className="about-title">Repository Statistics</h1>
        <p className="about-subtitle">
          A VSCode extension for visualizing repository insights
        </p>
      </div>

      <div className="about-sections">
        {/* What it does */}
        <section className="about-section">
          <h2>Features</h2>
          <ul className="feature-list">
            <li>
              <span className="feature-icon">📋</span>
              <div>
                <strong>Overview</strong>
                <p>Get a quick summary of your repository: files, languages, and largest files.</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">👥</span>
              <div>
                <strong>Contributors</strong>
                <p>See who has contributed, their commit history, and lines added/removed.</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">📈</span>
              <div>
                <strong>Code Frequency</strong>
                <p>Track additions and deletions over time to see project activity trends.</p>
              </div>
            </li>
            <li>
              <span className="feature-icon">🗂️</span>
              <div>
                <strong>Treemap</strong>
                <p>Visualize your codebase structure with an interactive treemap colored by language or file age.</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Tool Info */}
        {data?.sccInfo && (
          <section className="about-section">
            <h2>Analysis Engine</h2>
            <div className="info-card">
              <div className="info-row">
                <span className="info-label">LOC Counter</span>
                <span className="info-value">scc v{data.sccInfo.version}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Source</span>
                <span className="info-value">
                  {data.sccInfo.source === 'system' ? 'System installed' :
                   data.sccInfo.source === 'downloaded' ? 'Auto-downloaded' : 'Not available'}
                </span>
              </div>
              <p className="info-note">
                This extension uses <a href="https://github.com/boyter/scc" target="_blank" rel="noopener noreferrer">scc</a> for
                fast and accurate line counting. Your .gitignore rules are automatically respected.
              </p>
            </div>
          </section>
        )}

        {/* Links */}
        <section className="about-section">
          <h2>Links & Support</h2>
          <div className="link-cards">
            <a href={GITHUB_REPO} className="link-card" target="_blank" rel="noopener noreferrer">
              <span className="link-icon">📁</span>
              <div>
                <strong>GitHub Repository</strong>
                <p>View source code and contribute</p>
              </div>
            </a>
            <a href={ISSUE_TRACKER} className="link-card" target="_blank" rel="noopener noreferrer">
              <span className="link-icon">🐛</span>
              <div>
                <strong>Report Issues</strong>
                <p>Bug reports and feature requests</p>
              </div>
            </a>
            <a href={`${GITHUB_REPO}#readme`} className="link-card" target="_blank" rel="noopener noreferrer">
              <span className="link-icon">📖</span>
              <div>
                <strong>Documentation</strong>
                <p>Usage guide and tips</p>
              </div>
            </a>
          </div>
        </section>

        {/* Developer */}
        <section className="about-section">
          <h2>Developer</h2>
          <div className="developer-card">
            <div className="developer-info">
              <p>
                Created and maintained by <strong>gwd</strong>
              </p>
              <p className="developer-note">
                This extension is open source and free to use. If you find it useful,
                consider starring the repository on GitHub!
              </p>
            </div>
          </div>
        </section>

        {/* Legal */}
        <section className="about-section about-legal">
          <h2>License & Legal</h2>
          <p>
            This extension is released under the MIT License.
            See the <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">LICENSE</a> file
            for details.
          </p>
          <p className="disclaimer">
            This extension analyzes local repository data only. No data is collected or sent externally.
          </p>
        </section>
      </div>
    </div>
  );
}
