export interface AnalysisStateSnapshot {
  revisionHash: string;
  settingsHash: string;
}

export class AnalysisStateRegistry {
  private readonly coreStates = new Map<string, AnalysisStateSnapshot>();
  private readonly evolutionStates = new Map<string, AnalysisStateSnapshot>();

  setCoreState(targetId: string, state: AnalysisStateSnapshot): void {
    this.coreStates.set(targetId, state);
  }

  getCoreState(targetId: string): AnalysisStateSnapshot | undefined {
    return this.coreStates.get(targetId);
  }

  setEvolutionState(targetId: string, state: AnalysisStateSnapshot): void {
    this.evolutionStates.set(targetId, state);
  }

  getEvolutionState(targetId: string): AnalysisStateSnapshot | undefined {
    return this.evolutionStates.get(targetId);
  }
}
