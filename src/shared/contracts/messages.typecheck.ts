import type { WebviewMessage } from './messages.js';

export const validScopedSettingUpdateMessage: WebviewMessage = {
  type: 'updateScopedSetting',
  key: 'evolution.maxSnapshots',
  value: 24,
  target: 'repo',
};

export const invalidScopedSettingUpdateMessage: WebviewMessage = {
  type: 'updateScopedSetting',
  key: 'evolution.maxSnapshots',
  // @ts-expect-error `evolution.maxSnapshots` requires a numeric value.
  value: '24',
  target: 'repo',
};
