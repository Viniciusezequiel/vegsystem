import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { GraduationCap, CalendarDays, Users, ClipboardCheck, Trophy, Settings, Wallet, ArrowRight } from 'lucide-react';
import { usePsEvents, usePsCollaborators, usePsEvaluations } from '@/hooks/useProcessoSeletivo';

const shortcuts = [
  { name: 'Eventos', description: 'Processos seletivos, vínculos e avaliações.', href: '/admin-module/processo-seletivo/eventos', icon: CalendarDays },
  { name: 'Colaboradores', description: 'Banco de fiscais, ranking e inscrições.', href: '/admin-module/processo-seletivo/colaboradores', icon: Users },
  { name: 'Avaliação Geral', description: 'Rodadas de avaliação fora de evento.', href: '/admin-module/processo-seletivo/avaliacao-geral', icon: ClipboardCheck },
  { name: 'Banco de Talentos', description: 'Ranking geral por nota média.', href: '/admin-module/processo-seletivo/banco-talentos', icon: Trophy },
  { name: 'Cargos e Valores', description: 'Cargos, valores R$ e funções combinadas.', href: '/admin-module/processo-seletivo/cargos', icon: Settings },
  { name: 'Banco de Fiscais', description: 'Inscrições públicas e datas disponíveis.', href: '/admin-module/processo-seletivo/banco-fiscais', icon: Wallet },
];

export default function PsHome() {
  const { data: events = [] } = usePsEvents();
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsEvaluations();

  const running = events.filter((e: any) => e.status === 'em_andamento');

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestor de Processo Seletivo</h1>
              <p className="text-muted-foreground">Eventos, fiscais, avaliações e banco de talentos.</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/admin-module/processo-seletivo/eventos">Ver eventos</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Eventos" value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
          <StatCard title="Em andamento" value={running.length} icon={<Wallet className="h-5 w-5" />} />
          <StatCard title="Colaboradores" value={collaborators.length} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Avaliações" value={evaluations.length} icon={<ClipboardCheck className="h-5 w-5" />} />

        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((s) => (
            <Link key={s.href} to={s.href}>
              <Card className="h-full rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-base">
                    {s.name} <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
