import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ItemCard } from '@/components/items/ItemCard';
import { mockStats, mockItems, mockLogs } from '@/data/mockData';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  PackageCheck,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const navigate = useNavigate();
  const recentItems = mockItems.filter(item => item.status === 'available').slice(0, 3);
  const recentLogs = mockLogs.slice(0, 5);

  return (
    <MainLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="page-title">Dashboard</h1>
          </div>
          <p className="page-subtitle">Visão geral do sistema de gestão integrado</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Sistema Online
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Itens"
          value={mockStats.totalItems}
          icon={<Package className="w-5 h-5" />}
          iconClassName="gradient-primary text-primary-foreground"
        />
        <StatCard
          title="Disponíveis"
          value={mockStats.availableItems}
          icon={<CheckCircle2 className="w-5 h-5" />}
          trend={{ value: 12, isPositive: true }}
          iconClassName="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
        />
        <StatCard
          title="Entregues"
          value={mockStats.deliveredItems}
          icon={<PackageCheck className="w-5 h-5" />}
          iconClassName="bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
        />
        <StatCard
          title="Pendentes"
          value={mockStats.pendingItems}
          icon={<Clock className="w-5 h-5" />}
          iconClassName="bg-gradient-to-r from-orange-500 to-amber-500 text-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Items */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Itens Recentes</h2>
            </div>
            <Button 
              variant="ghost"
              onClick={() => navigate('/items')}
              className="text-sm text-primary hover:text-primary hover:bg-primary/10 gap-1"
            >
              Ver todos
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {recentItems.map((item, index) => (
              <div 
                key={item.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <ItemCard
                  item={item}
                  onClick={() => navigate(`/items/${item.id}`)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Atividade</h2>
            </div>
            <Button 
              variant="ghost"
              onClick={() => navigate('/history')}
              className="text-sm text-primary hover:text-primary hover:bg-primary/10 gap-1"
            >
              Ver tudo
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="space-y-4">
              {recentLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="flex gap-3 animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-4 ring-background ${
                      log.action.includes('registrado') ? 'bg-success' :
                      log.action.includes('entregue') ? 'bg-primary' :
                      'bg-muted-foreground'
                    }`} />
                    {index !== recentLogs.length - 1 && (
                      <div className="absolute left-1.5 top-5 w-px h-full -translate-x-1/2 bg-border" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <p className="text-sm font-medium text-foreground">
                      {log.action}
                    </p>
                    {log.itemCode && (
                      <p className="text-xs text-primary font-mono mt-0.5">
                        {log.itemCode}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.userName} • {format(new Date(log.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
