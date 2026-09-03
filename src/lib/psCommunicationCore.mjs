export const PS_COMMUNICATION_TYPES = Object.freeze({ confirmation_request: 'confirmation_request', event_message: 'event_message' });
export const PS_COMMUNICATION_STATUSES = Object.freeze(['pending', 'waiting_provider_quota', 'processing', 'sent', 'failed', 'failed_missing_recipient', 'cancelled']);

export const DEFAULT_EVENT_MESSAGE_SUBJECT = 'Orientações para atuação no Processo Seletivo — {{evento}}';
export const DEFAULT_EVENT_MESSAGE_TEMPLATE = `Olá, {{nome}}.

Você está escalado(a) para atuar no processo seletivo {{evento}}.

Confira abaixo as informações da sua atuação:

Cargo/Função: {{cargo}}
Data: {{data_evento}}
Horário: {{horario}}
Campus/Unidade: {{campus}} / {{unidade}}
Prédio: {{predio}}
Andar: {{andar}}
Sala: {{sala}}

Pedimos que confira atentamente as informações acima.

Caso haja alguma divergência relacionada à sua escala, entre em contato com a equipe responsável pelo processo seletivo.

Atenciosamente,
Equipe de Processo Seletivo
VEG System`;

export const DEFAULT_CONFIRMATION_SUBJECT = 'Confirmação de participação — {{evento}}';
export const DEFAULT_CONFIRMATION_TEMPLATE = `Olá, {{nome}}.

Você foi selecionado(a) para compor a equipe do processo seletivo {{evento}}.

Confira os dados da sua atuação:

Cargo/Função: {{cargo}}
Data: {{data_evento}}
Horário: {{horario}}
Campus/Unidade: {{campus}} / {{unidade}}
Prédio: {{predio}}
Andar: {{andar}}
Sala: {{sala}}

Para confirmar sua participação, utilize o botão abaixo.

{{link_confirmacao}}

A confirmação é individual e vinculada à sua escala neste evento.

Caso identifique alguma divergência nas informações acima, entre em contato com a equipe responsável antes de confirmar.

Atenciosamente,
Equipe de Processo Seletivo
VEG System`;

const VARIABLES = ['nome','evento','cargo','unidade','campus','instituicao','setor','predio','andar','sala','horario','data_evento','local_evento','descricao_evento','coordenador_evento','link_confirmacao'];
export function renderPsCommunicationTemplate(template, values = {}) {
  return VARIABLES.reduce((text, key) => text.replaceAll(`{{${key}}}`, String(values[key] ?? '')), String(template ?? ''));
}

// Mirrors the Edge Function's formatDateBR: 'YYYY-MM-DD' -> 'DD/MM/YYYY', pt-BR.
export function formatPsEventDateBR(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
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
