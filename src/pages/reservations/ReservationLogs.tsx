import { MainLayout } from '@/components/layout/MainLayout';
import { useReservationLogs } from '@/hooks/useReservations';
import { History, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PdfExportButton } from '@/components/ui/PdfExportButton';

export default function ReservationLogs() {
  const { data: logs, isLoading } = useReservationLogs();

  const pdfColumns = [
    { header: 'Ação', accessor: 'action' },
    { header: 'Detalhes', accessor: 'details' },
    { header: 'Executado por', accessor: 'performer_name' },
    { header: 'Data/Hora', accessor: 'created_at' },
  ];

  const formatDataForPdf = (data: typeof logs) => {
    return data?.map(log => ({
      ...log,
      created_at: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
    })) || [];
  };

  return (
    <MainLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
              <History className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Histórico de Reservas</h1>
          </div>
          <p className="page-subtitle">Acompanhe todas as ações realizadas nas reservas</p>
        </div>
        <PdfExportButton
          data={formatDataForPdf(logs)}
          columns={pdfColumns}
          title="Histórico de Reservas"
          filename="historico-reservas"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6">
          <div className="space-y-6">
            {logs?.map((log, index) => (
              <div 
                key={log.id} 
                className="flex gap-4 animate-slide-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  {index !== (logs?.length || 0) - 1 && (
                    <div className="absolute left-5 top-12 w-px h-full -translate-x-1/2 bg-border" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{log.action}</p>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {log.performer_name && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{log.performer_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(!logs || logs.length === 0) && (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum registro encontrado</h3>
              <p className="text-muted-foreground">O histórico aparecerá aqui conforme as ações forem realizadas.</p>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
