import { useCallback, useEffect, useId, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  buildCJKeviSettingsUpdate,
  cjkeviSettingsApi,
  type CJKeviSettings,
  type CJKeviSettingsDraft,
} from '@/services/api/cjkeviSettings';
import { useAuthStore, useNotificationStore } from '@/stores';
import { CONFIG_TAB_ICONS } from '../constants';
import { SectionCard } from './SectionCard';
import { FieldGrid, FieldGroup, FieldShell, FieldStack, ToggleRow } from './fields/FieldPrimitives';
import styles from '../ConfigPage.module.scss';

type Draft = CJKeviSettingsDraft;

const DEFAULTS: CJKeviSettings = {
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
  'has-jev-api-key': false,
  'has-llm-api-key': false,
};

const LLM_PRESETS = {
  chat: { url: 'https://opencode.ai/zen/go/v1/chat/completions', model: 'glm-5.3-flash' },
  responses: { url: DEFAULTS['llm-url'], model: DEFAULTS['llm-model'] },
  messages: { url: 'https://opencode.ai/zen/go/v1/messages', model: 'qwen3.8-flash' },
} as const;

const toDraft = (settings: CJKeviSettings): Draft => ({
  enabled: settings.enabled,
  'buffer-streams': settings['buffer-streams'],
  'default-language': settings['default-language'],
  'max-buffer-bytes': String(settings['max-buffer-bytes']),
  'jev-url': settings['jev-url'],
  'jev-model': settings['jev-model'],
  'jev-api-key': '',
  'llm-url': settings['llm-url'],
  'llm-model': settings['llm-model'],
  'llm-api-key': '',
  'llm-protocol': settings['llm-protocol'],
  'intent-threshold': String(settings['intent-threshold']),
  'intrusion-threshold': String(settings['intrusion-threshold']),
});

function numericError(draft: Draft, t: (key: string) => string): string | null {
  const size = Number(draft['max-buffer-bytes']);
  if (
    draft['max-buffer-bytes'].trim() === '' ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 1048576
  )
    return t('correction_settings.buffer_error');
  if (
    ['intent-threshold', 'intrusion-threshold'].some((key) => {
      const raw = draft[key as 'intent-threshold' | 'intrusion-threshold'];
      const value = Number(raw);
      return raw.trim() === '' || !Number.isFinite(value) || value <= 0 || value > 1;
    })
  )
    return t('correction_settings.threshold_error');
  return null;
}

type Props = { disabled: boolean; onDirtyChange: (dirty: boolean) => void };
const Icon = CONFIG_TAB_ICONS.advanced;

