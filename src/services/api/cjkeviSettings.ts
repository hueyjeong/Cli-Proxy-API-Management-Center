import { apiClient } from './client';

/** The management GET returns presence flags, never the saved credential values. */
export type CJKeviSettings = {
  enabled: boolean;
  'buffer-streams': boolean;
  'default-language': string;
  'max-buffer-bytes': number;
  'jev-url': string;
  'jev-model': string;
  'llm-url': string;
  'llm-model': string;
  'llm-protocol': 'chat' | 'responses' | 'messages';
  'intent-threshold': number;
  'intrusion-threshold': number;
  'has-jev-api-key': boolean;
  'has-llm-api-key': boolean;
};

export type CJKeviSettingsUpdate = Partial<
  Omit<CJKeviSettings, 'has-jev-api-key' | 'has-llm-api-key'> & {
    'jev-api-key': string;
    'llm-api-key': string;
  }
>;

export type CJKeviSettingsDraft = Omit<
  CJKeviSettings,
  | 'max-buffer-bytes'
  | 'intent-threshold'
  | 'intrusion-threshold'
  | 'has-jev-api-key'
  | 'has-llm-api-key'
> & {
  'max-buffer-bytes': string;
  'intent-threshold': string;
  'intrusion-threshold': string;
  'jev-api-key': string;
  'llm-api-key': string;
};

/** Only edited fields and nonblank replacement keys go over the wire. */
export function buildCJKeviSettingsUpdate(
  settings: CJKeviSettings,
  draft: CJKeviSettingsDraft
): CJKeviSettingsUpdate {
  const changes: CJKeviSettingsUpdate = {};
  if (draft.enabled !== settings.enabled) changes.enabled = draft.enabled;
  if (draft['buffer-streams'] !== settings['buffer-streams'])
    changes['buffer-streams'] = draft['buffer-streams'];
  if (draft['default-language'] !== settings['default-language'])
    changes['default-language'] = draft['default-language'];
  if (draft['jev-url'] !== settings['jev-url']) changes['jev-url'] = draft['jev-url'];
  if (draft['jev-model'] !== settings['jev-model']) changes['jev-model'] = draft['jev-model'];
  if (draft['llm-url'] !== settings['llm-url']) changes['llm-url'] = draft['llm-url'];
  if (draft['llm-model'] !== settings['llm-model']) changes['llm-model'] = draft['llm-model'];
  if (draft['llm-protocol'] !== settings['llm-protocol'])
    changes['llm-protocol'] = draft['llm-protocol'];
  if (Number(draft['max-buffer-bytes']) !== settings['max-buffer-bytes'])
    changes['max-buffer-bytes'] = Number(draft['max-buffer-bytes']);
  if (Number(draft['intent-threshold']) !== settings['intent-threshold'])
    changes['intent-threshold'] = Number(draft['intent-threshold']);
  if (Number(draft['intrusion-threshold']) !== settings['intrusion-threshold'])
    changes['intrusion-threshold'] = Number(draft['intrusion-threshold']);
  if (draft['jev-api-key'].trim()) changes['jev-api-key'] = draft['jev-api-key'].trim();
  if (draft['llm-api-key'].trim()) changes['llm-api-key'] = draft['llm-api-key'].trim();
  return changes;
}

export const cjkeviSettingsApi = {
  get: () => apiClient.get<CJKeviSettings>('/cjkevi/settings'),
  update: (changes: CJKeviSettingsUpdate) => apiClient.put<void>('/cjkevi/settings', changes),
};
