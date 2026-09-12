import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  Mail,
  MapPinned,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

export const PS_V2_BASE_PATH = '/admin-module/processo-seletivo-v2';

export const PS_V2_WORKFLOW = [
  { key: 'planejamento', label: 'Planejamento', shortLabel: 'Planejar' },
  { key: 'estrutura', label: 'Estrutura', shortLabel: 'Estrutura' },
  { key: 'equipe', label: 'Equipe', shortLabel: 'Equipe' },
  { key: 'comunicacao', label: 'Comunicação', shortLabel: 'Comunicar' },
  { key: 'execucao', label: 'Execução', shortLabel: 'Executar' },
  { key: 'avaliacao', label: 'Avaliação', shortLabel: 'Avaliar' },
  { key: 'financeiro', label: 'Financeiro', shortLabel: 'Pagar' },
] as const;

export const PS_V2_MODULES = [
  {
    key: 'estrutura',
    title: 'Locais e estrutura',
    description: 'Locais, prédios, andares, corredores, salas e necessidades por função.',
    icon: Building2,
    href: `${PS_V2_BASE_PATH}/locais`,
  },
  {
    key: 'equipe',
    title: 'Equipe e alocação',
    description: 'Banco de fiscais, elegibilidade, experiência, seleção e alocação inteligente.',
    icon: Users,
    href: `${PS_V2_BASE_PATH}/equipe`,
  },
  {
    key: 'comunicacao',
    title: 'Comunicação',
    description: 'Convites, confirmações, orientações e histórico de envios.',
    icon: Mail,
    href: null,
  },
  {
    key: 'execucao',
    title: 'Dia do evento',
    description: 'Presença, substituições, saídas, ocorrências e situação operacional.',
    icon: ClipboardCheck,
    href: null,
  },
  {
    key: 'avaliacao',
    title: 'Avaliações',
    description: 'Equipe avaliadora, escopos, avaliações e autoavaliações.',
    icon: ShieldCheck,
    href: null,
  },
  {
    key: 'financeiro',
    title: 'Pagamentos',
    description: 'Cargos, jornadas, valores, conferência financeira e exportações.',
    icon: WalletCards,
    href: null,
  },
] as const;

export const PS_V2_RESOURCES = [
  {
    title: 'Banco de fiscais',
    description: 'Cadastro único e histórico de atuações.',
    icon: GraduationCap,
    legacyHref: '/admin-module/processo-seletivo/colaboradores',
  },
  {
    title: 'Cargos e elegibilidade',
    description: 'Funções, valores e regras de compatibilidade.',
    icon: BadgeCheck,
    legacyHref: '/admin-module/processo-seletivo/cargos',
  },
  {
    title: 'Regras de alocação',
    description: 'Prioridades, experiência, bloqueios e desempates.',
    icon: ListChecks,
    legacyHref: null,
  },
  {
    title: 'Configurações',
    description: 'Parâmetros gerais do Processo Seletivo 2.',
    icon: Settings2,
    legacyHref: null,
  },
] as const;

export const PS_V2_STRUCTURE_LEVELS = [
  { key: 'location', label: 'Local', example: 'Campus I', icon: MapPinned },
  { key: 'building', label: 'Prédio', example: 'Prédio principal', icon: Building2 },
  { key: 'floor', label: 'Andar', example: '1º andar', icon: Building2 },
  { key: 'area', label: 'Área', example: 'Corredor / banheiro / entrada', icon: MapPinned },
  { key: 'room', label: 'Ambiente', example: 'Sala 101', icon: Building2 },
] as const;

export type PsV2StructureLevel = (typeof PS_V2_STRUCTURE_LEVELS)[number]['key'];
