import { describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { CJKeviHistoryContent } from '@/features/cjkevi/CJKeviHistoryPage';
import {
  CJKEVI_HISTORY_OUTCOMES,
  cjkeviHistoryApi,
  type CJKeviHistoryEvent,
} from '@/services/api/cjkeviHistory';
import { apiClient } from '@/services/api/client';

const events: CJKeviHistoryEvent[] = CJKEVI_HISTORY_OUTCOMES.map((outcome, index) => ({
  time: `2026-09-27T12:0${index}:00Z`,
  outcome,
  reason: `reason_${index}`,
  surface: 'chat',
  jev_called: index !== 1,
  llm_called: index === 2,
  ...(index === 2 ? { intentional_score: 0, intrusion_score: 0.83 } : {}),
}));

const render = (filter: 'all' | (typeof CJKEVI_HISTORY_OUTCOMES)[number]) =>
  renderToStaticMarkup(
    createElement(CJKeviHistoryContent, { events, filter, onFilterChange: () => {} })
  );

describe('CJKevi correction history', () => {
  test('requests the Management API through the authenticated client and forwards cancellation', async () => {
    const response = { events };
    const get = spyOn(apiClient, 'get').mockResolvedValue(response);
    const controller = new AbortController();
    try {
      expect(await cjkeviHistoryApi.list(controller.signal)).toBe(response);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith('/cjkevi/history', { signal: controller.signal });
    } finally {
      get.mockRestore();
    }
  });

  test('shows all four outcomes and their counts, including optional zero scores', () => {
    const markup = render('all');
    for (const outcome of CJKEVI_HISTORY_OUTCOMES) {
      expect(markup).toContain(`data-outcome="${outcome}"`);
      expect(markup).toContain(i18n.t(`correction_history.outcomes.${outcome}`));
    }
    expect((markup.match(/<time /g) ?? []).length).toBe(4);
    expect(markup).toContain('reason_0');
    expect(markup).toContain('reason_3');
    expect(markup).toContain(i18n.t('correction_history.intentional_score'));
    expect(markup).toContain('0%');
    expect(markup).toContain('83%');
  });

  test('filters events without losing the full outcome counts and escapes event fields', () => {
    const markup = render('corrected');
    expect((markup.match(/<time /g) ?? []).length).toBe(1);
    expect(markup).toContain('reason_2');
    expect(markup).not.toContain('reason_0');
    expect(markup).not.toContain('reason_3');
    expect(markup).toContain('aria-pressed="true"');

    const untrusted = renderToStaticMarkup(
      createElement(CJKeviHistoryContent, {
        events: [{ ...events[0], reason: '<script>alert(1)</script>', surface: '<img />' }],
        filter: 'all',
        onFilterChange: () => {},
      })
    );
    expect(untrusted).not.toContain('<script>');
    expect(untrusted).not.toContain('<img />');
    expect(untrusted).toContain('&lt;script&gt;');
  });

  test('keeps every outcome translation available in all four locales', () => {
    for (const language of ['en', 'zh-CN', 'zh-TW', 'ru']) {
      const translations = i18n.getResourceBundle(language, 'translation').correction_history;
      for (const outcome of CJKEVI_HISTORY_OUTCOMES) {
        expect(translations.outcomes[outcome]).toBeTruthy();
      }
      expect(translations.filter_label).toBeTruthy();
      expect(translations.load_failed).toBeTruthy();
    }
  });
});
