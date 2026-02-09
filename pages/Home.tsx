import { useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Monitor, 
  ClipboardCheck, 
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Phone
} from 'lucide-react';
import { useOverdueLoans } from '@/hooks/useEquipment';
import { useOverdueLockerLoans } from '@/hooks/useLockers';
import { useEquipmentList } from '@/hooks/useEquipment';
import { useLockersList } from '@/hooks/useLockers';
import { useRoomsList } from '@/hooks/useRooms';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Home() {
  const navigate = useNavigate();
  
  // Fetch real data
  const { data: overdueEquipment } = useOverdueLoans();
  const { data: overdueLockers } = useOverdueLockerLoans();
  const { data: equipment } = useEquipmentList();
  const { data: lockers } = useLockersList();
  const { data: rooms } = useRoomsList();

  // Calculate stats
  const equipmentStats = {
    available: equipment?.filter(e => e.status === 'available').length || 0,
    borrowed: equipment?.filter(e => e.status === 'borrowed').length || 0,
    maintenance: equipment?.filter(e => e.status === 'maintenance').length || 0,
  };

  const lockerStats = {
    available: lockers?.filter(l => l.status === 'available').length || 0,
    occupied: lockers?.filter(l => l.status === 'occupied').length || 0,
  };

  const totalOverdue = (overdueEquipment?.length || 0) + (overdueLockers?.length || 0);

  const modules = [
    {
      id: 'lost-found',
      title: 'Achados e Perdidos',
      description: 'Gestão de itens encontrados e entregas',
      icon: Package,
      href: '/lost-found',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      stats: [
        { label: 'Módulo', value: 'Ativo', icon: CheckCircle2 },
      ],
    },
    {
      id: 'equipment',
      title: 'Equipamentos',
      description: 'Controle de estoque e empréstimos',
      icon: Monitor,
      href: '/equipment',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      stats: [
        { label: 'Disponíveis', value: equipmentStats.available, icon: CheckCircle2 },
        { label: 'Emprestados', value: equipmentStats.borrowed, icon: Users },
        { label: 'Manutenção', value: equipmentStats.maintenance, icon: Clock },
      ],
    },
    {
      id: 'rooms',
      title: 'Checklist de Salas',
      description: 'Verificação e controle de ambientes',
      icon: ClipboardCheck,
      href: '/rooms',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-500/10',
      stats: [
        { label: 'Salas', value: rooms?.length || 0, icon: CheckCircle2 },
      ],
    },
    {
      id: 'lockers',
      title: 'Escaninhos',
      description: 'Gestão de armários e alocações',
      icon: Lock,
      href: '/lockers',
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      stats: [
        { label: 'Disponíveis', value: lockerStats.available, icon: CheckCircle2 },
        { label: 'Ocupados', value: lockerStats.occupied, icon: Users },
      ],
    },
  ];

  const getDaysOverdue = (date: string) => {
    return differenceInDays(new Date(), parseISO(date));
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Setor Recursos Didáticos</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema de gestão
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Criado e Desenvolvido por{' '}
            <a 
              href="https://vegsystem.com.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              VEG System
            </a>
          </p>
        </div>

        {/* Overdue Alerts */}
        {totalOverdue > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Atenção: {totalOverdue} item(ns) com devolução atrasada!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Equipment Overdue */}
              {overdueEquipment && overdueEquipment.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Equipamentos:</p>
                  <div className="space-y-2">
                    {overdueEquipment.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">{loan.equipment?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.borrower_name} - {loan.borrower_sector}
                          </p>
                          <p className="text-xs text-destructive font-medium">
                            {getDaysOverdue(loan.expected_return_date)} dias de atraso
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/55${loan.borrower_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg"
                        >
                          <Phone className="h-3 w-3" />
                          Contatar
                        </a>
                      </div>
                    ))}
                  </div>
                  {overdueEquipment.length > 5 && (
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link to="/equipment/loans">Ver todos ({overdueEquipment.length})</Link>
                    </Button>
                  )}
                </div>
              )}

              {/* Lockers Overdue */}
              {overdueLockers && overdueLockers.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Escaninhos:</p>
                  <div className="space-y-2">
                    {overdueLockers.slice(0, 5).map((loan) => (
                      <div key={loan.id} className="flex items-center justify-between bg-background/50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">Escaninho {loan.locker?.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {loan.borrower_name}
                          </p>
                          <p className="text-xs text-destructive font-medium">
                            {getDaysOverdue(loan.expected_return_date)} dias de atraso
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/55${loan.borrower_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg"
                        >
                          <Phone className="h-3 w-3" />
                          Contatar
                        </a>
                      </div>
                    ))}
                  </div>
                  {overdueLockers.length > 5 && (
                    <Button asChild variant="link" size="sm" className="mt-2">
                      <Link to="/lockers/loans">Ver todos ({overdueLockers.length})</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((module) => (
            <Card 
              key={module.id} 
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden"
              onClick={() => navigate(module.href)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-lg`}>
                      <module.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {module.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {module.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`grid grid-cols-${module.stats.length} gap-4`}>
                  {module.stats.map((stat, index) => (
                    <div 
                      key={index} 
                      className={`${module.bgColor} rounded-lg p-3 text-center`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/equipment/register">
                  <Monitor className="h-5 w-5" />
                  <span className="text-xs">Cadastrar Equipamento</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/equipment/loan/new">
                  <Package className="h-5 w-5" />
                  <span className="text-xs">Novo Empréstimo</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/rooms/checklist/new">
                  <ClipboardCheck className="h-5 w-5" />
                  <span className="text-xs">Novo Checklist</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                <Link to="/lost-found/register">
                  <Package className="h-5 w-5" />
                  <span className="text-xs">Registrar Item</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
