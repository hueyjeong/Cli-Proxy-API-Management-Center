import { apiClient } from './client';

export const CJKEVI_HISTORY_OUTCOMES = ['jev-reviewed', 'bypassed', 'corrected', 'failed'] as const;

export type CJKeviHistoryOutcome = (typeof CJKEVI_HISTORY_OUTCOMES)[number];

export interface CJKeviHistoryEvent {
  time: string;
  outcome: CJKeviHistoryOutcome;
  reason: string;
  surface: string;
  jev_called: boolean;
  llm_called: boolean;
  intentional_score?: number;
  intrusion_score?: number;
}

export interface CJKeviHistoryResponse {
  events: CJKeviHistoryEvent[];
}

export const cjkeviHistoryApi = {
  // apiClient supplies the /v0/management prefix, bearer key and unauthorized handling.
  list: (signal?: AbortSignal) =>
    apiClient.get<CJKeviHistoryResponse>('/cjkevi/history', { signal }),
};
