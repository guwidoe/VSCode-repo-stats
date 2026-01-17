/**
 * Granularity Toggle - Toggle between weekly and monthly view.
 *
 * Uses local state for immediate visual feedback, syncing to the store
 * asynchronously to prevent blocking during expensive re-renders.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import type { FrequencyGranularity } from '../../types';
import './GranularityToggle.css';

export function GranularityToggle() {
  const setContributorGranularity = useStore((state) => state.setContributorGranularity);
  const storeGranularity = useStore((state) => state.contributorGranularity);

  // Local state for immediate visual feedback
  const [localGranularity, setLocalGranularity] = useState<FrequencyGranularity>(storeGranularity);

  // Sync local state if store changes from elsewhere
  useEffect(() => {
    setLocalGranularity(storeGranularity);
  }, [storeGranularity]);

  const handleToggle = useCallback((granularity: FrequencyGranularity) => {
    // Immediately update local state for instant visual feedback
    setLocalGranularity(granularity);

    // Update store asynchronously
    requestAnimationFrame(() => {
      setContributorGranularity(granularity);
    });
  }, [setContributorGranularity]);

  return (
    <div className="granularity-toggle">
      <button
        className={`toggle-btn ${localGranularity === 'weekly' ? 'active' : ''}`}
        onClick={() => handleToggle('weekly')}
      >
        Weekly
      </button>
      <button
        className={`toggle-btn ${localGranularity === 'monthly' ? 'active' : ''}`}
        onClick={() => handleToggle('monthly')}
      >
        Monthly
      </button>
    </div>
  );
}
