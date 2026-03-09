/**
 * Navigation component for switching between views.
 * Main views are on the left, utility views (Settings, About) are on the right.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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

const OVERFLOW_BUTTON_WIDTH = 54;

export function Navigation() {
  const { activeView, setActiveView } = useStore();
  const navMainRef = useRef<HTMLDivElement | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef(new Map<ViewType, HTMLButtonElement>());
  const [visibleMainCount, setVisibleMainCount] = useState(MAIN_VIEWS.length);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  useEffect(() => {
    const recalculate = () => {
      const container = navMainRef.current;
      if (!container) {
        return;
      }

      const availableWidth = container.clientWidth;
      if (availableWidth <= 0) {
        return;
      }

      const widths = MAIN_VIEWS.map((view) => measureRefs.current.get(view.id)?.offsetWidth ?? 0)
        .filter((width) => width > 0);

      if (widths.length !== MAIN_VIEWS.length) {
        return;
      }

      let usedWidth = 0;
      let count = 0;
      const totalWidth = widths.reduce((sum, width) => sum + width, 0);
      if (totalWidth <= availableWidth) {
        setVisibleMainCount(MAIN_VIEWS.length);
        return;
      }

      for (let index = 0; index < widths.length; index += 1) {
        const width = widths[index] ?? 0;
        const remainingViews = widths.length - (index + 1);
        const reserveOverflow = remainingViews > 0 ? OVERFLOW_BUTTON_WIDTH : 0;
        if (usedWidth + width + reserveOverflow > availableWidth) {
          break;
        }
        usedWidth += width;
        count += 1;
      }

      setVisibleMainCount(Math.max(1, count));
    };

    recalculate();

    const container = navMainRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      recalculate();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (visibleMainCount >= MAIN_VIEWS.length) {
      setIsOverflowOpen(false);
    }
  }, [visibleMainCount]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const visibleViews = useMemo(
    () => MAIN_VIEWS.slice(0, visibleMainCount),
    [visibleMainCount]
  );
  const overflowViews = useMemo(
    () => MAIN_VIEWS.slice(visibleMainCount),
    [visibleMainCount]
  );

  const handleSelectView = (viewId: ViewType) => {
    setActiveView(viewId);
    setIsOverflowOpen(false);
  };

  return (
    <nav className="navigation">
      <div className="nav-main" ref={navMainRef}>
        {visibleViews.map((view) => (
          <button
            key={view.id}
            className={`nav-button ${activeView === view.id ? 'active' : ''}`}
            onClick={() => handleSelectView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
          >
            <span className={`nav-badge nav-badge-${view.tone}`} aria-hidden="true">{view.badge}</span>
            <span className="nav-label">{view.label}</span>
          </button>
        ))}

        {overflowViews.length > 0 && (
          <div className="nav-overflow" ref={overflowRef}>
            <button
              className={`nav-button nav-icon-only nav-overflow-trigger ${overflowViews.some((view) => view.id === activeView) ? 'active' : ''}`}
              type="button"
              aria-haspopup="menu"
              aria-expanded={isOverflowOpen}
              aria-label="More views"
              title="More views"
              onClick={() => setIsOverflowOpen((value) => !value)}
            >
              <span className="nav-overflow-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            {isOverflowOpen && (
              <div className="nav-overflow-menu" role="menu" aria-label="Overflow views">
                {overflowViews.map((view) => (
                  <button
                    key={view.id}
                    className={`nav-overflow-item ${activeView === view.id ? 'active' : ''}`}
                    onClick={() => handleSelectView(view.id)}
                    role="menuitem"
                    type="button"
                  >
                    <span className={`nav-badge nav-badge-${view.tone}`} aria-hidden="true">{view.badge}</span>
                    <span className="nav-label">{view.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="nav-utility">
        {UTILITY_VIEWS.map((view) => (
          <button
            key={view.id}
            className={`nav-button nav-icon-only ${activeView === view.id ? 'active' : ''}`}
            onClick={() => handleSelectView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
            title={view.tooltip || view.label}
            aria-label={view.label}
          >
            <span className={`nav-badge nav-badge-${view.tone}`} aria-hidden="true">{view.badge}</span>
          </button>
        ))}
      </div>

      <div className="nav-measure" aria-hidden="true">
        {MAIN_VIEWS.map((view) => (
          <button
            key={view.id}
            ref={(element) => {
              if (element) {
                measureRefs.current.set(view.id, element);
              } else {
                measureRefs.current.delete(view.id);
              }
            }}
            className="nav-button"
            type="button"
            tabIndex={-1}
          >
            <span className={`nav-badge nav-badge-${view.tone}`}>{view.badge}</span>
            <span className="nav-label">{view.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
