/**
 * Navigation component for switching between views.
 * Main views are on the left, utility views (Settings, About) are icon-only on the right.
 */

import { useStore } from '../store';
import type { ViewType } from '../types';
import './Navigation.css';

interface ViewConfig {
  id: ViewType;
  label: string;
  icon: string;
  tooltip?: string;
}

const MAIN_VIEWS: ViewConfig[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'contributors', label: 'Contributors', icon: '👥' },
  { id: 'frequency', label: 'Code Frequency', icon: '📊' },
  { id: 'treemap', label: 'Treemap', icon: '🗂️' },
];

const UTILITY_VIEWS: ViewConfig[] = [
  { id: 'about', label: 'About', icon: 'ℹ️', tooltip: 'About & Help' },
  { id: 'settings', label: 'Settings', icon: '⚙️', tooltip: 'Settings' },
];

export function Navigation() {
  const { activeView, setActiveView } = useStore();

  return (
    <nav className="navigation">
      <div className="nav-main">
        {MAIN_VIEWS.map((view) => (
          <button
            key={view.id}
            className={`nav-button ${activeView === view.id ? 'active' : ''}`}
            onClick={() => setActiveView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
          >
            <span className="nav-icon">{view.icon}</span>
            <span className="nav-label">{view.label}</span>
          </button>
        ))}
      </div>
      <div className="nav-utility">
        {UTILITY_VIEWS.map((view) => (
          <button
            key={view.id}
            className={`nav-button nav-icon-only ${activeView === view.id ? 'active' : ''}`}
            onClick={() => setActiveView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
            title={view.tooltip || view.label}
            aria-label={view.label}
          >
            <span className="nav-icon">{view.icon}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
