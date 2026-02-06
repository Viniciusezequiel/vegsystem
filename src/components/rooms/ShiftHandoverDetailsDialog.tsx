import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClipboardList, Calendar, Clock, User, Building2, Check, X, AlertTriangle, MapPin, MessageSquare } from 'lucide-react';
import { useShiftHandoverDetail } from '@/hooks/useShiftHandovers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function useProfileName(userId: string) {
  return useQuery({
    queryKey: ['profile-name', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.full_name || null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

interface Props {
  handoverId: string | null;
  onClose: () => void;
}

export function ShiftHandoverDetailsDialog({ handoverId, onClose }: Props) {
  const { data: detail, isLoading } = useShiftHandoverDetail(handoverId || '');
  const { data: profileName } = useProfileName(detail?.filled_by || '');

  if (!handoverId) return null;

  const formatDate = (date: string) => {
    try {
      return format(parseISO(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const hasIncidents = detail?.incidents && detail.incidents.length > 0;

  return (
    <Dialog open={!!handoverId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Detalhes da Passagem de Plantão
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : detail && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-semibold">{detail.day_of_week}, {format(parseISO(detail.handover_date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Turno</p>
                    <Badge variant="outline">{detail.shift}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Colaborador(a)</p>
                    <p className="font-medium">{profileName || detail.collaborator_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Setor</p>
                    <p className="font-medium">{detail.sector}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Unidade</p>
                    <p className="font-medium">{detail.unit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Horário do Registro</p>
                    <p className="font-medium">{detail.collaborator_time}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide">
                Tarefas
              </h4>
              <div className="space-y-3">
                {detail.tasks.map((task) => (
                  <div key={task.id} className="flex flex-col gap-2 pb-3 border-b last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm">{task.task_name}</span>
                      <Badge variant={task.answer ? 'default' : 'destructive'} className="flex-shrink-0">
                        {task.answer ? (
                          <><Check className="h-3 w-3 mr-1" /> Sim</>
                        ) : (
                          <><X className="h-3 w-3 mr-1" /> Não</>
                        )}
                      </Badge>
                    </div>
                    {task.observation && (
                      <div className="ml-0 bg-muted/50 p-2 rounded-md">
                        <p className="text-xs text-muted-foreground">{task.observation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Impact Incident */}
            <div className={`border rounded-lg p-4 ${detail.has_impact_incident ? 'border-destructive/50 bg-destructive/5' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${detail.has_impact_incident ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm">Intercorrência de Impacto</span>
                <Badge variant={detail.has_impact_incident ? 'destructive' : 'secondary'}>
                  {detail.has_impact_incident ? 'SIM' : 'NÃO'}
                </Badge>
              </div>
            </div>

            {/* Incidents */}
            {hasIncidents && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-sm text-primary uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Intercorrências
                </h4>
                <div className="space-y-3">
                  {detail.incidents.map((incident) => (
                    <div key={incident.id} className="pb-3 border-b last:border-b-0 last:pb-0 space-y-1">
                      <span className="text-sm font-medium">{incident.incident_type}</span>
                      {incident.description && (
                        <p className="text-xs text-muted-foreground">{incident.description}</p>
                      )}
                      {incident.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {incident.location}
                        </div>
                      )}
                      {incident.treatment && (
                        <div className="bg-muted/50 p-2 rounded-md mt-1">
                          <p className="text-xs font-medium text-muted-foreground">Tratativa:</p>
                          <p className="text-xs">{incident.treatment}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Observations */}
            {detail.general_observations && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-sm text-primary uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observações Gerais
                </h4>
                <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {detail.general_observations}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-xs text-muted-foreground text-right">
              Registrado em {formatDate(detail.filled_at)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
