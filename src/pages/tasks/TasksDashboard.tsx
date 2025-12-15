import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  ClipboardCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  XCircle,
  TrendingUp,
  Users,
  Loader2,
} from 'lucide-react';
import { useTasks, getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/hooks/useTasks';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#6b7280', '#f97316'];

export default function TasksDashboard() {
  const { data: tasks, isLoading } = useTasks();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const allTasks = tasks || [];

  // Calculate metrics
  const totalTasks = allTasks.length;
  const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;
  const cancelledTasks = allTasks.filter(t => t.status === 'cancelled').length;
  const onHoldTasks = allTasks.filter(t => t.status === 'on_hold').length;

  // Overdue tasks
  const overdueTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed' || t.status === 'cancelled') return false;
    return differenceInDays(parseISO(t.due_date), new Date()) < 0;
  }).length;

  // Tasks created this month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const tasksThisMonth = allTasks.filter(t => 
    isWithinInterval(parseISO(t.created_at), { start: monthStart, end: monthEnd })
  ).length;

  const completedThisMonth = allTasks.filter(t => 
    t.status === 'completed' && 
    t.completed_at &&
    isWithinInterval(parseISO(t.completed_at), { start: monthStart, end: monthEnd })
  ).length;

  // Status distribution for pie chart
  const statusData = [
    { name: 'Pendente', value: pendingTasks, color: '#f59e0b' },
    { name: 'Em Andamento', value: inProgressTasks, color: '#3b82f6' },
    { name: 'Concluída', value: completedTasks, color: '#22c55e' },
    { name: 'Em Espera', value: onHoldTasks, color: '#f97316' },
    { name: 'Cancelada', value: cancelledTasks, color: '#6b7280' },
  ].filter(d => d.value > 0);

  // Priority distribution for bar chart
  const priorityData = [
    { name: 'Baixa', value: allTasks.filter(t => t.priority === 'low').length },
    { name: 'Normal', value: allTasks.filter(t => t.priority === 'normal').length },
    { name: 'Alta', value: allTasks.filter(t => t.priority === 'high').length },
    { name: 'Urgente', value: allTasks.filter(t => t.priority === 'urgent').length },
  ];

  // Tasks by assignee
  const tasksByAssignee: Record<string, number> = {};
  allTasks.forEach(task => {
    const name = task.assigned_to_name || 'Não atribuído';
    tasksByAssignee[name] = (tasksByAssignee[name] || 0) + 1;
  });
  const assigneeData = Object.entries(tasksByAssignee)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent tasks
  const recentTasks = [...allTasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Completion rate
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Dashboard de Demandas
        </h1>
        <p className="page-subtitle">Métricas e análises das demandas do sistema</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTasks}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueTasks}</p>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Assignee */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Demandas por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assigneeData.length > 0 ? (
              <div className="space-y-3">
                {assigneeData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-6 text-center text-sm text-muted-foreground font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${(item.count / (assigneeData[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium min-w-[100px] truncate">{item.name}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma demanda atribuída
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Demandas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTasks.length > 0 ? (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(task.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={getStatusColor(task.status)} variant="outline">
                        {getStatusLabel(task.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma demanda criada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Stats */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Resumo do Mês ({format(now, 'MMMM yyyy', { locale: ptBR })})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">{tasksThisMonth}</p>
              <p className="text-sm text-muted-foreground">Criadas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-green-600">{completedThisMonth}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-blue-600">{inProgressTasks}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-red-600">{overdueTasks}</p>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
