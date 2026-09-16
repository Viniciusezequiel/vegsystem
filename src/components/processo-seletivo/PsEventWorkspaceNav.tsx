import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Settings,
  UserRoundCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

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
  event: any;
  eventId: string;
  teamCount: number;
  candidateCount: number;
  pendingConfirmationCount: number;
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
  event,
  eventId,
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
        { value: 'fiscais', label: 'Equipe', icon: Users, count: teamCount },
        { value: 'candidatos', label: 'Candidatos', icon: UserRoundCheck, count: candidateCount },
      ],
    },
    {
      label: 'Comunicação',
      items: [
        { value: 'confirmacoes', label: 'Confirmações', icon: CheckCircle2, count: pendingConfirmationCount },
        { value: 'comunicacao', label: 'Envios', icon: Mail },
      ],
    },
    {
      label: 'Operação',
      items: [
        { value: 'presenca', label: 'Presença', icon: CalendarCheck2 },
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

      <div className="ps-event-nav__identity">
        <p className="ps-event-nav__eyebrow">Evento selecionado</p>
        <h2>{event.name}</h2>
        <div className="ps-event-nav__meta">
          <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>
            {PS_EVENT_STATUS[event.status] || event.status}
          </Badge>
          <span>
            {event.date
              ? new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')
              : 'Data não definida'}
          </span>
        </div>
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

            {group.label === 'Operação' ? (
              <>
                <Link
                  to={`/admin-module/processo-seletivo?workspace=training&event=${eventId}`}
                  className="ps-event-nav__link"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>Treinamentos</span>
                </Link>
                <Link
                  to={`/admin-module/processo-seletivo?workspace=payments&event=${eventId}`}
                  className="ps-event-nav__link"
                >
                  <WalletCards className="h-4 w-4" />
                  <span>Pagamentos</span>
                </Link>
              </>
            ) : null}
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
