export const PS_COMMUNICATION_TYPES = Object.freeze({ confirmation_request: 'confirmation_request', event_message: 'event_message' });
export const PS_COMMUNICATION_STATUSES = Object.freeze(['pending', 'waiting_provider_quota', 'processing', 'sent', 'failed', 'failed_missing_recipient', 'cancelled']);

export const DEFAULT_CONFIRMATION_TEMPLATE = `Olá, {{nome}}.

Você foi selecionado(a) para atuar no processo seletivo {{evento}}.

Função: {{cargo}}
Unidade: {{unidade}}
Andar/Sala: {{andar}} / {{sala}}
Horário: {{horario}}

Por favor, confirme sua participação pelo link abaixo:

{{link_confirmacao}}`;

const VARIABLES = ['nome','evento','cargo','unidade','predio','andar','sala','horario','link_confirmacao'];
export function renderPsCommunicationTemplate(template, values = {}) {
  return VARIABLES.reduce((text, key) => text.replaceAll(`{{${key}}}`, String(values[key] ?? '')), String(template ?? ''));
}

export function filterPsCommunicationRecipients(rows, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  return rows.filter(row => (filters.status === 'all' || !filters.status || row.participation_status === filters.status)
    && (filters.role === 'all' || !filters.role || (row.role_name || row.assigned_role || 'Sem função') === filters.role)
    && (filters.unit === 'all' || !filters.unit || (row.unit || 'Sem unidade') === filters.unit)
    && (filters.room === 'all' || !filters.room || (row.room || 'Sem sala') === filters.room)
    && (!search || String(row.collaborator_name || '').toLowerCase().includes(search)));
}

export function resolvePsEmailRecipient({ logicalRecipient, testMode, testRecipient }) {
  if (!logicalRecipient) return { status: 'failed_missing_recipient', logicalRecipient: null, actualRecipient: null };
  if (testMode && !testRecipient) throw new Error('test_recipient_required');
  return { status: 'pending', logicalRecipient, actualRecipient: testMode ? testRecipient : logicalRecipient };
}

export function testModeSubject(subject, testMode) {
  return testMode && !String(subject).startsWith('[TESTE VEG SYSTEM]') ? `[TESTE VEG SYSTEM] ${subject}` : subject;
}

export function canRetryPsCommunication(job, participant) {
  if (!['failed','failed_missing_recipient'].includes(job?.status)) return false;
  if (job.communication_type === 'confirmation_request' && participant?.participation_status === 'confirmed') return false;
  return true;
}

export function planPsDailyQuota(jobs, dailySent, dailyLimit) {
  const available = Math.max(0, Number(dailyLimit) - Number(dailySent));
  return { eligible: jobs.slice(0, available), waiting: jobs.slice(available), available };
}

export function isPsQuotaDayEligible(jobQuotaDate, today) {
  return !jobQuotaDate || String(jobQuotaDate) < String(today);
}
