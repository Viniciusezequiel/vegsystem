import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  CheckCircle2,
  MessageSquareHeart,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BLOCKS = [
  {
    key: 'training',
    label: 'Treinamento recebido',
  },
  {
    key: 'organization',
    label: 'Organização do evento',
  },
  {
    key: 'snack',
    label: 'Lanche / alimentação',
  },
  {
    key: 'partner_fiscal',
    label: 'Avalie o fiscal parceiro (se houver)',
  },
] as const;

function Rating({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button
          key={n}
          type="button"
          size="icon"
          variant={value >= n ? 'default' : 'outline'}
          className="h-10 w-10"
          onClick={() => onChange(n)}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'h-4 w-4',
              value >= n && 'fill-current'
            )}
          />
        </Button>
      ))}
    </div>
  );
}

export default function PsPublicSelfEvaluation() {
  const { eventId: routeEventId } = useParams();

  const { data: visibleEvents = [] } = useQuery({
    queryKey: ['ps_public_events', 'self_evaluation'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_list_events',
        { p_surface: 'self_evaluation' }
      );

      if (error) throw error;
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['ps_public_roles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_list_roles'
      );

      if (error) throw error;
      return data || [];
    },
  });

  const availableRoles = useMemo(
    () =>
      [...roles].sort((a: any, b: any) =>
        String(a.name || '').localeCompare(
          String(b.name || ''),
          'pt-BR'
        )
      ),
    [roles]
  );

  const [eventId, setEventId] = useState(
    routeEventId || ''
  );

  const [identified, setIdentified] = useState(true);
  const [respondentName, setRespondentName] =
    useState('');

  const [role, setRole] = useState('');
  const [campus, setCampus] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');

  const [ratings, setRatings] = useState<
    Record<string, number>
  >({});

  const [comments, setComments] = useState<
    Record<string, string>
  >({});

  const [hadIncident, setHadIncident] =
    useState(false);

  const [incidentComment, setIncidentComment] =
    useState('');

  const [suggestions, setSuggestions] =
    useState('');

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!eventId) {
      toast.error('Selecione o evento.');
      return;
    }

    if (
      visibleEvents.length > 0 &&
      !visibleEvents.some(
        (event: any) => event.id === eventId
      )
    ) {
      toast.error(
        'Este evento não está disponível para autoavaliação.'
      );
      return;
    }

    if (
      identified &&
      !respondentName.trim()
    ) {
      toast.error(
        'Informe seu nome ou marque como anônimo.'
      );
      return;
    }

    if (!role) {
      toast.error('Selecione o cargo exercido.');
      return;
    }

    if (!campus.trim()) {
      toast.error('Informe o campus.');
      return;
    }

    for (const block of BLOCKS) {
      const rating = ratings[block.key];

      if (
        rating &&
        rating <= 2 &&
        !comments[block.key]?.trim()
      ) {
        toast.error(
          `Explique o motivo da nota ${rating} em "${block.label}".`
        );
        return;
      }
    }

    if (
      hadIncident &&
      !incidentComment.trim()
    ) {
      toast.error(
        'Descreva a ocorrência antes de enviar.'
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'ps_public_submit_self_evaluation',
        {
          p_event_id: eventId,
          p_identified: identified,
          p_respondent_name: identified
            ? respondentName.trim()
            : null,

          p_role: role,
          p_campus: campus.trim(),
          p_floor: floor.trim() || null,
          p_room: room.trim() || null,

          p_training_rating:
            ratings.training || null,
          p_training_comment:
            comments.training?.trim() || null,

          p_organization_rating:
            ratings.organization || null,
          p_organization_comment:
            comments.organization?.trim() || null,

          p_snack_rating:
            ratings.snack || null,
          p_snack_comment:
            comments.snack?.trim() || null,

          p_partner_fiscal_rating:
            ratings.partner_fiscal || null,
          p_partner_fiscal_comment:
            comments.partner_fiscal?.trim() || null,

          p_had_incident: hadIncident,
          p_incident_comment: hadIncident
            ? incidentComment.trim()
            : null,

          p_suggestions:
            suggestions.trim() || null,
        }
      );

      if (error) throw error;
      if (!data) {
        throw new Error(
          'Não foi possível registrar a autoavaliação.'
        );
      }

      setDone(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a autoavaliação.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md rounded-2xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />

            <CardTitle>
              Resposta enviada!
            </CardTitle>

            <CardDescription>
              Obrigado pelo seu feedback.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-3 sm:p-4">
      <div className="mx-auto max-w-2xl space-y-4 py-4 sm:space-y-6 sm:py-6">

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquareHeart className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              Autoavaliação do Evento
            </h1>

            <p className="text-sm text-muted-foreground">
              Conte como foi sua experiência no processo seletivo.
            </p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Identificação
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Evento *</Label>

              <Select
                value={eventId}
                onValueChange={setEventId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>

                <SelectContent>
                  {visibleEvents.map((event: any) => (
                    <SelectItem
                      key={event.id}
                      value={event.id}
                    >
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">
                  Quero me identificar
                </p>

                <p className="text-xs text-muted-foreground">
                  Desative para responder anonimamente.
                </p>
              </div>

              <Switch
                checked={identified}
                onCheckedChange={setIdentified}
              />
            </div>

            {identified && (
              <div className="space-y-2">
                <Label>Seu nome *</Label>

                <Input
                  className="h-11"
                  value={respondentName}
                  onChange={(event) =>
                    setRespondentName(
                      event.target.value
                    )
                  }
                  placeholder="Nome completo"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Cargo exercido *</Label>

              <Select
                value={role}
                onValueChange={setRole}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>

                <SelectContent>
                  {availableRoles.map(
                    (item: any) => (
                      <SelectItem
                        key={item.id}
                        value={item.value}
                      >
                        {item.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Campus *</Label>

              <Input
                className="h-11"
                value={campus}
                onChange={(event) =>
                  setCampus(event.target.value)
                }
                placeholder="Ex.: Campus I"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Andar</Label>

                <Input
                  className="h-11"
                  value={floor}
                  onChange={(event) =>
                    setFloor(event.target.value)
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Sala</Label>

                <Input
                  className="h-11"
                  value={room}
                  onChange={(event) =>
                    setRoom(event.target.value)
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Sua avaliação
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {BLOCKS.map((block) => {
              const rating =
                ratings[block.key] || 0;

              const requiresComment =
                rating > 0 && rating <= 2;

              return (
                <div
                  key={block.key}
                  className="space-y-3 rounded-xl border p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium">
                      {block.label}
                    </span>

                    <Rating
                      value={rating}
                      onChange={(value) =>
                        setRatings({
                          ...ratings,
                          [block.key]: value,
                        })
                      }
                    />
                  </div>

                  {requiresComment && (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      Para notas 1 ou 2, conte brevemente o motivo.
                    </p>
                  )}

                  <Textarea
                    rows={2}
                    placeholder={
                      requiresComment
                        ? 'Explique o motivo da nota *'
                        : 'Comentário (opcional)'
                    }
                    value={
                      comments[block.key] || ''
                    }
                    onChange={(event) =>
                      setComments({
                        ...comments,
                        [block.key]:
                          event.target.value,
                      })
                    }
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">
                  Houve alguma ocorrência?
                </p>

                <p className="text-xs text-muted-foreground">
                  Informe qualquer situação relevante durante o evento.
                </p>
              </div>

              <Switch
                checked={hadIncident}
                onCheckedChange={setHadIncident}
              />
            </div>

            {hadIncident && (
              <div className="space-y-2">
                <Label>
                  Descreva a ocorrência *
                </Label>

                <Textarea
                  rows={3}
                  placeholder="Conte o que aconteceu"
                  value={incidentComment}
                  onChange={(event) =>
                    setIncidentComment(
                      event.target.value
                    )
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Sugestões de melhoria
              </Label>

              <Textarea
                rows={3}
                value={suggestions}
                onChange={(event) =>
                  setSuggestions(
                    event.target.value
                  )
                }
                placeholder="Opcional"
              />
            </div>

            <Button
              className="h-12 w-full text-base"
              onClick={submit}
              disabled={saving}
            >
              {saving
                ? 'Enviando...'
                : 'Enviar resposta'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
