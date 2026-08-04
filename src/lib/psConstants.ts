export const PS_CRITERIA = [
  { key: 'punctuality', label: 'Pontualidade' },
  { key: 'domain', label: 'Domínio' },
  { key: 'room_control', label: 'Controle de Sala' },
  { key: 'attention_vigilance', label: 'Atenção e Vigilância' },
  { key: 'professional_posture', label: 'Postura Profissional' },
  { key: 'communication', label: 'Comunicação' },
  { key: 'organization', label: 'Organização' },
  { key: 'incident_management', label: 'Gestão de Ocorrências' },
  { key: 'teamwork', label: 'Trabalho em Equipe' },
] as const;

export type PsCriterionKey = (typeof PS_CRITERIA)[number]['key'];

export function psFinalScore(values: Record<string, number>): number {
  const total = PS_CRITERIA.reduce((acc, c) => acc + (Number(values[c.key]) || 0), 0);
  return Number((total / PS_CRITERIA.length).toFixed(2));
}

export function psClassification(score: number): string {
  if (score >= 4.5) return 'excelente';
  if (score >= 3.5) return 'bom';
  if (score >= 2.5) return 'regular';
  if (score >= 1.5) return 'insuficiente';
  return 'critico';
}

export const PS_CLASSIFICATION_LABEL: Record<string, string> = {
  excelente: 'Excelente',
  bom: 'Bom',
  regular: 'Regular',
  insuficiente: 'Insuficiente',
  critico: 'Crítico',
};

export const PS_EVENT_STATUS: Record<string, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
};

export const PS_PCD_OPTIONS = ['NORMAL', 'VISUAL', 'AUDITIVO', 'FÍSICO', 'MENTAL'];

export const PS_DEFAULT_ROLES = [
  { name: 'Fiscal de Sala', value: 'fiscal_sala', pay_value: 120 },
  { name: 'Fiscal Volante', value: 'fiscal_volante', pay_value: 130 },
  { name: 'Chefe de Andar', value: 'chefe_andar', pay_value: 160 },
  { name: 'Subcoordenador', value: 'subcoordenador', pay_value: 220 },
  { name: 'Coordenação', value: 'coordenacao', pay_value: 300 },
  { name: 'Apoio', value: 'apoio', pay_value: 100 },
];
