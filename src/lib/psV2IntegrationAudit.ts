export type PsV2AuditFinding = {
  code: string;
  title: string;
  detail: string;
  severity: 'blocker' | 'warning' | 'ok';
};

export type PsV2IntegrationAudit = {
  blockers: PsV2AuditFinding[];
  warnings: PsV2AuditFinding[];
  checks: PsV2AuditFinding[];
  preview: {
    officialPreserved: number;
    accepted: number;
    alreadyOfficial: number;
    wouldInsert: number;
    pendingReview: number;
    rejected: number;
    totalSlots: number;
    reviewedItems: number;
    totalItems: number;
  };
  canTechnicallyIntegrate: boolean;
};

type AuditInput = {
  event?: any;
  candidates?: any[];
  team?: any[];
  metrics?: Record<string, any> | null;
  requirements?: any[];
  run?: any | null;
  items?: any[];
  staffingSchemaReady?: boolean;
  reviewSchemaReady?: boolean;
  trainingGroups?: any[];
  trainingSessions?: any[];
};

const asId = (value: unknown) => String(value ?? '').trim();
const hasText = (value: unknown) => String(value ?? '').trim().length > 0;

const duplicates = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
};

export function buildPsV2IntegrationAudit(input: AuditInput): PsV2IntegrationAudit {
  const event = input.event || {};
  const candidates = input.candidates || [];
  const team = input.team || [];
  const metrics = input.metrics || {};
  const requirements = input.requirements || [];
  const items = input.items || [];
  const run = input.run || null;
  const staffingSchemaReady = input.staffingSchemaReady !== false;
  const reviewSchemaReady = input.reviewSchemaReady !== false;
  const trainingGroups = input.trainingGroups || [];
  const trainingSessions = input.trainingSessions || [];

  const blockers: PsV2AuditFinding[] = [];
  const warnings: PsV2AuditFinding[] = [];
  const checks: PsV2AuditFinding[] = [];

  const push = (finding: PsV2AuditFinding) => {
    if (finding.severity === 'blocker') blockers.push(finding);
    else if (finding.severity === 'warning') warnings.push(finding);
    else checks.push(finding);
  };

  if (!staffingSchemaReady || !reviewSchemaReady) {
    push({ code: 'schema', severity: 'blocker', title: 'Estrutura V2 ainda não está ativa', detail: 'As tabelas isoladas do V2 precisam existir antes de qualquer futura integração.' });
  } else {
    push({ code: 'schema', severity: 'ok', title: 'Estrutura V2 disponível', detail: 'As consultas de planejamento e revisão responderam corretamente.' });
  }

  if (!hasText(event?.name) || !hasText(event?.date)) {
    push({ code: 'event-basics', severity: 'warning', title: 'Cadastro básico do evento incompleto', detail: 'Nome e data devem estar definidos antes da transição operacional.' });
  } else {
    push({ code: 'event-basics', severity: 'ok', title: 'Evento identificado', detail: `${event.name} possui data definida.` });
  }

  if (!hasText(event?.location)) {
    push({ code: 'event-location', severity: 'warning', title: 'Local oficial não informado', detail: 'O evento ainda não possui local preenchido no cadastro oficial.' });
  }

  const totalSlots = requirements.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity || 0)), 0);
  if (!requirements.length || totalSlots === 0) {
    push({ code: 'requirements', severity: 'blocker', title: 'Necessidades de equipe não definidas', detail: 'Cadastre as necessidades por local, andar, área ou ambiente antes de validar a escala.' });
  } else {
    push({ code: 'requirements', severity: 'ok', title: 'Necessidades definidas', detail: `${requirements.length} regra(s) geram ${totalSlots} vaga(s) planejada(s).` });
  }

  if (!run) {
    push({ code: 'run', severity: 'blocker', title: 'Nenhuma proposta de alocação gerada', detail: 'Gere e revise uma proposta V2 antes do dry-run de integração.' });
  } else if (run.status !== 'review') {
    push({ code: 'run', severity: 'blocker', title: 'Proposta não está em revisão', detail: `O estado atual é “${run.status || 'indefinido'}”. A integração futura só deve considerar uma proposta em revisão.` });
  } else {
    push({ code: 'run', severity: 'ok', title: 'Proposta em revisão', detail: 'A proposta está no estágio correto para conferência pré-integração.' });
  }

  const accepted = items.filter((item) => item?.status === 'accepted');
  const rejected = items.filter((item) => item?.status === 'rejected');
  const pendingReview = items.filter((item) => item?.status === 'suggested' && item?.collaborator_id);
  const acceptedWithoutCollaborator = accepted.filter((item) => !item?.collaborator_id);
  const acceptedIds = accepted.map((item) => asId(item?.collaborator_id)).filter(Boolean);
  const duplicateAcceptedIds = duplicates(acceptedIds);
  const requirementIds = new Set(requirements.map((item) => asId(item?.id)).filter(Boolean));
  const missingRequirementItems = accepted.filter((item) => !requirementIds.has(asId(item?.requirement_id)));

  if (!accepted.length) {
    push({ code: 'accepted', severity: 'blocker', title: 'Nenhuma alocação aceita', detail: 'Aceite pelo menos uma sugestão válida antes de considerar a proposta tecnicamente pronta.' });
  } else {
    push({ code: 'accepted', severity: 'ok', title: 'Alocações aceitas', detail: `${accepted.length} item(ns) estão aceitos para a futura integração.` });
  }

  if (pendingReview.length) push({ code: 'pending-review', severity: 'blocker', title: 'Revisão ainda incompleta', detail: `${pendingReview.length} sugestão(ões) preenchida(s) ainda aguardam decisão.` });
  else if (items.length) push({ code: 'pending-review', severity: 'ok', title: 'Itens preenchidos revisados', detail: 'Não há sugestão preenchida aguardando decisão.' });

  if (acceptedWithoutCollaborator.length) push({ code: 'accepted-empty', severity: 'blocker', title: 'Alocação aceita sem colaborador', detail: `${acceptedWithoutCollaborator.length} item(ns) aceitos não possuem pessoa vinculada.` });

  if (duplicateAcceptedIds.size) push({ code: 'duplicate-accepted', severity: 'blocker', title: 'Pessoa aceita em mais de uma vaga', detail: `${duplicateAcceptedIds.size} colaborador(es) aparecem repetidos entre as alocações aceitas.` });
  else if (accepted.length) push({ code: 'duplicate-accepted', severity: 'ok', title: 'Sem duplicidade na proposta aceita', detail: 'Cada colaborador aceito ocupa apenas uma vaga na proposta.' });

  if (missingRequirementItems.length) push({ code: 'requirement-link', severity: 'blocker', title: 'Vínculo de necessidade inconsistente', detail: `${missingRequirementItems.length} item(ns) aceitos apontam para uma necessidade que não está mais ativa neste evento.` });

  const officialIds = team.map((member) => asId(member?.collaborator_id)).filter(Boolean);
  const duplicateOfficialIds = duplicates(officialIds);
  const officialSet = new Set(officialIds);
  const acceptedAlreadyOfficial = accepted.filter((item) => officialSet.has(asId(item?.collaborator_id)));
  const acceptedNew = accepted.filter((item) => item?.collaborator_id && !officialSet.has(asId(item?.collaborator_id)));

  if (duplicateOfficialIds.size) push({ code: 'official-duplicates', severity: 'warning', title: 'Duplicidade detectada na equipe oficial', detail: `${duplicateOfficialIds.size} colaborador(es) aparecem mais de uma vez na equipe atual. O V2 não alterou esses registros.` });
  else push({ code: 'official-duplicates', severity: 'ok', title: 'Equipe oficial sem duplicidade de pessoa', detail: 'Nenhum colaborador ativo aparece repetido pelo mesmo identificador.' });

  const teamMissingRole = team.filter((member) => !hasText(member?.assigned_role) && !hasText(member?.role_name));
  if (teamMissingRole.length) push({ code: 'official-role', severity: 'warning', title: 'Equipe oficial com função não informada', detail: `${teamMissingRole.length} integrante(s) não possuem função legível na consulta atual.` });

  const attendanceConflict = team.filter((member) => (!!member?.present || !!member?.signed_at) && !!member?.absent);
  if (attendanceConflict.length) push({ code: 'attendance-conflict', severity: 'warning', title: 'Conflito de presença', detail: `${attendanceConflict.length} integrante(s) aparecem simultaneamente como presente(s) e ausente(s).` });

  const communicationFailed = Number(metrics?.communicationFailed || 0);
  if (communicationFailed) push({ code: 'communication-failed', severity: 'warning', title: 'Falhas de comunicação pendentes', detail: `${communicationFailed} comunicação(ões) possuem falha registrada no módulo oficial.` });

  const pendingConfirmation = Number(metrics?.pendingConfirmation || 0);
  if (pendingConfirmation) push({ code: 'confirmation-pending', severity: 'warning', title: 'Confirmações ainda pendentes', detail: `${pendingConfirmation} integrante(s) ativos ainda não concluíram a confirmação.` });

  const requiredGroups = trainingGroups.filter((group) => group?.required && group?.active !== false);
  if (requiredGroups.length && !trainingSessions.length) push({ code: 'training-session', severity: 'warning', title: 'Treinamento obrigatório sem sessão ativa', detail: `Existem ${requiredGroups.length} grupo(s) obrigatório(s), mas nenhuma sessão ativa foi localizada.` });

  const candidateMissingRoom = candidates.filter((candidate) => !hasText(candidate?.room));
  const candidateMissingRegistration = candidates.filter((candidate) => !hasText(candidate?.registration_number));
  if (candidateMissingRoom.length) push({ code: 'candidate-room', severity: 'warning', title: 'Candidatos sem sala', detail: `${candidateMissingRoom.length} candidato(s) não possuem sala informada. Isso pode afetar etiquetas e auditorias.` });
  if (candidateMissingRegistration.length) push({ code: 'candidate-registration', severity: 'warning', title: 'Candidatos sem inscrição', detail: `${candidateMissingRegistration.length} candidato(s) não possuem número de inscrição.` });

  const reviewedItems = items.filter((item) => ['accepted', 'rejected'].includes(String(item?.status || ''))).length;
  const canTechnicallyIntegrate = blockers.length === 0;

  return {
    blockers,
    warnings,
    checks,
    preview: {
      officialPreserved: team.length,
      accepted: accepted.length,
      alreadyOfficial: acceptedAlreadyOfficial.length,
      wouldInsert: acceptedNew.length,
      pendingReview: pendingReview.length,
      rejected: rejected.length,
      totalSlots,
      reviewedItems,
      totalItems: items.length,
    },
    canTechnicallyIntegrate,
  };
}
