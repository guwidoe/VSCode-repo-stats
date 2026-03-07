import * as crypto from 'crypto';
import { ExtensionSettings } from '../types/index.js';

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function createCoreSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify({
    excludePatterns: sorted(settings.excludePatterns),
    maxCommitsToAnalyze: settings.maxCommitsToAnalyze,
    binaryExtensions: sorted(settings.binaryExtensions),
    locExcludedExtensions: sorted(settings.locExcludedExtensions),
    includeSubmodules: settings.includeSubmodules,
  });

  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
