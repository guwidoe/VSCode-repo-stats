import * as crypto from 'crypto';
import { ExtensionSettings } from '../types/index.js';
import { createCoreAnalysisSettingsSnapshot } from '../shared/settings.js';

export function createCoreSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify(createCoreAnalysisSettingsSnapshot(settings));
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