export function CJKeviCorrectionSettings({ disabled, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const [settings, setSettings] = useState<CJKeviSettings | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(DEFAULTS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const languageId = useId();
  const protocolId = useId();
  const dirty =
    settings !== null && Object.keys(buildCJKeviSettingsUpdate(settings, draft)).length > 0;
  const inputDisabled = disabled || loading || saving || !settings;
  const validationError = numericError(draft, t);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const latest = await cjkeviSettingsApi.get();
      setSettings(latest);
      setDraft(toDraft(latest));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('correction_settings.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    if (!disabled) {
      setLoading(true);
      setError('');
      void cjkeviSettingsApi.get().then(
        (latest) => {
          if (!active) return;
          setSettings(latest);
          setDraft(toDraft(latest));
          setLoading(false);
        },
        (err: unknown) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : t('correction_settings.load_failed'));
          setLoading(false);
        }
      );
    } else {
      setSettings(null);
      setDraft(toDraft(DEFAULTS));
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [disabled, apiBase, managementKey, t]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleProtocolChange = (value: string) => {
    const protocol = value as Draft['llm-protocol'];
    setDraft((previous) => {
      const current = LLM_PRESETS[previous['llm-protocol']];
      const next = LLM_PRESETS[protocol];
      return {
        ...previous,
        'llm-protocol': protocol,
        'llm-url': previous['llm-url'] === current.url ? next.url : previous['llm-url'],
        'llm-model': previous['llm-model'] === current.model ? next.model : previous['llm-model'],
      };
    });
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || inputDisabled || !dirty || validationError) return;
    setSaving(true);
    setError('');
    try {
      await cjkeviSettingsApi.update(buildCJKeviSettingsUpdate(settings, draft));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('correction_settings.save_failed'));
      setSaving(false);
      return;
    }
    // Never retain replacement keys after a successful PUT, even if the follow-up GET fails.
    setDraft((previous) => ({ ...previous, 'jev-api-key': '', 'llm-api-key': '' }));
    try {
      const latest = await cjkeviSettingsApi.get();
      setSettings(latest);
      setDraft(toDraft(latest));
      showNotification(t('correction_settings.save_success'), 'success');
    } catch (err: unknown) {
      setSettings(null);
      setError(err instanceof Error ? err.message : t('correction_settings.load_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={<Icon size={16} />}
      title={t('correction_settings.title')}
      description={t('correction_settings.description')}
    >
      <form className={styles.correctionForm} onSubmit={(event) => void handleSave(event)}>
        {loading ? (
          <p className={styles.correctionStatus} role="status">
            {t('common.loading')}
          </p>
        ) : null}
        {error ? (
          <div className="error-box" role="alert">
            {error}
          </div>
        ) : null}
        {!settings && !loading ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void loadSettings()}
            disabled={disabled}
          >
            {t('common.refresh')}
          </button>
        ) : null}
        <FieldStack>
          <FieldGroup
            title={t('correction_settings.general_title')}
            description={t('correction_settings.general_description')}
          >
            <FieldGrid>
              <ToggleRow
                title={t('correction_settings.enabled')}
                description={t('correction_settings.enabled_hint')}
                checked={draft.enabled}
                disabled={inputDisabled}
                onChange={(value) => setField('enabled', value)}
              />
              <ToggleRow
                title={t('correction_settings.buffer_streams')}
                description={t('correction_settings.buffer_streams_hint')}
                checked={draft['buffer-streams']}
                disabled={inputDisabled}
                onChange={(value) => setField('buffer-streams', value)}
              />
            </FieldGrid>
            <FieldGrid>
              <FieldShell label={t('correction_settings.default_language')} htmlFor={languageId}>
                <Select
                  id={languageId}
                  ariaLabel={t('correction_settings.default_language')}
                  value={draft['default-language']}
                  options={['ko-KR', 'ja-JP', 'zh-CN', 'zh-TW', 'en-US'].map((language) => ({
                    value: language,
                    label: language,
                  }))}
                  onChange={(value) => setField('default-language', value)}
                  disabled={inputDisabled}
                />
              </FieldShell>
              <Input
                label={t('correction_settings.max_buffer_bytes')}
                hint={t('correction_settings.max_buffer_hint')}
                type="number"
                min={1}
                max={1048576}
                step={1}
                value={draft['max-buffer-bytes']}
                onChange={(event) => setField('max-buffer-bytes', event.target.value)}
                disabled={inputDisabled}
              />
            </FieldGrid>
          </FieldGroup>
          <FieldGroup
            title={t('correction_settings.jev_title')}
            description={t('correction_settings.jev_description')}
          >
            <FieldGrid>
              <Input
                label={t('correction_settings.jev_url')}
                type="url"
                value={draft['jev-url']}
                onChange={(event) => setField('jev-url', event.target.value)}
                disabled={inputDisabled}
              />
              <Input
                label={t('correction_settings.jev_model')}
                value={draft['jev-model']}
                onChange={(event) => setField('jev-model', event.target.value)}
                disabled={inputDisabled}
              />
              <Input
                label={t('correction_settings.jev_api_key')}
                hint={t('correction_settings.key_hint')}
                type="password"
                autoComplete="new-password"
                placeholder={
                  settings?.['has-jev-api-key']
                    ? t('correction_settings.key_saved')
                    : t('correction_settings.key_empty')
                }
                value={draft['jev-api-key']}
                onChange={(event) => setField('jev-api-key', event.target.value)}
                disabled={inputDisabled}
              />
            </FieldGrid>
          </FieldGroup>
          <FieldGroup
            title={t('correction_settings.llm_title')}
            description={t('correction_settings.llm_description')}
          >
            <FieldGrid>
              <FieldShell label={t('correction_settings.llm_protocol')} htmlFor={protocolId}>
                <Select
                  id={protocolId}
                  ariaLabel={t('correction_settings.llm_protocol')}
                  value={draft['llm-protocol']}
                  options={['responses', 'chat', 'messages'].map((protocol) => ({
                    value: protocol,
                    label: t(`correction_settings.protocol_${protocol}`),
                  }))}
                  onChange={handleProtocolChange}
                  disabled={inputDisabled}
                />
              </FieldShell>
              <Input
                label={t('correction_settings.llm_url')}
                type="url"
                value={draft['llm-url']}
                onChange={(event) => setField('llm-url', event.target.value)}
                disabled={inputDisabled}
              />
              <Input
                label={t('correction_settings.llm_model')}
                value={draft['llm-model']}
                onChange={(event) => setField('llm-model', event.target.value)}
                disabled={inputDisabled}
              />
              <Input
                label={t('correction_settings.llm_api_key')}
                hint={t('correction_settings.key_hint')}
                type="password"
                autoComplete="new-password"
                placeholder={
                  settings?.['has-llm-api-key']
                    ? t('correction_settings.key_saved')
                    : t('correction_settings.key_empty')
                }
                value={draft['llm-api-key']}
                onChange={(event) => setField('llm-api-key', event.target.value)}
                disabled={inputDisabled}
              />
            </FieldGrid>
          </FieldGroup>
          <FieldGroup
            title={t('correction_settings.thresholds_title')}
            description={t('correction_settings.thresholds_description')}
          >
            <FieldGrid>
              <Input
                label={t('correction_settings.intent_threshold')}
                type="number"
                min={0}
                max={1}
                step="any"
                value={draft['intent-threshold']}
                onChange={(event) => setField('intent-threshold', event.target.value)}
                disabled={inputDisabled}
              />
              <Input
                label={t('correction_settings.intrusion_threshold')}
                type="number"
                min={0}
                max={1}
                step="any"
                value={draft['intrusion-threshold']}
                onChange={(event) => setField('intrusion-threshold', event.target.value)}
                disabled={inputDisabled}
              />
            </FieldGrid>
          </FieldGroup>
        </FieldStack>
        <div className={styles.correctionActions}>
          <p className={styles.correctionStatus}>{t('correction_settings.separate_save')}</p>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={inputDisabled || !dirty || Boolean(validationError)}
          >
            {saving ? t('config_management.status_saving_short') : t('common.save')}
          </button>
        </div>
        {validationError && dirty ? (
          <p className={styles.correctionError} role="alert">
            {validationError}
          </p>
        ) : null}
      </form>
    </SectionCard>
  );
}
