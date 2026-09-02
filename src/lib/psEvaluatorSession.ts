import { supabase } from '@/integrations/supabase/client';

export type EvaluatorRole = 'coordinator' | 'subcoordinator';

export type EvaluatorSession = {
  token: string;
  expiresAt: string;
  mustChangePassword: boolean;
  accountId: string;
  collaboratorId: string;
  evaluatorName: string;
  role: EvaluatorRole;
  eventId: string;
  eventName: string;
  eventDate?: string;
};

export type EvaluatorQueueItem = {
  event_collaborator_id: string;
  collaborator_id: string;
  collaborator_name: string;
  assigned_role: string | null;
  role_name: string | null;
  campus: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  unit: string | null;
  sector: string | null;
};

const storageKey = (eventId: string) => `ps-evaluator-session:${eventId}`;

export function normalizeEvaluatorUsername(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? data[0] : data;
}

export function getStoredEvaluatorToken(eventId: string) {
  return sessionStorage.getItem(storageKey(eventId));
}

export function storeEvaluatorToken(eventId: string, token: string) {
  sessionStorage.setItem(storageKey(eventId), token);
}

export function clearEvaluatorToken(eventId: string) {
  sessionStorage.removeItem(storageKey(eventId));
}

export async function evaluatorLogin(eventId: string, username: string, password: string) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_login' as never, {
    p_event_id: eventId,
    p_username: normalizeEvaluatorUsername(username),
    p_password: password,
  } as never);
  if (error) throw error;
  return firstRow(data as any);
}

export async function validateEvaluatorSession(eventId: string, token: string) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_session' as never, {
    p_event_id: eventId,
    p_session_token: token,
  } as never);
  if (error) throw error;
  return firstRow(data as any);
}

export async function changeEvaluatorPassword(
  eventId: string,
  token: string,
  currentPassword: string,
  newPassword: string,
) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_change_password' as never, {
    p_event_id: eventId,
    p_session_token: token,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  } as never);
  if (error) throw error;
  return Boolean(data);
}

export async function logoutEvaluator(eventId: string, token: string) {
  try {
    await supabase.rpc('ps_public_evaluator_logout' as never, {
      p_event_id: eventId,
      p_session_token: token,
    } as never);
  } finally {
    clearEvaluatorToken(eventId);
  }
}

export async function getEvaluatorQueue(eventId: string, token: string, search = '') {
  const { data, error } = await supabase.rpc('ps_public_evaluator_queue' as never, {
    p_event_id: eventId, p_session_token: token, p_search: search || null,
  } as never);
  if (error) throw error;
  return (data || []) as unknown as EvaluatorQueueItem[];
}

export async function getEvaluatorDashboard(eventId: string, token: string) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_dashboard' as never, {
    p_event_id: eventId, p_session_token: token,
  } as never);
  if (error) throw error;
  return firstRow(data as any) || { pending_count: 0, completed_count: 0 };
}

export async function searchExternalEvaluators(eventId: string, token: string, search: string) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_search_external' as never, {
    p_event_id: eventId, p_session_token: token, p_search: search,
  } as never);
  if (error) throw error;
  return data || [];
}

export async function addEvaluatorOverride(eventId: string, token: string, eventCollaboratorId: string, reason?: string) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_add_override' as never, {
    p_event_id: eventId, p_session_token: token, p_event_collaborator_id: eventCollaboratorId, p_reason: reason || null,
  } as never);
  if (error) throw error;
  return Boolean(data);
}

export async function submitEvaluatorEvaluation(
  eventId: string,
  token: string,
  eventCollaboratorId: string,
  criteria: Record<string, number>,
  observations: string,
  roleChanged: boolean,
  reportedRole: string,
  roleChangeJustification: string,
) {
  const { data, error } = await supabase.rpc('ps_public_evaluator_submit_evaluation' as never, {
    p_event_id: eventId,
    p_session_token: token,
    p_event_collaborator_id: eventCollaboratorId,
    p_criteria: criteria,
    p_observations: observations || null,
    p_role_changed: roleChanged,
    p_reported_role: reportedRole || null,
    p_role_change_justification: roleChangeJustification || null,
  } as never);
  if (error) throw error;
  return firstRow(data as any);
}

export async function getCoordinatorEvaluations(eventId: string, token: string, search = '', status = 'all') {
  const { data, error } = await supabase.rpc('ps_public_coordinator_evaluations' as never, {
    p_event_id: eventId, p_session_token: token, p_search: search || null, p_status: status,
  } as never);
  if (error) throw error;
  return data || [];
}

export async function getCoordinatorDashboard(eventId: string, token: string) {
  const { data, error } = await supabase.rpc('ps_public_coordinator_dashboard' as never, {
    p_event_id: eventId, p_session_token: token,
  } as never);
  if (error) throw error;
  return data || [];
}

export async function requestCoordinatorRectification(
  eventId: string,
  token: string,
  evaluationId: string,
  justification: string,
  newData: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc('ps_public_coordinator_request_rectification' as never, {
    p_event_id: eventId,
    p_session_token: token,
    p_evaluation_id: evaluationId,
    p_justification: justification,
    p_new_data: newData,
  } as never);
  if (error) throw error;
  return firstRow(data as any);
}

export async function getEvaluatorSessionHistory(eventId: string, token: string, evaluationId: string) {
  const { data, error } = await supabase.rpc('ps_public_coordinator_evaluation_history' as never, {
    p_event_id: eventId, p_session_token: token, p_evaluation_id: evaluationId,
  } as never);
  if (error) throw error;
  return data || [];
}

export async function getCoordinatorEvaluationDashboard(eventId: string, token: string) {
  const { data, error } = await supabase.rpc('ps_public_coordinator_evaluation_dashboard' as never, {
    p_event_id: eventId, p_session_token: token,
  } as never);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}