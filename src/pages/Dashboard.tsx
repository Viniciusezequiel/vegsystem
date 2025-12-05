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
  ArrowDownRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const navigate = useNavigate();
  const recentItems = mockItems.filter(item => item.status === 'available').slice(0, 3);
  const recentLogs = mockLogs.slice(0, 5);

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Visão geral do sistema de achados e perdidos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Itens"
          value={mockStats.totalItems}
          icon={<Package className="w-6 h-6" />}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          title="Disponíveis"
          value={mockStats.availableItems}
          icon={<CheckCircle2 className="w-6 h-6" />}
          trend={{ value: 12, isPositive: true }}
          iconClassName="bg-success/10 text-success"
        />
        <StatCard
          title="Entregues"
          value={mockStats.deliveredItems}
          icon={<PackageCheck className="w-6 h-6" />}
          iconClassName="bg-muted text-muted-foreground"
        />
        <StatCard
          title="Pendentes"
          value={mockStats.pendingItems}
          icon={<Clock className="w-6 h-6" />}
          iconClassName="bg-warning/10 text-warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Items */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Itens Recentes</h2>
            <button 
              onClick={() => navigate('/items')}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Ver todos
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {recentItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => navigate(`/items/${item.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
            <button 
              onClick={() => navigate('/history')}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Ver tudo
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="space-y-4">
              {recentLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="flex gap-3 animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    log.action.includes('registrado') ? 'bg-success' :
                    log.action.includes('entregue') ? 'bg-primary' :
                    'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {log.action}
                    </p>
                    {log.itemCode && (
                      <p className="text-xs text-muted-foreground font-mono">
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
