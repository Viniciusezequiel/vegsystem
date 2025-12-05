import { useNavigate } from 'react-router-dom';
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
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Calendar
} from 'lucide-react';
import { mockModuleStats, mockLogs, mockRoomChecklists, mockEquipmentLoans } from '@/data/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
      { label: 'Disponíveis', value: mockModuleStats.lostFound.available, icon: CheckCircle2 },
      { label: 'Pendentes', value: mockModuleStats.lostFound.pending, icon: Clock },
      { label: 'Entregues', value: mockModuleStats.lostFound.delivered, icon: TrendingUp },
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
      { label: 'Disponíveis', value: mockModuleStats.equipment.available, icon: CheckCircle2 },
      { label: 'Emprestados', value: mockModuleStats.equipment.borrowed, icon: Users },
      { label: 'Manutenção', value: mockModuleStats.equipment.maintenance, icon: AlertCircle },
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
      { label: 'Salas', value: mockModuleStats.rooms.total, icon: CheckCircle2 },
      { label: 'Pendentes', value: mockModuleStats.rooms.pendingChecklists, icon: Clock },
      { label: 'Com Problemas', value: mockModuleStats.rooms.issuesReported, icon: AlertCircle },
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
      { label: 'Disponíveis', value: mockModuleStats.lockers.available, icon: CheckCircle2 },
      { label: 'Ocupados', value: mockModuleStats.lockers.occupied, icon: Users },
      { label: 'Vencendo', value: mockModuleStats.lockers.expiringSoon, icon: AlertCircle },
    ],
  },
];

export default function Home() {
  const navigate = useNavigate();

  type ActivityType = 'lost-found' | 'equipment' | 'rooms' | 'lockers';
  
  interface Activity {
    id: string;
    type: ActivityType;
    title: string;
    description: string | undefined;
    user: string;
    time: string;
  }

  interface PendingTask {
    id: string;
    type: ActivityType;
    title: string;
    description: string;
    dueDate: string;
  }

  const lostFoundActivities: Activity[] = mockLogs.slice(0, 3).map(log => ({
    id: log.id,
    type: 'lost-found',
    title: log.action === 'Item registrado' ? 'Item registrado' : log.action === 'Item entregue' ? 'Item entregue' : 'Atividade',
    description: log.itemDescription,
    user: log.userName,
    time: log.timestamp,
  }));

  const equipmentActivities: Activity[] = mockEquipmentLoans.filter(l => l.status === 'active').slice(0, 2).map(loan => ({
    id: loan.id,
    type: 'equipment',
    title: 'Equipamento emprestado',
    description: loan.equipmentName,
    user: loan.borrowerName,
    time: loan.loanDate,
  }));

  const recentActivities = [...lostFoundActivities, ...equipmentActivities]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  const roomTasks: PendingTask[] = mockRoomChecklists.filter(c => c.status === 'pending').map(c => ({
    id: c.id,
    type: 'rooms',
    title: 'Checklist pendente',
    description: c.roomName,
    dueDate: c.date,
  }));

  const loanTasks: PendingTask[] = mockEquipmentLoans.filter(l => l.status === 'active').map(loan => ({
    id: loan.id,
    type: 'equipment',
    title: 'Devolução esperada',
    description: `${loan.equipmentName} - ${loan.borrowerName}`,
    dueDate: loan.expectedReturn,
  }));

  const pendingTasks: PendingTask[] = [...roomTasks, ...loanTasks];

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema de gestão
          </p>
        </div>

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
                <div className="grid grid-cols-3 gap-4">
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

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Atividade Recente
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
                Ver tudo
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'lost-found' ? 'bg-blue-500' :
                    activity.type === 'equipment' ? 'bg-emerald-500' :
                    activity.type === 'rooms' ? 'bg-amber-500' : 'bg-purple-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {activity.type === 'lost-found' ? 'A&P' :
                         activity.type === 'equipment' ? 'Equip.' :
                         activity.type === 'rooms' ? 'Salas' : 'Esc.'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.user} • {format(new Date(activity.time), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Tarefas Pendentes
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {pendingTasks.length} pendentes
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma tarefa pendente</p>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-4 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      task.type === 'rooms' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {task.type === 'rooms' ? (
                        <ClipboardCheck className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Monitor className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Previsto: {format(new Date(task.dueDate), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Ver
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
