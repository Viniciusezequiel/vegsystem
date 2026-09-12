type Collaborator = Record<string, any>;
type Participation = Record<string, any>;
type Requirement = Record<string, any>;
type EligibilityRule = Record<string, any>;

export type PsV2RankedCandidate = {
  collaborator: Collaborator;
  score: number;
  reasons: string[];
};

export type PsV2AllocationPlan = {
  allocations: Array<{
    id: string;
    requirement_id: string;
    slot: number;
    collaborator_id: string | null;
    collaborator_name: string | null;
    score: number;
    reasons: string[];
    blockedReasons: string[];
    allocation_source: 'automatic' | 'manual' | 'import';
    status: 'suggested' | 'accepted' | 'rejected';
    locked: boolean;
    notes?: string | null;
  }>;
  summary: {
    total_slots: number;
    filled_slots: number;
    unfilled_slots: number;
    locked_slots: number;
    eligible_collaborators: number;
    generated_at: string;
  };
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

const looselyMatches = (left: unknown, right: unknown) => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const ruleFieldValue = (collaborator: Collaborator, field: string) => {
  if (field === 'any') {
    return [
      collaborator.role,
      collaborator.position,
      collaborator.sector,
      collaborator.unit,
      collaborator.preferred_role,
    ].filter(Boolean).join(' | ');
  }
  return collaborator[field];
};

const operatorMatches = (value: unknown, operator: string, expected: unknown) => {
  if (operator === 'any') return true;
  const actual = normalize(value);
  const target = normalize(expected);
  if (!actual || !target) return false;
  if (operator === 'equals') return actual === target;
  if (operator === 'starts_with') return actual.startsWith(target);
  return actual.includes(target);
};

const collaboratorParticipationCount = (collaborator: Collaborator, history: Participation[]) =>
  Math.max(
    Number(collaborator.total_events || 0),
    Number(collaborator.imported_participation_count || 0),
    history.length,
  );

const ruleMatches = (rule: EligibilityRule, collaborator: Collaborator, history: Participation[]) => {
  const valueMatches = operatorMatches(
    ruleFieldValue(collaborator, rule.collaborator_field),
    rule.match_operator,
    rule.match_value,
  );
  if (!valueMatches) return false;

  const participationCount = collaboratorParticipationCount(collaborator, history);
  if (rule.min_participations != null && participationCount < Number(rule.min_participations)) return false;

  const rating = Number(collaborator.average_rating || 0);
  if (rule.min_rating != null && rating < Number(rule.min_rating)) return false;
  return true;
};

const seniorProfile = (collaborator: Collaborator) => {
  const profile = normalize([
    collaborator.role,
    collaborator.position,
    collaborator.preferred_role,
  ].filter(Boolean).join(' '));
  return ['coordenador', 'subcoordenador', 'gestor', 'gerente', 'diretor', 'supervisor']
    .some((term) => profile.includes(term));
};

const hasSameDayConflict = (
  history: Participation[],
  eventId?: string,
  eventDate?: string | null,
) => {
  if (!eventDate) return false;
  return history.some((participation) => {
    const otherDate = participation?.ps_events?.date;
    return otherDate === eventDate && participation.event_id !== eventId;
  });
};

function evaluateCandidate({
  requirement,
  collaborator,
  history,
  rules,
  eventId,
  eventDate,
}: {
  requirement: Requirement;
  collaborator: Collaborator;
  history: Participation[];
  rules: EligibilityRule[];
  eventId?: string;
  eventDate?: string | null;
}) {
  const blockedReasons: string[] = [];
  const reasons: string[] = [];

  if (collaborator.active === false) blockedReasons.push('Cadastro inativo');
  if (hasSameDayConflict(history, eventId, eventDate)) blockedReasons.push('Já possui vínculo em outro evento na mesma data');

  const roleName = normalize(requirement.role_name_snapshot);
  if ((roleName.includes('sanit') || roleName.includes('banheiro')) && seniorProfile(collaborator)) {
    blockedReasons.push('Perfil de coordenação/gestão incompatível com função sanitária');
  }

  const roleRules = rules.filter((rule) =>
    rule.active !== false && requirement.role_id && rule.event_role_id === requirement.role_id,
  );
  const matchingRules = roleRules.filter((rule) => ruleMatches(rule, collaborator, history));
  const matchingDeny = matchingRules.filter((rule) => rule.decision === 'deny');
  const allowRules = roleRules.filter((rule) => rule.decision === 'allow');
  const matchingAllow = matchingRules.filter((rule) => rule.decision === 'allow');
  const matchingPrefer = matchingRules.filter((rule) => rule.decision === 'prefer');

  if (matchingDeny.length) blockedReasons.push('Bloqueado pela matriz de elegibilidade');
  if (allowRules.length && !matchingAllow.length) blockedReasons.push('Fora da matriz permitida para esta função');

  if (blockedReasons.length) return { eligible: false, score: 0, reasons, blockedReasons };

  let score = 20;
  const profileValues = [collaborator.role, collaborator.position].filter(Boolean);
  if (profileValues.some((value) => looselyMatches(value, requirement.role_name_snapshot))) {
    score += 24;
    reasons.push('Perfil compatível com a função');
  }
  if (looselyMatches(collaborator.preferred_role, requirement.role_name_snapshot)) {
    score += 22;
    reasons.push('Função preferida');
  }

  const relevantHistory = history.filter((participation) =>
    looselyMatches(participation.assigned_role || participation.role_name, requirement.role_name_snapshot),
  );
  if (relevantHistory.length) {
    const relevantScore = Math.min(relevantHistory.length * 11, 44);
    score += relevantScore;
    reasons.push(`${relevantHistory.length} atuação(ões) anterior(es) na função ou equivalente`);
  }

  const totalParticipations = collaboratorParticipationCount(collaborator, history);
  if (totalParticipations > 0) {
    score += Math.min(totalParticipations * 1.25, 18);
    reasons.push(`${totalParticipations} participação(ões) registradas`);
  }

  const rating = Number(collaborator.average_rating || 0);
  if (rating > 0) {
    score += Math.min(rating * 4, 20);
    reasons.push(`Avaliação média ${rating.toFixed(1)}`);
  }

  const preferenceWeight = matchingPrefer.reduce((sum, rule) => sum + Number(rule.weight || 10), 0);
  const allowWeight = matchingAllow.reduce((sum, rule) => sum + Math.max(Number(rule.weight || 0), 0), 0);
  if (preferenceWeight || allowWeight) {
    score += preferenceWeight + allowWeight;
    reasons.push('Prioridade definida na elegibilidade');
  }

  const recentHistory = history.filter((participation) => {
    const date = participation?.ps_events?.date;
    if (!date) return false;
    const parsed = new Date(`${date}T00:00:00`).getTime();
    return Number.isFinite(parsed) && Date.now() - parsed < 1000 * 60 * 60 * 24 * 180;
  }).length;
  if (recentHistory > 0) score -= Math.min(recentHistory * 1.5, 9);

  return {
    eligible: true,
    score: Math.max(0, Math.round(score * 10) / 10),
    reasons: reasons.slice(0, 4),
    blockedReasons,
  };
}

export function rankPsV2CandidatesForRequirement({
  requirement,
  collaborators,
  participations,
  eligibilityRules,
  eventId,
  eventDate,
  excludedCollaboratorIds = [],
}: {
  requirement: Requirement;
  collaborators: Collaborator[];
  participations: Participation[];
  eligibilityRules: EligibilityRule[];
  eventId?: string;
  eventDate?: string | null;
  excludedCollaboratorIds?: string[];
}): PsV2RankedCandidate[] {
  const excluded = new Set(excludedCollaboratorIds.filter(Boolean));
  const historyByCollaborator = new Map<string, Participation[]>();
  for (const participation of participations || []) {
    if (!participation?.collaborator_id) continue;
    const current = historyByCollaborator.get(participation.collaborator_id) || [];
    current.push(participation);
    historyByCollaborator.set(participation.collaborator_id, current);
  }

  return (collaborators || [])
    .filter((collaborator) => collaborator?.id && !excluded.has(collaborator.id))
    .map((collaborator) => {
      const result = evaluateCandidate({
        requirement,
        collaborator,
        history: historyByCollaborator.get(collaborator.id) || [],
        rules: eligibilityRules || [],
        eventId,
        eventDate,
      });
      return { collaborator, ...result };
    })
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.collaborator.full_name || '').localeCompare(String(b.collaborator.full_name || ''), 'pt-BR');
    })
    .map(({ collaborator, score, reasons }) => ({ collaborator, score, reasons }));
}

