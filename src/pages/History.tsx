import { MainLayout } from '@/components/layout/MainLayout';
import { mockLogs } from '@/data/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, UserPlus, PackageCheck, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const getActionIcon = (action: string) => {
  if (action.includes('registrado')) return <Package className="w-4 h-4" />;
  if (action.includes('entregue')) return <PackageCheck className="w-4 h-4" />;
  if (action.includes('Usuário')) return <UserPlus className="w-4 h-4" />;
  return <Package className="w-4 h-4" />;
};

const getActionColor = (action: string) => {
  if (action.includes('registrado')) return 'bg-success text-success-foreground';
  if (action.includes('entregue')) return 'bg-primary text-primary-foreground';
  if (action.includes('Usuário')) return 'bg-warning text-warning-foreground';
  return 'bg-muted text-muted-foreground';
};

export default function History() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = mockLogs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.itemCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Histórico de Atividades</h1>
        <p className="page-subtitle">Registro de todas as ações realizadas no sistema</p>
      </div>

      {/* Search */}
      <div className="mb-8 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar no histórico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
        
        <div className="space-y-6">
          {filteredLogs.map((log, index) => (
            <div 
              key={log.id} 
              className="relative flex gap-6 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${getActionColor(log.action)}`}>
                {getActionIcon(log.action)}
              </div>
              <div className="flex-1 bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{log.action}</h3>
                    {log.itemCode && (
                      <p className="text-sm font-mono text-primary mt-0.5">{log.itemCode}</p>
                    )}
                    {log.details && (
                      <p className="text-sm text-muted-foreground mt-2">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Por: <span className="font-medium text-foreground">{log.userName}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
