/**
 * Navigation component for switching between views.
 */

import { useStore } from '../store';
import type { ViewType } from '../types';
import './Navigation.css';

const VIEWS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'contributors', label: 'Contributors', icon: '👥' },
  { id: 'frequency', label: 'Code Frequency', icon: '📊' },
  { id: 'treemap', label: 'Treemap', icon: '🗂️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Navigation() {
  const { activeView, setActiveView } = useStore();

  return (
    <nav className="navigation">
      {VIEWS.map((view) => (
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
    </nav>
  );
}