export function buildPsV2AllocationPlan({
  requirements,
  collaborators,
  participations,
  eligibilityRules,
  eventId,
  eventDate,
  excludedCollaboratorIds = [],
  lockedItems = [],
}: {
  requirements: Requirement[];
  collaborators: Collaborator[];
  participations: Participation[];
  eligibilityRules: EligibilityRule[];
  eventId?: string;
  eventDate?: string | null;
  excludedCollaboratorIds?: string[];
  lockedItems?: Record<string, any>[];
}): PsV2AllocationPlan {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const collaboratorById = new Map(collaborators.map((collaborator) => [collaborator.id, collaborator]));
  const used = new Set(excludedCollaboratorIds.filter(Boolean));
  const lockedBySlot = new Map<string, Record<string, any>>();

  for (const item of lockedItems || []) {
    if (!item?.requirement_id || !item?.collaborator_id) continue;
    const slot = Number(item?.score_breakdown?.slot || 1);
    const key = `${item.requirement_id}:${slot}`;
    if (!requirementById.has(item.requirement_id) || used.has(item.collaborator_id)) continue;
    lockedBySlot.set(key, item);
    used.add(item.collaborator_id);
  }

  const slots: Array<{ requirement: Requirement; slot: number; order: number; candidates: PsV2RankedCandidate[] }> = [];
  requirements.forEach((requirement, requirementIndex) => {
    const quantity = Math.max(1, Number(requirement.quantity || 1));
    for (let slot = 1; slot <= quantity; slot += 1) {
      const key = `${requirement.id}:${slot}`;
      if (lockedBySlot.has(key)) continue;
      const candidates = rankPsV2CandidatesForRequirement({
        requirement,
        collaborators,
        participations,
        eligibilityRules,
        eventId,
        eventDate,
        excludedCollaboratorIds: Array.from(used),
      });
      slots.push({ requirement, slot, order: requirementIndex, candidates });
    }
  });

  slots.sort((a, b) => {
    if (a.candidates.length !== b.candidates.length) return a.candidates.length - b.candidates.length;
    if (!!a.requirement.required !== !!b.requirement.required) return a.requirement.required ? -1 : 1;
    const priorityDiff = Number(a.requirement.priority || 100) - Number(b.requirement.priority || 100);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.order !== b.order) return a.order - b.order;
    return a.slot - b.slot;
  });

  const allocations: PsV2AllocationPlan['allocations'] = [];

  for (const [key, item] of lockedBySlot.entries()) {
    const [requirementId, slotText] = key.split(':');
    const collaborator = collaboratorById.get(item.collaborator_id);
    allocations.push({
      id: `locked:${key}`,
      requirement_id: requirementId,
      slot: Number(slotText || 1),
      collaborator_id: item.collaborator_id,
      collaborator_name: collaborator?.full_name || item?.score_breakdown?.collaborator_name || null,
      score: Number(item.score || 0),
      reasons: item?.score_breakdown?.reasons || ['Alocação fixada manualmente'],
      blockedReasons: [],
      allocation_source: item.allocation_source || 'manual',
      status: item.status === 'accepted' ? 'accepted' : 'suggested',
      locked: true,
      notes: item.notes || null,
    });
  }

  for (const current of slots) {
    const candidate = current.candidates.find((entry) => !used.has(entry.collaborator.id));
    if (candidate) used.add(candidate.collaborator.id);
    allocations.push({
      id: `${current.requirement.id}:${current.slot}`,
      requirement_id: current.requirement.id,
      slot: current.slot,
      collaborator_id: candidate?.collaborator.id || null,
      collaborator_name: candidate?.collaborator.full_name || null,
      score: candidate?.score || 0,
      reasons: candidate?.reasons || ['Nenhum candidato elegível disponível para esta vaga'],
      blockedReasons: candidate ? [] : ['Vaga sem candidato elegível disponível'],
      allocation_source: 'automatic',
      status: candidate ? 'suggested' : 'rejected',
      locked: false,
    });
  }

  const orderByRequirement = new Map(requirements.map((requirement, index) => [requirement.id, index]));
  allocations.sort((a, b) => {
    const orderDiff = Number(orderByRequirement.get(a.requirement_id) || 0) - Number(orderByRequirement.get(b.requirement_id) || 0);
    return orderDiff || a.slot - b.slot;
  });

  const filled = allocations.filter((item) => !!item.collaborator_id).length;
  return {
    allocations,
    summary: {
      total_slots: allocations.length,
      filled_slots: filled,
      unfilled_slots: allocations.length - filled,
      locked_slots: allocations.filter((item) => item.locked).length,
      eligible_collaborators: Math.max(0, collaborators.filter((collaborator) => collaborator.active !== false).length - excludedCollaboratorIds.length),
      generated_at: new Date().toISOString(),
    },
  };
}
