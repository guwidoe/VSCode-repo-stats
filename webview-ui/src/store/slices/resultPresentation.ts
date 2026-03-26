import type { RunResultCompleteness } from '../../types';
import type { ResultPresentationState } from '../types';

export function resultPresentationForCompleteness(
  completeness: RunResultCompleteness
): ResultPresentationState {
  if (completeness === 'preliminary') {
    return {
      displayedResultKind: 'preliminary',
      displayedResultSource: 'activeRun',
      activeRunState: 'running',
    };
  }

  return {
    displayedResultKind: 'final',
    displayedResultSource: 'lastCompletedRun',
    activeRunState: 'idle',
  };
}
