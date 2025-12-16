import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getActionLabel, getModuleLabel, ActivityLog } from '@/hooks/useActivityLogs';
import { User, Calendar, FileText, Info } from 'lucide-react';

interface ActivityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityLog | null;
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

export function ActivityDetailDialog({ open, onOpenChange, activity }: ActivityDetailDialogProps) {
  if (!activity) return null;

  const formatDateTime = (date: string) => {
    return format(parseISO(date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Detalhes da Atividade
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action and Module */}
          <div className="flex items-center gap-2">
            <Badge variant={actionVariants[activity.action] || 'default'}>
              {getActionLabel(activity.action)}
            </Badge>
            <Badge variant="outline">{getModuleLabel(activity.module)}</Badge>
          </div>

          <Separator />

          {/* User info */}
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Colaborador</p>
              <p className="font-medium">{activity.user_name}</p>
            </div>
          </div>

          {/* Date/Time */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Data e Hora</p>
              <p className="font-medium">{formatDateTime(activity.created_at)}</p>
            </div>
          </div>

          {/* Description */}
          {activity.entity_description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="font-medium">{activity.entity_description}</p>
              </div>
            </div>
          )}

          {/* Details */}
          {activity.details && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Detalhes Completos</p>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{activity.details}</p>
                </div>
              </div>
            </>
          )}

          {/* Entity ID */}
          {activity.entity_id && (
            <div className="text-xs text-muted-foreground">
              ID do Registro: {activity.entity_id}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}