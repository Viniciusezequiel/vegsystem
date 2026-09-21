import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserRoundCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type EventNavItem = {
  value: string;
  label: string;
  icon: ElementType;
  count?: number;
};

type EventNavGroup = {
  label: string;
  items: EventNavItem[];
};

interface PsEventWorkspaceNavProps {
  teamCount: number;
  candidateCount: number;
  selfEvaluationCount: number;
}

function CountBadge({ value }: { value?: number }) {
  if (!value) return null;

  return (
    <span className="ps-event-nav__count" aria-label={`${value} itens`}>
      {value > 999 ? '999+' : value}
    </span>
  );
}

export function PsEventWorkspaceNav({
  teamCount,
  candidateCount,
  pendingConfirmationCount,
  selfEvaluationCount,
}: PsEventWorkspaceNavProps) {
  const groups: EventNavGroup[] = [
    {
      label: 'Geral',
      items: [{ value: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard }],
    },
    {
      label: 'Pessoas',
      items: [
        { value: 'fiscais', label: 'Equipe e Comunicação', icon: Users, count: teamCount },
        { value: 'candidatos', label: 'Candidatos', icon: UserRoundCheck, count: candidateCount },
      ],
    },
    {
      label: 'Operação',
      items: [
        { value: 'presenca', label: 'Presença', icon: CalendarCheck2 },
        { value: 'treinamentos', label: 'Treinamentos', icon: GraduationCap },
        { value: 'pagamentos', label: 'Pagamentos', icon: WalletCards },
      ],
    },
    {
      label: 'Avaliação',
      items: [
        { value: 'avaliacoes', label: 'Avaliações', icon: BarChart3 },
        { value: 'auto', label: 'Autoavaliações', icon: ClipboardCheck, count: selfEvaluationCount },
      ],
    },
  ];

  return (
    <aside className="ps-event-nav" aria-label="Navegação do evento">
      <Link to="/admin-module/processo-seletivo/eventos" className="ps-event-nav__back">
        <ArrowLeft className="h-4 w-4" />
        Todos os eventos
      </Link>

      <div className="ps-event-nav__heading">
        <p>Áreas do evento</p>
        <span>Escolha uma seção para gerenciar</span>
      </div>

      <TabsList className="ps-event-nav__list">
        {groups.map((group) => (
          <div key={group.label} className="ps-event-nav__group">
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.value} value={item.value} className="ps-event-nav__item">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <CountBadge value={item.count} />
                </TabsTrigger>
              );
            })}

          </div>
        ))}

        <div className={cn('ps-event-nav__group', 'ps-event-nav__group--settings')}>
          <TabsTrigger value="configuracoes" className="ps-event-nav__item">
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </TabsTrigger>
        </div>
      </TabsList>
    </aside>
  );
}
