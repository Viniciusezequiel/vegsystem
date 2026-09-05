import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { useLostItemLogs } from '@/hooks/useLostItemLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, UserPlus, PackageCheck, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const getActionIcon = (action: string) => {
  if (action.includes('registrado')) return <Package className="h-4 w-4" />;
  if (action.includes('entregue')) return <PackageCheck className="h-4 w-4" />;
  if (action.includes('Usuário')) return <UserPlus className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
};

const getActionColor = (action: string) => {
  if (action.includes('registrado')) return 'bg-success text-success-foreground';
  if (action.includes('entregue')) return 'bg-primary text-primary-foreground';
  if (action.includes('Usuário')) return 'bg-warning text-warning-foreground';
  return 'bg-muted text-muted-foreground';
};

export default function History() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: logs = [], isLoading } = useLostItemLogs();

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.itemCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <PageHeader
        title="Histórico de Atividades"
        description="Registro de todas as ações realizadas no sistema"
      />

      <PageToolbar className="mb-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação, usuário, código ou detalhes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </PageToolbar>

      {isLoading ? (
        <ContentState
          loading
          title="Carregando histórico"
          description="Buscando as atividades mais recentes."
        />
      ) : filteredLogs.length === 0 ? (
        <ContentState
          title="Nenhuma atividade encontrada"
          description={searchQuery ? 'Tente ajustar os termos da busca.' : 'As próximas ações do sistema aparecerão aqui.'}
        />
      ) : (
        <div className="relative">
          <div className="absolute bottom-0 left-6 top-0 w-px bg-border/70" />

          <div className="space-y-4">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id}
                className="relative flex gap-4 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${getActionColor(log.action)}`}>
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 rounded-xl border border-border/60 bg-card/65 p-4 transition-colors hover:border-primary/20 hover:bg-card/80">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">{log.action}</h3>
                      {log.itemCode && (
                        <p className="mt-0.5 font-mono text-sm text-primary">{log.itemCode}</p>
                      )}
                      {log.details && (
                        <p className="mt-2 text-sm text-muted-foreground">{log.details}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Por: <span className="font-medium text-foreground">{log.userName}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
