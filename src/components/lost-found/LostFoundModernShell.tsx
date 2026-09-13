import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  CheckCircle2,
  Clock3,
  History,
  Package,
  PackagePlus,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useLostItemsCounts } from '@/hooks/useLostItemsCounts';
import { getActionLabel, useActivityLogs } from '@/hooks/useActivityLogs';
import './lost-found-modern.css';

interface LostFoundModernShellProps {
  children: ReactNode;
}

const STATUS_COLORS = ['#22c55e', '#8b5cf6', '#fb7185'];

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function StatCard({
  title,
  value,
  helper,
  icon,
  tone,
}: {
  title: string;
  value: number;
  helper: string;
  icon: ReactNode;
  tone: 'violet' | 'green' | 'blue' | 'rose';
}) {
  return (
    <div className={`lost-found-stat lost-found-stat--${tone}`}>
      <div className="lost-found-stat__icon">{icon}</div>
      <div className="min-w-0">
        <p className="lost-found-stat__label">{title}</p>
        <p className="lost-found-stat__value">{value}</p>
        <p className="lost-found-stat__helper">{helper}</p>
      </div>
    </div>
  );
}

function StatusOverview({
  total,
  available,
  delivered,
  expired,
}: {
  total: number;
  available: number;
  delivered: number;
  expired: number;
}) {
  const data = useMemo(
    () => [
      { name: 'Disponíveis', value: available },
      { name: 'Entregues', value: delivered },
      { name: 'Expirados', value: expired },
    ],
    [available, delivered, expired]
  );

  return (
    <section className="lost-found-side-card">
      <div className="lost-found-side-card__header">
        <div>
          <h2>Distribuição por status</h2>
          <p>Visão atual do acervo cadastrado.</p>
        </div>
      </div>

      <div className="lost-found-donut-wrap">
        <div className="lost-found-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.filter((item) => item.value > 0)}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2.5}
                cornerRadius={5}
                startAngle={90}
                endAngle={-270}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="lost-found-donut__center">
            <strong>{total}</strong>
            <span>itens</span>
          </div>
        </div>

        <div className="lost-found-status-list">
          {data.map((item, index) => (
            <div key={item.name} className="lost-found-status-row">
              <span
                className="lost-found-status-dot"
                style={{ backgroundColor: STATUS_COLORS[index] }}
              />
              <span className="lost-found-status-name">{item.name}</span>
              <strong>{item.value}</strong>
              <span>{percent(item.value, total)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LostFoundModernShell({ children }: LostFoundModernShellProps) {
  const navigate = useNavigate();
  const { data: counts } = useLostItemsCounts();
  const { data: activity = [], isLoading: activityLoading } = useActivityLogs({
    module: 'lost-items',
    limit: 5,
  });

  const total = counts?.total ?? 0;
  const available = counts?.available ?? 0;
  const delivered = counts?.delivered ?? 0;
  const expired = counts?.expired ?? 0;

  return (
    <div className="lost-found-modern-shell">
      <header className="lost-found-modern-header">
        <div className="lost-found-modern-header__identity">
          <div className="lost-found-modern-header__icon">
            <Search className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="lost-found-modern-header__eyebrow">Módulo operacional</p>
            <h1>Achados e Perdidos</h1>
            <p>Registro e acompanhamento de itens encontrados no campus.</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => navigate('/lost-found/register')}
          className="lost-found-register-button"
        >
          <PackagePlus className="h-4 w-4" />
          Registrar Item
        </Button>
      </header>

      <section className="lost-found-stats-grid" aria-label="Resumo de achados e perdidos">
        <StatCard
          title="Total de itens"
          value={total}
          helper="itens cadastrados"
          icon={<Package className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          title="Disponíveis"
          value={available}
          helper={`${percent(available, total)}% do total`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          title="Entregues"
          value={delivered}
          helper={`${percent(delivered, total)}% do total`}
          icon={<Archive className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          title="Expirados"
          value={expired}
          helper={`${percent(expired, total)}% do total`}
          icon={<Clock3 className="h-5 w-5" />}
          tone="rose"
        />
      </section>

      <div className="lost-found-modern-grid">
        <main className="lost-found-modern-content">{children}</main>

        <aside className="lost-found-modern-aside" aria-label="Resumo do módulo">
          <StatusOverview
            total={total}
            available={available}
            delivered={delivered}
            expired={expired}
          />

          <section className="lost-found-side-card lost-found-summary-card">
            <div className="lost-found-side-card__header">
              <div>
                <h2>Resumo do acervo</h2>
                <p>Indicadores sem repetir a listagem principal.</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>

            <div className="lost-found-summary-list">
              <div>
                <span className="lost-found-summary-bullet lost-found-summary-bullet--green" />
                <p>
                  <strong>{percent(available, total)}%</strong>
                  <span>aguardando retirada</span>
                </p>
              </div>
              <div>
                <span className="lost-found-summary-bullet lost-found-summary-bullet--violet" />
                <p>
                  <strong>{percent(delivered, total)}%</strong>
                  <span>já devolvidos</span>
                </p>
              </div>
              <div>
                <span className="lost-found-summary-bullet lost-found-summary-bullet--rose" />
                <p>
                  <strong>{expired}</strong>
                  <span>itens expirados</span>
                </p>
              </div>
            </div>
          </section>

          <section className="lost-found-side-card lost-found-activity-card">
            <div className="lost-found-side-card__header">
              <div>
                <h2>Atividade recente</h2>
                <p>Últimas movimentações do módulo.</p>
              </div>
              <button type="button" onClick={() => navigate('/activity-history')}>
                Ver todas
              </button>
            </div>

            <div className="lost-found-activity-list">
              {activityLoading ? (
                <p className="lost-found-empty">Carregando atividades…</p>
              ) : activity.length > 0 ? (
                activity.map((item) => (
                  <div key={item.id} className="lost-found-activity-row">
                    <span className="lost-found-activity-icon">
                      <History className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p>
                        {getActionLabel(item.action)}
                        {item.entity_description ? ` · ${item.entity_description}` : ''}
                      </p>
                      <span>
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="lost-found-empty">Nenhuma movimentação recente.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
