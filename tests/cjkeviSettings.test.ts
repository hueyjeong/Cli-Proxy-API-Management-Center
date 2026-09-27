import { describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CJKeviCorrectionSettings } from '@/features/config/components/CJKeviCorrectionSettings';
import { apiClient } from '@/services/api/client';
import {
  buildCJKeviSettingsUpdate,
  cjkeviSettingsApi,
  type CJKeviSettings,
  type CJKeviSettingsDraft,
} from '@/services/api/cjkeviSettings';

const saved: CJKeviSettings = {
  enabled: false,
  'buffer-streams': false,
  'default-language': 'ko-KR',
  'max-buffer-bytes': 65536,
  'jev-url': 'https://openrouter.ai/api/v1/systemone',
  'jev-model': 'typesafe/jev-1.13',
  'llm-url': 'https://opencode.ai/zen/go/v1/responses',
  'llm-model': 'muse-spark-1.3-contributor',
  'llm-protocol': 'responses',
  'intent-threshold': 0.8,
  'intrusion-threshold': 0.55,
  'has-jev-api-key': true,
  'has-llm-api-key': true,
};

const draft: CJKeviSettingsDraft = {
  enabled: saved.enabled,
  'buffer-streams': saved['buffer-streams'],
  'default-language': saved['default-language'],
  'max-buffer-bytes': String(saved['max-buffer-bytes']),
  'jev-url': saved['jev-url'],
  'jev-model': saved['jev-model'],
  'jev-api-key': '',
  'llm-url': saved['llm-url'],
  'llm-model': saved['llm-model'],
  'llm-api-key': '',
  'llm-protocol': saved['llm-protocol'],
  'intent-threshold': String(saved['intent-threshold']),
  'intrusion-threshold': String(saved['intrusion-threshold']),
};

describe('CJKevi correction settings', () => {
  test('uses the authenticated management API for flags-only GET and partial PUT', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue(saved);
    const put = spyOn(apiClient, 'put').mockResolvedValue(undefined);
    try {
      expect(await cjkeviSettingsApi.get()).toEqual(saved);
      expect(get).toHaveBeenCalledWith('/cjkevi/settings');
      await cjkeviSettingsApi.update({ enabled: true, 'buffer-streams': true });
      expect(put).toHaveBeenCalledWith('/cjkevi/settings', {
        enabled: true,
        'buffer-streams': true,
      });
    } finally {
      get.mockRestore();
      put.mockRestore();
    }
  });

  test('preserves credentials: empty keys and presence flags never appear in updates', () => {
    expect(buildCJKeviSettingsUpdate(saved, draft)).toEqual({});
    expect(buildCJKeviSettingsUpdate(saved, { ...draft, 'jev-api-key': '  ' })).toEqual({});
    expect(
      buildCJKeviSettingsUpdate(saved, {
        ...draft,
        'jev-api-key': ' new-jev ',
        'llm-api-key': 'new-llm',
      })
    ).toEqual({
      'jev-api-key': 'new-jev',
      'llm-api-key': 'new-llm',
    });
  });

  test('sends only changed wire fields and preserves numeric types and falsy edits', () => {
    expect(
      buildCJKeviSettingsUpdate(
        { ...saved, enabled: true, 'buffer-streams': true },
        {
          ...draft,
          'default-language': 'ja-JP',
          'jev-url': 'https://example.com/systemone',
          'jev-model': 'other-jev',
          'llm-url': 'https://example.com/messages',
          'llm-model': 'other-llm',
          'llm-protocol': 'messages',
          'max-buffer-bytes': '1048576',
          'intent-threshold': '0.7',
          'intrusion-threshold': '0.6',
        }
      )
    ).toEqual({
      enabled: false,
      'buffer-streams': false,
      'default-language': 'ja-JP',
      'jev-url': 'https://example.com/systemone',
      'jev-model': 'other-jev',
      'llm-url': 'https://example.com/messages',
      'llm-model': 'other-llm',
      'llm-protocol': 'messages',
      'max-buffer-bytes': 1048576,
      'intent-threshold': 0.7,
      'intrusion-threshold': 0.6,
    });
  });

  test('renders controls and default Muse Responses provider without disclosing keys', () => {
    const html = renderToStaticMarkup(
      createElement(CJKeviCorrectionSettings, {
        disabled: false,
        onDirtyChange: () => {},
      })
    );
    for (const value of [
      saved['jev-url'],
      saved['jev-model'],
      saved['llm-url'],
      saved['llm-model'],
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('type="password"');
    expect(html).toContain('value="65536"');
    expect(html).toContain('value="0.8"');
    expect(html).toContain('value="0.55"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).not.toContain('new-jev');
    expect(html).not.toContain('new-llm');
  });

  test('does not swallow transport failures', async () => {
    const failure = new Error('settings unavailable');
    const get = spyOn(apiClient, 'get').mockRejectedValue(failure);
    try {
      await expect(cjkeviSettingsApi.get()).rejects.toBe(failure);
    } finally {
      get.mockRestore();
    }
    const put = spyOn(apiClient, 'put').mockRejectedValue(failure);
    try {
      await expect(cjkeviSettingsApi.update({ enabled: true })).rejects.toBe(failure);
    } finally {
      put.mockRestore();
    }
  });
});
