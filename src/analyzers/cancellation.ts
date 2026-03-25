export class AnalysisCancelledError extends Error {
  constructor(message = 'Analysis was cancelled.') {
    super(message);
    this.name = 'AnalysisCancelledError';
  }
}

export function throwIfCancelled(signal?: AbortSignal, message?: string): void {
  if (signal?.aborted) {
    const reason = typeof signal.reason === 'string' && signal.reason.length > 0
      ? signal.reason
      : message;
    throw new AnalysisCancelledError(reason ?? 'Analysis was cancelled.');
  }
}

export function isAnalysisCancelledError(error: unknown): error is AnalysisCancelledError {
  return error instanceof AnalysisCancelledError;
}
