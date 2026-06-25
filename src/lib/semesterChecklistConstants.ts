// Catálogo base do Checklist Semestral

export const SEMESTER_CATEGORIES = [
  'Porta',
  'Janela',
  'Cortina',
  'Teto',
  'Divisórias',
  'Quadro',
  'Pintura',
  'Piso',
  'Mobiliário',
  'Materiais',
  'Equipamentos',
  'Outros',
] as const;

export type SemesterCategory = typeof SEMESTER_CATEGORIES[number];

export const SEMESTER_BASE_ITEMS: Record<SemesterCategory, string[]> = {
  Porta: ['Ajuste de maçaneta', 'Pintar porta', 'Outros problemas na porta'],
  Janela: ['Ajuste/troca do vidro', 'Troca do vidro', 'Pintar janelas', 'Outros problemas na janela'],
  Cortina: ['Cortina suja', 'Cortina com furos ou rasgos', 'Não possui cortina'],
  Teto: [
    'Forro para ajustar ou trocar',
    'Forro de lâmpada para ajustar ou trocar',
    'Trocar lâmpada',
    'Outros problemas no teto',
  ],
  Divisórias: [
    'Arrumar divisórias',
    'Limpar placas das divisórias',
    'Arrumar corrente',
    'Limpar corrente',
    'Não possui',
    'Outros problemas nas divisórias',
  ],
  Quadro: ['Trocar quadro', 'Limpar quadro', 'Quadro com manchas ou arranhões', 'Outros problemas no quadro'],
  Pintura: ['Pintar porta', 'Pintar paredes', 'Pintar janelas', 'Outros serviços de pintura'],
  Piso: ['Piso quebrado', 'Outros problemas no piso'],
  Mobiliário: [
    'Trocar mesa do professor',
    'Trocar cadeira do professor',
    'Arrumar mesa do professor',
    'Carteiras/cadeiras para manutenção externa',
    'Carteiras/cadeiras para manutenção interna',
  ],
  Materiais: ['Falta lixeira', 'Trocar apagador', 'Repor/trocar pincéis', 'Outros materiais pendentes'],
  Equipamentos: [
    'Atualização do computador',
    'Salvar duplicação',
    'Limpeza do projetor',
    'Configurar projetor',
    'Trocar projetor',
    'Ajustar cabos do rack',
    'Concluir padronização do rack: filtro de linha, 2 cabos USB e adesivo',
    'Falta computador na sala do fundo',
    'Trocar ou repor peça HDMI de saída para projeção',
    'Outros problemas em equipamentos',
  ],
  Outros: [],
};

export const FURNITURE_ITEM_TYPES = ['Carteira', 'Cadeira'] as const;

export const FURNITURE_PROBLEMS = [
  'Prancheta danificada',
  'Encosto rasgado',
  'Encosto manchado',
  'Assento quebrado',
  'Assento manchado',
  'Assento rasgado',
  'Pintura dos pés',
  'Solda',
  'Outro problema',
] as const;

export const SEMESTER_ITEM_STATUS = [
  { value: 'pending_analysis', label: 'Pendente de análise', color: 'bg-slate-500' },
  { value: 'pending_ticket', label: 'Pendente de chamado', color: 'bg-yellow-500' },
  { value: 'ticket_opened', label: 'Chamado aberto', color: 'bg-blue-500' },
  { value: 'in_maintenance', label: 'Em manutenção', color: 'bg-indigo-500' },
  { value: 'waiting_parts', label: 'Aguardando peça/material', color: 'bg-orange-500' },
  { value: 'completed', label: 'Concluído', color: 'bg-emerald-500' },
  { value: 'written_off', label: 'Baixado', color: 'bg-gray-700' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-500' },
] as const;

export const COMPETENCY_STATUS = [
  { value: 'draft', label: 'Rascunho', color: 'bg-slate-500' },
  { value: 'released', label: 'Liberada', color: 'bg-emerald-500' },
  { value: 'blocked', label: 'Bloqueada', color: 'bg-orange-500' },
  { value: 'finished', label: 'Finalizada', color: 'bg-gray-700' },
] as const;

export const MAINTENANCE_TYPES = [
  { value: 'internal', label: 'Interna' },
  { value: 'external', label: 'Externa' },
] as const;

export function statusLabel(status: string) {
  return SEMESTER_ITEM_STATUS.find((s) => s.value === status)?.label ?? status;
}
export function statusColor(status: string) {
  return SEMESTER_ITEM_STATUS.find((s) => s.value === status)?.color ?? 'bg-slate-500';
}
export function competencyStatusLabel(status: string) {
  return COMPETENCY_STATUS.find((s) => s.value === status)?.label ?? status;
}
export function competencyStatusColor(status: string) {
  return COMPETENCY_STATUS.find((s) => s.value === status)?.color ?? 'bg-slate-500';
}
