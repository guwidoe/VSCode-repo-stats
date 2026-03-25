export type AnalysisRunScope = 'core' | 'evolution';
export type AnalysisRunCancelReason = 'superseded' | 'user';

export interface AnalysisRunToken {
  scope: AnalysisRunScope;
  id: number;
  signal: AbortSignal;
}

interface ActiveRunRecord {
  id: number;
  controller: AbortController;
}

export class AnalysisRunLifecycle {
  private readonly activeRuns = new Map<AnalysisRunScope, ActiveRunRecord>();

  private nextId = 1;

  start(scope: AnalysisRunScope): AnalysisRunToken {
    this.cancel(scope, 'superseded');

    const record: ActiveRunRecord = {
      id: this.nextId,
      controller: new AbortController(),
    };
    this.nextId += 1;
    this.activeRuns.set(scope, record);

    return {
      scope,
      id: record.id,
      signal: record.controller.signal,
    };
  }

  cancel(scope: AnalysisRunScope, reason: AnalysisRunCancelReason): boolean {
    const active = this.activeRuns.get(scope);
    if (!active) {
      return false;
    }

    this.activeRuns.delete(scope);
    active.controller.abort(reason);
    return true;
  }

  isCurrent(token: AnalysisRunToken): boolean {
    const active = this.activeRuns.get(token.scope);
    return active?.id === token.id && !token.signal.aborted;
  }

  finish(token: AnalysisRunToken): void {
    if (this.isCurrent(token)) {
      this.activeRuns.delete(token.scope);
    }
  }
}
