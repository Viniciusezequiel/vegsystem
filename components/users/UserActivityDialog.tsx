import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Loader2, History, Calendar, FileText, X } from 'lucide-react';
import { useActivityLogs, getActionLabel, getModuleLabel } from '@/hooks/useActivityLogs';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PdfExportButton } from '@/components/ui/PdfExportButton';

interface UserActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const actionVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  approve: 'default',
  reject: 'destructive',
  return: 'secondary',
  deliver: 'default',
  import: 'outline',
  export: 'outline',
};

export function UserActivityDialog({ open, onOpenChange, userId, userName }: UserActivityDialogProps) {
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const { data: logs, isLoading } = useActivityLogs({
    userId,
    dateFrom,
    dateTo,
  });

  const formatDateTime = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const clearFilters = () => {
    setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Atividades de {userName}
          </DialogTitle>
          <DialogDescription>
            Histórico de ações realizadas pelo usuário no sistema
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 py-3 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <DatePickerInput
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="De"
              className="w-[130px]"
            />
            <span className="text-muted-foreground">-</span>
            <DatePickerInput
              value={dateTo}
              onChange={setDateTo}
              placeholder="Até"
              className="w-[130px]"
            />
          </div>
          
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>

          <div className="flex-1" />

          {logs && logs.length > 0 && (
            <PdfExportButton
              title={`Relatório de Atividades - ${userName}`}
              filename={`atividades-${userName.toLowerCase().replace(/\s+/g, '-')}`}
              columns={[
                { header: 'Data/Hora', accessor: (row) => formatDateTime(row.created_at) },
                { header: 'Módulo', accessor: (row) => getModuleLabel(row.module) },
                { header: 'Ação', accessor: (row) => getActionLabel(row.action) },
                { header: 'Descrição', accessor: (row) => row.entity_description || '-' },
                { header: 'Detalhes', accessor: (row) => row.details || '-' },
              ]}
              data={logs}
            />
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-medium text-foreground">Nenhuma atividade encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Este usuário não possui atividades registradas no período selecionado
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getModuleLabel(log.module)}
                      </Badge>
                      <Badge variant={actionVariants[log.action] || 'default'} className="text-xs">
                        {getActionLabel(log.action)}
                      </Badge>
                    </div>
                    {log.entity_description && (
                      <p className="text-sm font-medium mt-1.5 truncate">
                        {log.entity_description}
                      </p>
                    )}
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {log.details}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {logs && logs.length > 0 && (
          <div className="pt-3 border-t text-center">
            <span className="text-sm text-muted-foreground">
              {logs.length} atividade{logs.length !== 1 ? 's' : ''} encontrada{logs.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
