import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconRefreshCw } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  CJKEVI_HISTORY_OUTCOMES,
  cjkeviHistoryApi,
  type CJKeviHistoryEvent,
  type CJKeviHistoryOutcome,
} from '@/services/api/cjkeviHistory';
import { useAuthStore } from '@/stores';
import styles from './CJKeviHistoryPage.module.scss';

type HistoryFilter = 'all' | CJKeviHistoryOutcome;

interface CJKeviHistoryContentProps {
  events: CJKeviHistoryEvent[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
}

export function CJKeviHistoryContent({
  events,
  filter,
  onFilterChange,
}: CJKeviHistoryContentProps) {
  const { t, i18n } = useTranslation();
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CJKEVI_HISTORY_OUTCOMES.map((outcome) => [
          outcome,
          events.filter((event) => event.outcome === outcome).length,
        ])
      ) as Record<CJKeviHistoryOutcome, number>,
    [events]
  );
  const visibleEvents =
    filter === 'all' ? events : events.filter((event) => event.outcome === filter);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [i18n.language]
  );
  const scoreFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 }),
    [i18n.language]
  );

  return (
    <>
      <section className={styles.summary} aria-label={t('correction_history.summary_label')}>
        {CJKEVI_HISTORY_OUTCOMES.map((outcome) => (
          <div className={styles.summaryItem} data-outcome={outcome} key={outcome}>
            <span className={styles.summaryLabel}>
              {t(`correction_history.outcomes.${outcome}`)}
            </span>
            <strong className={styles.summaryNumber}>{counts[outcome]}</strong>
          </div>
        ))}
      </section>

      <section className={styles.ledger} aria-label={t('correction_history.list_label')}>
        <div className={styles.ledgerHeader}>
          <div className={styles.ledgerHeading}>
            <h2>{t('correction_history.recent_events')}</h2>
            <span>{t('correction_history.event_count', { count: visibleEvents.length })}</span>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label={t('correction_history.filter_label')}
          >
            {(['all', ...CJKEVI_HISTORY_OUTCOMES] as HistoryFilter[]).map((outcome) => (
              <button
                type="button"
                className={styles.filter}
                aria-pressed={filter === outcome}
                data-outcome={outcome}
                key={outcome}
                onClick={() => onFilterChange(outcome)}
              >
                {outcome === 'all'
                  ? t('correction_history.all')
                  : t(`correction_history.outcomes.${outcome}`)}
                <span className={styles.filterCount} aria-hidden="true">
                  {outcome === 'all' ? events.length : counts[outcome]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <EmptyState
            title={t('correction_history.empty_title')}
            description={t('correction_history.empty_description')}
          />
        ) : (
          <ol className={styles.eventList}>
            {visibleEvents.map((event, index) => {
              const date = new Date(event.time);
              const time = Number.isNaN(date.getTime()) ? event.time : dateFormatter.format(date);
              return (
                <li
                  className={styles.event}
                  key={`${event.time}-${index}`}
                  data-outcome={event.outcome}
                >
                  <div className={styles.eventTime}>
                    <span className={styles.timelineMarker} aria-hidden="true" />
                    <time dateTime={event.time}>{time}</time>
                  </div>
                  <div className={styles.eventBody}>
                    <div className={styles.eventMain}>
                      <span className={styles.outcome}>
                        {t(`correction_history.outcomes.${event.outcome}`)}
                      </span>
                      <span className={styles.surface}>{event.surface}</span>
                      <code className={styles.reason}>
                        {event.reason || t('correction_history.not_available')}
                      </code>
                    </div>
                    <div className={styles.eventDetails}>
                      <span>
                        {t('correction_history.jev_called')}:{' '}
                        <strong>{t(event.jev_called ? 'common.yes' : 'common.no')}</strong>
                      </span>
                      <span>
                        {t('correction_history.llm_called')}:{' '}
                        <strong>{t(event.llm_called ? 'common.yes' : 'common.no')}</strong>
                      </span>
                      {event.intentional_score !== undefined && (
                        <span>
                          {t('correction_history.intentional_score')}:{' '}
                          <strong>{scoreFormatter.format(event.intentional_score)}</strong>
                        </span>
                      )}
                      {event.intrusion_score !== undefined && (
                        <span>
                          {t('correction_history.intrusion_score')}:{' '}
                          <strong>{scoreFormatter.format(event.intrusion_score)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

export function CJKeviHistoryPage() {
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = isAuthenticated && connectionStatus === 'connected';

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [data, setData] = useState<CJKeviHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (
        next.apiBase === previous.apiBase &&
        next.managementKey === previous.managementKey &&
        next.isAuthenticated === previous.isAuthenticated &&
        next.connectionStatus === previous.connectionStatus
      )
        return;

      generationRef.current += 1;
      requestRef.current += 1;
      controllerRef.current?.abort();
      setData([]);
      setError('');
      setLoading(false);
    });
    return () => {
      unsubscribe();
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  const loadHistory = useCallback(async () => {
    const request = ++requestRef.current;
    controllerRef.current?.abort();
    if (!connected) {
      setData([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const generation = generationRef.current;
    const isCurrent = () => {
      const auth = useAuthStore.getState();
      return (
        requestRef.current === request &&
        generationRef.current === generation &&
        auth.isAuthenticated &&
        auth.connectionStatus === 'connected' &&
        auth.apiBase === apiBase &&
        auth.managementKey === managementKey
      );
    };
    setLoading(true);
    setError('');
    try {
      const response = await cjkeviHistoryApi.list(controller.signal);
      if (isCurrent()) setData(response.events);
    } catch {
      if (isCurrent()) setError(t('correction_history.load_failed'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [apiBase, connected, managementKey, t]);

  useHeaderRefresh(loadHistory, connected);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadHistory]);

  const events = connected ? data : [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('correction_history.eyebrow')}</p>
          <h1 className={styles.title}>{t('correction_history.title')}</h1>
          <p className={styles.description}>{t('correction_history.description')}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styles.refresh}
          disabled={!connected || loading}
          onClick={() => void loadHistory()}
        >
          <IconRefreshCw size={16} /> {t('common.refresh')}
        </Button>
      </header>

      {!connected ? (
        <EmptyState title={t('correction_history.connection_required')} />
      ) : (
        <>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {loading && (
            <div className={styles.loading} role="status">
              {t('common.loading')}
            </div>
          )}
          <CJKeviHistoryContent events={events} filter={filter} onFilterChange={setFilter} />
        </>
      )}
    </main>
  );
}
