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
  badge: string;
  tone: 'neutral' | 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  tooltip?: string;
}

const MAIN_VIEWS: ViewConfig[] = [
  { id: 'overview', label: 'Overview', badge: 'OV', tone: 'blue' },
  { id: 'files', label: 'Files', badge: 'FI', tone: 'neutral' },
  { id: 'contributors', label: 'Contributors', badge: 'CO', tone: 'purple' },
  { id: 'commits', label: 'Commits', badge: 'CM', tone: 'green' },
  { id: 'frequency', label: 'Code Frequency', badge: 'CF', tone: 'orange' },
  { id: 'evolution', label: 'Evolution', badge: 'EV', tone: 'pink' },
  { id: 'treemap', label: 'Treemap', badge: 'TM', tone: 'blue' },
];

const UTILITY_VIEWS: ViewConfig[] = [
  { id: 'about', label: 'About', badge: 'i', tone: 'neutral', tooltip: 'About & Help' },
  { id: 'settings', label: 'Settings', badge: 'S', tone: 'neutral', tooltip: 'Settings' },
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
            <span className={`nav-badge nav-badge-${view.tone}`} aria-hidden="true">{view.badge}</span>
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
            <span className={`nav-badge nav-badge-${view.tone}`} aria-hidden="true">{view.badge}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
