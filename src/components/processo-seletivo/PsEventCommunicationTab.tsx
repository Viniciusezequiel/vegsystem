import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  usePsCommunicationConfig,
  usePsEmailTrackingSync,
  usePsEventCommunications,
  usePsProcessEventCommunicationQueue,
  usePsRetryEventCommunications,
  usePsSendEventCommunication,
} from '@/hooks/useProcessoSeletivo';
import {
  DEFAULT_CONFIRMATION_SUBJECT,
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_EVENT_MESSAGE_SUBJECT,
  DEFAULT_EVENT_MESSAGE_TEMPLATE,
  filterPsCommunicationRecipients,
  formatPsEventDateBR,
  renderPsCommunicationTemplate,
} from '@/lib/psCommunicationCore.mjs';
import { getPsConfirmationStatusLabel } from '@/lib/psConfirmationState.mjs';
import { getPsContactPhone } from '@/lib/psConfirmationNotice.mjs';
import { normalizePsLocation } from '@/lib/psLocationNormalization.mjs';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Copy, Download, FileSpreadsheet, FileText, FilterX, MailWarning, MoreHorizontal, Phone, Send, Upload, Plus, Trash2, Pencil, Star, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  waiting_provider_quota: 'Aguardando cota diária',
  processing: 'Processando',
  sent: 'Enviado',
  failed: 'Falhou',
  failed_missing_recipient: 'Sem e-mail',
  cancelled: 'Cancelado',
};

const communicationTypeLabel: Record<string, string> = {
  confirmation_request: 'Solicitação de confirmação',
  event_message: 'Mensagem do evento',
  training_reselection: 'Nova escolha de treinamento',
};

const VARIABLE_CHIPS: { label: string; token: string; confirmationOnly?: boolean }[] = [
  { label: 'Nome', token: 'nome' },
  { label: 'Evento', token: 'evento' },
  { label: 'Data', token: 'data_evento' },
  { label: 'Cargo', token: 'cargo' },
  { label: 'Campus', token: 'campus' },
  { label: 'Unidade', token: 'unidade' },
  { label: 'Prédio', token: 'predio' },
  { label: 'Andar', token: 'andar' },
  { label: 'Sala', token: 'sala' },
  { label: 'Horário', token: 'horario' },
  { label: 'Link de confirmação', token: 'link_confirmacao', confirmationOnly: true },
];

type ConfirmationDeliveryState = 'not_sent' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'queued';

const queuedStatuses = new Set(['pending', 'waiting_provider_quota', 'processing']);
const failedStatuses = new Set(['failed', 'failed_missing_recipient']);
const providerErrorStatuses = new Set(['soft_bounce', 'hard_bounce', 'blocked', 'spam', 'invalid', 'error', 'unsubscribed']);

const deliveryLabel: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregue',
  opened: 'Aberto',
  clicked: 'Clicou no link',
  deferred: 'Entrega adiada',
  soft_bounce: 'Erro temporário',
  hard_bounce: 'E-mail rejeitado',
  blocked: 'Bloqueado',
  spam: 'Marcado como spam',
  invalid: 'E-mail inválido',
  error: 'Erro no envio',
  unsubscribed: 'Descadastrado',
  unknown: 'Status recebido',
};

function formatSentAt(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type Props = {
  event: any;
  links: any[];
  excludedLinks?: any[];
  inactiveLinks?: any[];
  onRequestConfirmation: (link: any) => void;
  onCopyConfirmationMessage: (link: any) => void;
  onReplace: (link: any) => void;
  onExportFiltered: (rows: any[], format: 'pdf' | 'excel', filters: string[]) => void;
  requestingConfirmation?: boolean;
  onImportTeam?: () => void;
  onAddTeamMember?: () => void;
  onClearTeam?: () => void;
  onEditMember?: (link: any) => void;
  onRemoveMember?: (link: any) => void;
  onReincludeMember?: (link: any) => void;
  onEvaluateMember?: (link: any) => void;
  onTogglePresence?: (link: any, field: 'present' | 'absent', value: boolean) => void;
};

export function PsEventCommunicationTab({
  event,
  links,
  excludedLinks = [],
  inactiveLinks = [],
  onRequestConfirmation,
  onCopyConfirmationMessage,
  onReplace,
  onExportFiltered,
  requestingConfirmation = false,
  onImportTeam,
  onAddTeamMember,
  onClearTeam,
  onEditMember,
  onRemoveMember,
  onReincludeMember,
  onEvaluateMember,
  onTogglePresence,
}: Props) {
  const { data: history = [] } = usePsEventCommunications(event?.id);
  usePsEmailTrackingSync(event?.id);
  const { data: config, error: configError } = usePsCommunicationConfig(event?.id);
  const send = usePsSendEventCommunication();
  const retry = usePsRetryEventCommunications();
  const processQueue = usePsProcessEventCommunicationQueue();

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [roles, setRoles] = useState<string[]>([]);
  const [building, setBuilding] = useState('all');
  const [room, setRoom] = useState('all');
  const [delivery, setDelivery] = useState('all');
  const [quickView, setQuickView] = useState<'all' | 'action' | 'pending' | 'confirmed' | 'declined' | 'failed' | 'not_sent' | 'replaced'>('all');
  const [typeDialog, setTypeDialog] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [type, setType] = useState('confirmation_request');
  const [subject, setSubject] = useState(DEFAULT_CONFIRMATION_SUBJECT);
  const [template, setTemplate] = useState(DEFAULT_CONFIRMATION_TEMPLATE);
  const [requestKey, setRequestKey] = useState('');
  const [result, setResult] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allowConfirmationResend, setAllowConfirmationResend] = useState(false);
  const [backgroundProgress, setBackgroundProgress] = useState<any>(null);
  const [backgroundHidden, setBackgroundHidden] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const roleOptions = useMemo(
    () => [...new Set(links.map((link) => link.role_name || link.assigned_role || 'Sem função'))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [links],
  );

  const buildingOptions = useMemo(
    () => [...new Set(links.map((link) => normalizePsLocation(link.building, { building: true })).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [links],
  );

  const latestByLink = useMemo(() => {
    const map = new Map<string, any>();
    for (const job of history) {
      if (!map.has(job.event_collaborator_id)) map.set(job.event_collaborator_id, job);
    }
    return map;
  }, [history]);

  const confirmationDelivery = useMemo(() => {
    const latest = new Map<string, any>();
    const sent = new Map<string, any>();

    for (const job of history) {
      if (job.communication_type !== 'confirmation_request') continue;
      const linkId = String(job.event_collaborator_id || '');
      if (!linkId) continue;
      if (!latest.has(linkId)) latest.set(linkId, job);
      if (job.status === 'sent' && !sent.has(linkId)) sent.set(linkId, job);
    }

    const state = new Map<string, ConfirmationDeliveryState>();
    for (const link of links) {
      const linkId = String(link.id);
      const job = latest.get(linkId);
      if (!job || job.status === 'cancelled') state.set(linkId, 'not_sent');
      else if (failedStatuses.has(job.status)) state.set(linkId, 'failed');
      else if (queuedStatuses.has(job.status)) state.set(linkId, 'queued');
      else if (providerErrorStatuses.has(job.delivery_status)) state.set(linkId, 'failed');
      else if (['delivered', 'opened', 'clicked'].includes(job.delivery_status)) state.set(linkId, job.delivery_status);
      else if (job.status === 'sent') state.set(linkId, 'sent');
      else state.set(linkId, 'not_sent');
    }

    return { latest, sent, state };
  }, [history, links]);

  const actionSummary = useMemo(() => {
    const pending = links.filter((link: any) => link.participation_status === 'pending_confirmation');
    const confirmed = links.filter((link: any) => link.participation_status === 'confirmed');
    const declined = links.filter((link: any) => link.participation_status === 'declined');
    const replaced = links.filter((link: any) => link.participation_status === 'replaced');
    const failed = links.filter((link: any) =>
      confirmationDelivery.state.get(String(link.id)) === 'failed'
    );
    const notSent = links.filter((link: any) =>
      confirmationDelivery.state.get(String(link.id)) === 'not_sent'
    );

    const actionIds = new Set<string>();
    for (const link of pending) actionIds.add(String(link.id));
    for (const link of declined) actionIds.add(String(link.id));
    for (const link of failed) actionIds.add(String(link.id));

    const pendingNotSent = pending.filter((link: any) =>
      confirmationDelivery.state.get(String(link.id)) === 'not_sent'
    );

    const failedConfirmationJobs = failed
      .map((link: any) => confirmationDelivery.latest.get(String(link.id)))
      .filter((job: any) => !!job?.id);

    return {
      pending,
      confirmed,
      declined,
      replaced,
      failed,
      notSent,
      pendingNotSent,
      failedConfirmationJobs,
      actionIds,
      actionCount: actionIds.size,
    };
  }, [links, confirmationDelivery]);

  const filtered = useMemo(() => {
    const base = filterPsCommunicationRecipients(links, { search, status, unit: 'all', room });
    return base.filter((link: any) => {
      const linkId = String(link.id);
      const roleName = link.role_name || link.assigned_role || 'Sem função';
      const deliveryState = confirmationDelivery.state.get(linkId) || 'not_sent';

      if (roles.length && !roles.includes(roleName)) return false;
      if (building !== 'all' && normalizePsLocation(link.building, { building: true }) !== building) return false;
      if (delivery !== 'all' && deliveryState !== delivery) return false;

      if (quickView === 'action' && !actionSummary.actionIds.has(linkId)) return false;
      if (quickView === 'pending' && link.participation_status !== 'pending_confirmation') return false;
      if (quickView === 'confirmed' && link.participation_status !== 'confirmed') return false;
      if (quickView === 'declined' && link.participation_status !== 'declined') return false;
      if (quickView === 'replaced' && link.participation_status !== 'replaced') return false;
      if (quickView === 'failed' && deliveryState !== 'failed') return false;
      if (quickView === 'not_sent' && deliveryState !== 'not_sent') return false;

      return true;
    });
  }, [links, search, status, building, room, roles, delivery, quickView, confirmationDelivery, actionSummary]);

  const selectedLinks = useMemo(
    () => selected.map((id) => links.find((link) => String(link.id) === id)).filter(Boolean),
    [selected, links],
  );
  const operationalSelected = useMemo(
    () => selectedLinks
      .filter((link) => ['pending_confirmation', 'confirmed'].includes(String(link.participation_status || '')))
      .map((link) => String(link.id)),
    [selectedLinks],
  );
  const selectedInactive = useMemo(
    () => selectedLinks.filter((link) => !['pending_confirmation', 'confirmed'].includes(String(link.participation_status || ''))),
    [selectedLinks],
  );
  const pendingConfirmationSelected = useMemo(
    () => selectedLinks
      .filter((link) => link.participation_status === 'pending_confirmation')
      .map((link) => String(link.id)),
    [selectedLinks],
  );
  const selectedNotPendingConfirmation = useMemo(
    () => selectedLinks.filter((link) => link.participation_status !== 'pending_confirmation'),
    [selectedLinks],
  );
  const selectedAlreadySent = useMemo(
    () => pendingConfirmationSelected.filter((id) => confirmationDelivery.sent.has(id)),
    [pendingConfirmationSelected, confirmationDelivery],
  );
  const selectedNotPreviouslySent = useMemo(
    () => pendingConfirmationSelected.filter((id) => !confirmationDelivery.sent.has(id)),
    [pendingConfirmationSelected, confirmationDelivery],
  );
  const effectiveSelected = type === 'confirmation_request'
    ? (allowConfirmationResend ? pendingConfirmationSelected : selectedNotPreviouslySent)
    : operationalSelected;

  const previewLink = links.find((link) => effectiveSelected.includes(link.id)) || links.find((link) => selected.includes(link.id));
  const previewValues = {
    nome: previewLink?.collaborator_name,
    evento: event?.name,
    cargo: previewLink?.role_name || previewLink?.assigned_role,
    campus: previewLink?.campus,
    unidade: previewLink?.unit,
    instituicao: previewLink?.institution,
    setor: previewLink?.sector,
    predio: previewLink?.building,
    andar: previewLink?.floor,
    sala: previewLink?.room,
    horario: previewLink?.work_schedule,
    data_evento: formatPsEventDateBR(event?.date),
    local_evento: event?.location,
    descricao_evento: event?.description,
    coordenador_evento: event?.coordinator_name,
    link_confirmacao: 'https://www.vegsystem.site/ps/confirmacao/…',
  };
  const preview = previewLink ? renderPsCommunicationTemplate(template, previewValues) : '';
  const previewSubject = previewLink ? renderPsCommunicationTemplate(subject, previewValues) : subject;
  const canSend = !!config?.providerConfigured && (config.mode !== 'test' || config.testRecipientConfigured);

  const openMessage = (nextType: string, onlyId?: string) => {
    if (onlyId) setSelected([onlyId]);
    setTypeDialog(false);
    setType(nextType);
    setAllowConfirmationResend(false);
    setSubject(nextType === 'confirmation_request' ? DEFAULT_CONFIRMATION_SUBJECT : DEFAULT_EVENT_MESSAGE_SUBJECT);
    setTemplate(nextType === 'confirmation_request' ? DEFAULT_CONFIRMATION_TEMPLATE : DEFAULT_EVENT_MESSAGE_TEMPLATE);
    setRequestKey(crypto.randomUUID());
    setResult(null);
    setDialog(true);
  };

  const openConfirmationFor = (recipientIds: string[], includeAlreadySent = false) => {
    const ids = [...new Set(recipientIds.map(String))];
    if (!ids.length) return;
    setSelected(ids);
    setType('confirmation_request');
    setAllowConfirmationResend(includeAlreadySent);
    setSubject(DEFAULT_CONFIRMATION_SUBJECT);
    setTemplate(DEFAULT_CONFIRMATION_TEMPLATE);
    setRequestKey(crypto.randomUUID());
    setResult(null);
    setDialog(true);
  };

  const applyQuickView = (view: typeof quickView) => {
    setQuickView(view);
    setStatus('all');
    setDelivery('all');
  };

  const clearOperationalFilters = () => {
    setSearch('');
    setStatus('all');
    setRoles([]);
    setBuilding('all');
    setRoom('all');
    setDelivery('all');
    setQuickView('all');
  };

  const insertVariable = (token: string) => {
    const el = templateRef.current;
    const chip = `{{${token}}}`;
    if (!el) {
      setTemplate((prev) => `${prev}${chip}`);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${chip}${template.slice(end)}`;
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + chip.length, start + chip.length);
    });
  };

  const submit = async () => {
    const recipients = effectiveSelected;
    if (!recipients.length) return;

    const first = await send.mutateAsync({
      eventId: event.id,
      eventCollaboratorIds: recipients,
      communicationType: type,
      subject,
      template,
      requestKey,
    });

    const initialTotal = Number(first.total || recipients.length);
    const initialSent = Number(first.sent || 0);
    const initialFailed = Number(first.failed || 0);
    const initialMissing = Number(first.missingRecipient || 0);
    const initialPending = Number(first.pending || 0);
    const initialQuotaWaiting = Number(first.quotaWaiting || 0);

    setResult({
      ...first,
      total: initialTotal,
      sent: initialSent,
      failed: initialFailed,
      missingRecipient: initialMissing,
      pending: initialPending,
      quotaWaiting: initialQuotaWaiting,
    });
    setBackgroundHidden(false);
    setBackgroundProgress({
      total: initialTotal,
      sent: initialSent,
      failed: initialFailed,
      missingRecipient: initialMissing,
      pending: initialPending,
      quotaWaiting: initialQuotaWaiting,
      active: initialPending > 0 && initialQuotaWaiting === 0,
      completed: initialPending === 0 && initialQuotaWaiting === 0,
    });

    setDialog(false);
    setSelected([]);
    toast.success(initialPending > 0 ? 'Envio iniciado. Você pode continuar usando o sistema.' : 'Envio concluído.');

    if (initialPending <= 0 || initialQuotaWaiting > 0) return;

    void (async () => {
      let sentCount = initialSent;
      let failedCount = initialFailed;
      let missingCount = initialMissing;
      let pendingCount = initialPending;
      let quotaCount = initialQuotaWaiting;
      const batchSize = Math.max(1, Number(config?.batchLimit || 5));
      const maxRuns = Math.max(1, Math.ceil(initialPending / batchSize) + 2);

      for (let i = 0; i < maxRuns && pendingCount > 0 && quotaCount === 0; i += 1) {
        try {
          const next = await processQueue.mutateAsync({ eventId: event.id, silent: true });
          sentCount += Number(next.sent || 0);
          failedCount += Number(next.failed || 0);
          missingCount += Number(next.missingRecipient || 0);
          quotaCount += Number(next.quotaWaiting || 0);
          pendingCount = Math.max(0, initialTotal - sentCount - failedCount - missingCount - quotaCount);

          setBackgroundProgress({
            total: initialTotal,
            sent: sentCount,
            failed: failedCount,
            missingRecipient: missingCount,
            pending: pendingCount,
            quotaWaiting: quotaCount,
            active: pendingCount > 0 && quotaCount === 0,
            completed: pendingCount === 0 && quotaCount === 0,
          });
          setResult((current: any) => ({
            ...(current || {}),
            total: initialTotal,
            sent: sentCount,
            failed: failedCount,
            missingRecipient: missingCount,
            pending: pendingCount,
            quotaWaiting: quotaCount,
          }));

          if (Number(next.total || 0) === 0) break;
        } catch (error) {
          setBackgroundProgress((current: any) => current ? {
            ...current,
            active: false,
            completed: false,
            error: error instanceof Error ? error.message : 'Erro ao processar a fila.',
          } : current);
          return;
        }
      }

      setBackgroundProgress((current: any) => current ? {
        ...current,
        sent: sentCount,
        failed: failedCount,
        missingRecipient: missingCount,
        pending: pendingCount,
        quotaWaiting: quotaCount,
        active: false,
        completed: pendingCount === 0 && quotaCount === 0,
      } : current);
    })();
  };
  const failedJobs = history.filter(
    (job: any) => ['failed', 'failed_missing_recipient'].includes(job.status) && selected.includes(job.event_collaborator_id),
  );
  const quotaWaiting = history.filter((job: any) => job.status === 'waiting_provider_quota').length;

  const selectAllFiltered = () => setSelected((current) => [...new Set([...current, ...filtered.map((link: any) => link.id)])]);
  const appliedFilterLabels = [
    quickView !== 'all' ? `Atalho: ${{
      action: 'Precisam de ação',
      pending: 'Aguardando',
      confirmed: 'Confirmados',
      declined: 'Recusaram',
      failed: 'Erro de e-mail',
      not_sent: 'Não enviados',
      replaced: 'Substituídos',
    }[quickView] || quickView}` : '',
    search.trim() ? `Busca: ${search.trim()}` : '',
    status !== 'all' ? `Situação: ${getPsConfirmationStatusLabel(status)}` : '',
    roles.length ? `Cargo(s): ${roles.join(', ')}` : '',
    building !== 'all' ? `Prédio: ${building}` : '',
    room !== 'all' ? `Sala: ${room}` : '',
    delivery !== 'all' ? `Envio: ${deliveryLabel[delivery] || delivery}` : '',
  ].filter(Boolean);

  const hasOperationalFilters =
    quickView !== 'all' ||
    !!search.trim() ||
    status !== 'all' ||
    roles.length > 0 ||
    building !== 'all' ||
    room !== 'all' ||
    delivery !== 'all';

  const copyPhone = async (link: any) => {
    const phone = getPsContactPhone(link);
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    toast.success('Celular copiado.');
  };

  return <div className="space-y-3">
    {(configError || config?.mode === 'test' || (config && !config.providerConfigured)) && (
      <div className={`rounded-xl border px-3 py-2 text-xs ${config?.mode === 'test' ? 'border-amber-400/50 bg-amber-500/10 text-amber-200' : 'bg-muted/30 text-muted-foreground'}`}>
        {config?.mode === 'test'
          ? <strong>MODO TESTE: os e-mails não serão enviados aos fiscais reais.</strong>
          : configError
            ? 'Backend de e-mail ainda não publicado/configurado.'
            : 'Provider pendente de configuração.'}
        {config?.mode === 'test' && !config.testRecipientConfigured && <span> Destinatário de teste ausente; envios bloqueados.</span>}
      </div>
    )}

    {quotaWaiting > 0 && <p className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">{quotaWaiting} mensagens aguardando a renovação da cota diária do provedor.</p>}

    <Card className="rounded-2xl border-violet-500/15 bg-gradient-to-r from-card/75 via-card/55 to-violet-500/[0.035]">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold">Acesso rápido</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Filtre a equipe pela ação necessária sem montar combinações manualmente.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'action', label: 'Precisam de ação', count: actionSummary.actionCount, icon: AlertTriangle },
              { key: 'pending', label: 'Aguardando', count: actionSummary.pending.length, icon: Clock3 },
              { key: 'confirmed', label: 'Confirmados', count: actionSummary.confirmed.length, icon: CheckCircle2 },
              { key: 'declined', label: 'Recusaram', count: actionSummary.declined.length, icon: AlertTriangle },
              { key: 'failed', label: 'Erro de e-mail', count: actionSummary.failed.length, icon: MailWarning },
              { key: 'not_sent', label: 'Não enviados', count: actionSummary.notSent.length, icon: Send },
              { key: 'replaced', label: 'Substituídos', count: actionSummary.replaced.length, icon: UserCheck },
            ].map((item) => {
              const Icon = item.icon;
              const active = quickView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => applyQuickView(active ? 'all' : item.key as typeof quickView)}
                  className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-semibold transition ${active
                    ? 'border-primary/30 bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.04] hover:text-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  <span className={`rounded-full px-1.5 py-0.5 tabular-nums ${active ? 'bg-primary-foreground/15' : 'bg-muted/70'}`}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {(actionSummary.pending.length > 0 || actionSummary.failedConfirmationJobs.length > 0 || actionSummary.pendingNotSent.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-violet-500/10 pt-3">
            <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Ações rápidas
            </span>

            {actionSummary.pending.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-[10px]"
                onClick={() => openConfirmationFor(actionSummary.pending.map((link: any) => String(link.id)), true)}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Cobrar {actionSummary.pending.length} pendente(s)
              </Button>
            )}

            {actionSummary.pendingNotSent.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-[10px]"
                onClick={() => openConfirmationFor(actionSummary.pendingNotSent.map((link: any) => String(link.id)), false)}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Enviar {actionSummary.pendingNotSent.length} não enviado(s)
              </Button>
            )}

            {actionSummary.failedConfirmationJobs.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl border-destructive/20 text-[10px] text-destructive hover:text-destructive"
                disabled={retry.isPending}
                onClick={() => retry.mutate({
                  eventId: event.id,
                  jobIds: actionSummary.failedConfirmationJobs.map((job: any) => job.id),
                })}
              >
                <MailWarning className="mr-1.5 h-3.5 w-3.5" />
                Reenviar {actionSummary.failedConfirmationJobs.length} falha(s)
              </Button>
            )}

            {hasOperationalFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-8 rounded-xl text-[10px]"
                onClick={clearOperationalFilters}
              >
                <FilterX className="mr-1.5 h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card/70 via-card/45 to-violet-500/[0.035] p-1.5 shadow-sm">
      <div className="flex items-center justify-end gap-2 px-1 pb-1">
        {onImportTeam && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20"
            onClick={onImportTeam}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar planilha
          </Button>
        )}
        {onAddTeamMember && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-violet-400/30 bg-violet-500/10 hover:bg-violet-500/20"
            onClick={onAddTeamMember}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Vincular fiscal
          </Button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" />

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {['pending_confirmation', 'confirmed', 'declined', 'replaced'].map((value) => <SelectItem key={value} value={value}>{getPsConfirmationStatusLabel(value)}</SelectItem>)}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between font-normal">
            {roles.length === 0 ? 'Todos: Cargo' : roles.length === 1 ? roles[0] : `${roles.length} cargos selecionados`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 w-[min(320px,calc(100vw-24px))] overflow-y-auto" align="start">
          <DropdownMenuCheckboxItem
            checked={roles.length === 0}
            onCheckedChange={() => setRoles([])}
            onSelect={(e) => e.preventDefault()}
          >
            Todos os cargos
          </DropdownMenuCheckboxItem>
          {roleOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={roles.includes(option)}
              onCheckedChange={(checked) => setRoles((current) => checked
                ? [...new Set([...current, option])]
                : current.filter((role) => role !== option))}
              onSelect={(e) => e.preventDefault()}
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={building} onValueChange={setBuilding}>
        <SelectTrigger><SelectValue placeholder="Prédio" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os prédios</SelectItem>
          {buildingOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={room} onValueChange={setRoom}>
        <SelectTrigger><SelectValue placeholder="Sala" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos: Sala</SelectItem>
          {[...new Set(links.map((link) => link.room || 'Sem sala'))].map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={delivery} onValueChange={setDelivery}>
        <SelectTrigger><SelectValue placeholder="Envio da confirmação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os envios</SelectItem>
          <SelectItem value="not_sent">Não enviado</SelectItem>
          <SelectItem value="sent">Enviado</SelectItem>
          <SelectItem value="delivered">Entregue</SelectItem>
          <SelectItem value="opened">Aberto</SelectItem>
          <SelectItem value="clicked">Clicou no link</SelectItem>
          <SelectItem value="failed">Falhou</SelectItem>
          <SelectItem value="queued">Na fila</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />Exportar filtrados<ChevronDown className="ml-auto h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={() => onExportFiltered(filtered, 'pdf', appliedFilterLabels)}>
            <FileText className="mr-2 h-4 w-4" />Exportar em PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExportFiltered(filtered, 'excel', appliedFilterLabels)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Exportar em Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-500/15 bg-gradient-to-r from-card/70 via-card/50 to-violet-500/[0.035] px-2 py-1.5 shadow-sm">
      <Checkbox
        checked={filtered.length > 0 && filtered.every((link: any) => selected.includes(link.id))}
        onCheckedChange={(checked) => {
          if (checked) selectAllFiltered();
          else setSelected((current) => current.filter((id) => !filtered.some((link: any) => String(link.id) === String(id))));
        }}
        aria-label="Selecionar todos os resultados filtrados"
      />
      <span className="text-xs text-muted-foreground">{selected.length > 0 ? selected.length + ' selecionado(s)' : filtered.length + ' resultado(s)'}</span>
      {!!selected.length && <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelected([])}>Limpar seleção</Button>}
      <Button
        type="button"
        size="sm"
        disabled={!selected.length}
        className="ps-gradient-button"
        onClick={() => setTypeDialog(true)}
      >
        <Send className="mr-2 h-4 w-4" />
        Enviar comunicação
      </Button>
      {!!failedJobs.length && (
        <Button
          size="sm"
          variant="outline"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ eventId: event.id, jobIds: failedJobs.map((job: any) => job.id) })}
        >
          Reenviar {failedJobs.length} falha(s)
        </Button>
      )}
      <strong className="ml-auto text-xs text-muted-foreground">{selected.length} selecionado(s) · {filtered.length} resultado(s)</strong>
    </div>

    <Card className="overflow-hidden border-violet-500/15 bg-gradient-to-b from-card/80 via-card/60 to-violet-500/[0.025] shadow-[0_8px_35px_rgba(0,0,0,0.12)]">
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[880px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-violet-500/10 bg-gradient-to-r from-violet-500/[0.055] to-transparent text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-11 p-3" />
              <th className="w-[34%] py-3 pr-3">Pessoa</th>
              <th className="w-[16%] py-3 pr-3">Confirmação</th>
              <th className="w-[20%] py-3 pr-3">Envio por e-mail</th>
              <th className="w-[21%] py-3 pr-3">Contato</th>
              <th className="w-14 py-3 pr-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((link: any) => {
              const linkId = String(link.id);
              const deliveryState = confirmationDelivery.state.get(linkId) || 'not_sent';
              const latestConfirmation = confirmationDelivery.latest.get(linkId);
              const statusTimestamp = latestConfirmation?.clicked_at
                || latestConfirmation?.opened_at
                || latestConfirmation?.delivered_at
                || latestConfirmation?.sent_at;
              const providerStatus = String(latestConfirmation?.delivery_status || '');
              return <tr key={link.id} className="border-b align-middle transition-colors hover:bg-muted/15">
                <td className="p-3">
                  <Checkbox
                    checked={selected.includes(link.id)}
                    onCheckedChange={(checked) => setSelected(checked
                      ? [...selected, link.id]
                      : selected.filter((id) => id !== link.id))}
                  />
                </td>
                <td className="py-3 pr-3">
                  <p className="truncate font-semibold">{link.collaborator_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{link.role_name || link.assigned_role || 'Sem função'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[normalizePsLocation(link.building, { building: true }), link.floor, link.room && `Sala ${link.room}`].filter(Boolean).join(' · ') || 'Local não informado'}
                  </p>
                </td>
                <td className="py-3 pr-3"><Badge variant={link.participation_status === 'confirmed' ? 'default' : link.participation_status === 'declined' ? 'destructive' : 'outline'}>{getPsConfirmationStatusLabel(link.participation_status)}</Badge></td>
                <td className="py-3 pr-3">
                  {['sent', 'delivered', 'opened', 'clicked'].includes(deliveryState) && (
                    <Badge className={deliveryState === 'opened' || deliveryState === 'clicked' ? 'bg-violet-600 hover:bg-violet-600' : deliveryState === 'delivered' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
                      {deliveryLabel[providerStatus] || deliveryLabel[deliveryState] || 'Enviado'}{statusTimestamp ? ` · ${formatSentAt(statusTimestamp)}` : ''}
                    </Badge>
                  )}
                  {deliveryState === 'queued' && <Badge variant="secondary">Na fila</Badge>}
                  {deliveryState === 'failed' && <Badge variant="destructive">{latestConfirmation?.status === 'failed_missing_recipient' ? 'Sem e-mail' : deliveryLabel[providerStatus] || 'Falhou'}</Badge>}
                  {deliveryState === 'not_sent' && <Badge variant="outline">Não enviado</Badge>}
                  {latestByLink.get(linkId) && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground" title={communicationTypeLabel[latestByLink.get(linkId)?.communication_type] || latestByLink.get(linkId)?.communication_type}>
                      <span className="font-medium text-foreground/70">Tipo:</span> {communicationTypeLabel[latestByLink.get(linkId)?.communication_type] || latestByLink.get(linkId)?.communication_type || 'E-mail'}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{link.email || <span className="text-destructive">Sem e-mail</span>}</p>
                </td>
                <td className="py-3 pr-3">
                  {getPsContactPhone(link) ? (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => void copyPhone(link)} title="Copiar celular">
                      <Phone className="mr-1 h-3.5 w-3.5" />{getPsContactPhone(link)}<Copy className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">Não informado</span>}
                </td>
                <td className="py-3 pr-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Ações de ${link.collaborator_name}`}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-60"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {onEditMember && <DropdownMenuItem onSelect={() => onEditMember(link)}><Pencil className="mr-2 h-4 w-4" />Editar fiscal</DropdownMenuItem>}
                      {onEvaluateMember && <DropdownMenuItem onSelect={() => onEvaluateMember(link)}><Star className="mr-2 h-4 w-4" />Avaliar fiscal</DropdownMenuItem>}
                      {['pending_confirmation', 'declined'].includes(link.participation_status) && (
                        <>
                          <DropdownMenuItem disabled={requestingConfirmation} onSelect={() => onRequestConfirmation(link)}>{link.participation_status === 'declined' ? 'Revalidar participação' : (link.public_confirmation_token_hash ? 'Gerar novo link' : 'Gerar link')}</DropdownMenuItem>
                          <DropdownMenuItem disabled={requestingConfirmation} onSelect={() => onCopyConfirmationMessage(link)}>Copiar mensagem + link</DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => openMessage('event_message', link.id)}>Enviar mensagem por e-mail</DropdownMenuItem>
                      {link.participation_status !== 'replaced' && <DropdownMenuItem onSelect={() => onReplace(link)}>Substituir fiscal</DropdownMenuItem>}
                      {onRemoveMember && <DropdownMenuItem onSelect={() => onRemoveMember(link)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir deste evento</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
        {!filtered.length && <p className="p-4 text-muted-foreground">Nenhum fiscal corresponde aos filtros.</p>}
      </CardContent>
    </Card>

    {excludedLinks.length > 0 && (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Excluídos deste evento ({excludedLinks.length})</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Esses fiscais permanecem no histórico e não serão recolocados por novas importações. Você pode reincluí-los quando necessário.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {excludedLinks.map((link: any) => (
            <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{link.collaborator_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[link.role_name || link.assigned_role, link.building, link.floor && (link.floor + 'º andar'), link.room && ('Sala ' + link.room)].filter(Boolean).join(' · ') || 'Sem localização'}
                </p>
                {link.manual_exclusion_reason && <p className="mt-1 text-[11px] text-muted-foreground">{link.manual_exclusion_reason}</p>}
              </div>
              {onReincludeMember && (
                <Button size="sm" variant="outline" onClick={() => onReincludeMember(link)}>
                  Reincluir no evento
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    )}

    {inactiveLinks.length > 0 && (
      <Card className="border-slate-500/20 bg-slate-500/[0.04]">
        <CardHeader>
          <CardTitle className="text-base">Inativos no banco de fiscais ({inactiveLinks.length})</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Esses vínculos permanecem auditáveis, mas não entram nas contagens, comunicações, presença, pagamentos ou avaliações.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {inactiveLinks.map((link: any) => (
            <div key={link.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{link.collaborator_name}</p>
                  <Badge variant="outline" className="text-[9px]">Cadastro inativo</Badge>
                  {link.participation_status && (
                    <Badge variant="secondary" className="text-[9px]">
                      {getPsConfirmationStatusLabel(link.participation_status)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[link.role_name || link.assigned_role, link.building, link.floor && (link.floor + 'º andar'), link.room && ('Sala ' + link.room)]
                    .filter(Boolean)
                    .join(' · ') || 'Sem localização'}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {link.participation_status !== 'replaced' && (
                  <Button size="sm" variant="outline" onClick={() => onReplace(link)}>
                    Substituir fiscal
                  </Button>
                )}
                {onRemoveMember && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onRemoveMember(link)}
                  >
                    Excluir deste evento
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )}

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Histórico de envios</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{history.length} comunicação(ões) registrada(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen((prev) => !prev)}>
          {historyOpen ? 'Ocultar histórico' : `Ver histórico (${history.length})`}
        </Button>
      </CardHeader>
      {historyOpen && (
        <CardContent className="space-y-2">
          {history.slice(0, 20).map((job: any) => (
            <div key={job.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
              <span>{links.find((link) => link.id === job.event_collaborator_id)?.collaborator_name || 'Fiscal'} · {communicationTypeLabel[job.communication_type] || job.communication_type}</span>
              <span>{deliveryLabel[job.delivery_status] || statusLabel[job.status] || job.status}{job.provider_last_event_at ? ` · ${formatSentAt(job.provider_last_event_at)}` : ''} · tentativa {job.attempt_count}</span>
            </div>
          ))}
          {!history.length && <p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>}
          {history.length > 20 && <p className="pt-2 text-xs text-muted-foreground">Exibindo os 20 envios mais recentes.</p>}
        </CardContent>
      )}
    </Card>

    {backgroundProgress && !backgroundHidden && (
      <div className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-5xl rounded-2xl border border-violet-400/20 bg-gradient-to-r from-background/98 via-background/96 to-violet-950/30 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{backgroundProgress.completed ? 'Envio concluído' : backgroundProgress.error ? 'Processamento interrompido' : backgroundProgress.quotaWaiting > 0 ? 'Aguardando cota do provedor' : 'Enviando e-mails...'}</p>
                <p className="text-xs text-muted-foreground">
                  {backgroundProgress.sent} de {backgroundProgress.total} enviados
                  {backgroundProgress.failed ? ` · ${backgroundProgress.failed} falharam` : ''}
                  {backgroundProgress.missingRecipient ? ` · ${backgroundProgress.missingRecipient} sem e-mail` : ''}
                  {backgroundProgress.quotaWaiting ? ` · ${backgroundProgress.quotaWaiting} aguardando cota` : ''}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setBackgroundHidden(true)}>Ocultar</Button>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/60">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, ((backgroundProgress.sent + backgroundProgress.failed + backgroundProgress.missingRecipient) / Math.max(1, backgroundProgress.total)) * 100))}%` }} />
            </div>
            {backgroundProgress.error && <p className="mt-1 text-[11px] text-destructive">{backgroundProgress.error}</p>}
          </div>
        </div>
      </div>
    )}

    <Dialog open={typeDialog} onOpenChange={setTypeDialog}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha o tipo de comunicação</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Você selecionou {selected.length} pessoa(s). Escolha o objetivo do envio antes de editar a mensagem.
          </p>
        </DialogHeader>

        <div className="grid gap-3 py-2 md:grid-cols-2">
          <button
            type="button"
            className="group rounded-2xl border border-border/70 bg-card/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.035] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => openMessage('event_message')}
            disabled={!operationalSelected.length}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-5 w-5" />
              </div>
              <Badge variant="secondary" className="rounded-full">
                {operationalSelected.length} destinatário(s)
              </Badge>
            </div>
            <p className="mt-4 text-sm font-semibold">Mensagem geral do evento</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Envie orientações, avisos ou informações operacionais para confirmados e pessoas que ainda aguardam confirmação.
            </p>
            {selectedInactive.length > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                {selectedInactive.length} recusado(s) ou substituído(s) serão ignorados.
              </p>
            )}
          </button>

          <button
            type="button"
            className="group rounded-2xl border border-border/70 bg-card/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.035] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => openMessage('confirmation_request')}
            disabled={!pendingConfirmationSelected.length}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="rounded-full border-amber-500/20 text-amber-500">
                {pendingConfirmationSelected.length} aguardando
              </Badge>
            </div>
            <p className="mt-4 text-sm font-semibold">Solicitação de confirmação</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Envia o link individual para quem ainda precisa confirmar a participação no processo seletivo.
            </p>
            {selectedAlreadySent.length > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                {selectedAlreadySent.length} já receberam uma solicitação e serão protegidos contra duplicidade por padrão.
              </p>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-[11px] leading-relaxed text-muted-foreground">
          A remarcação de treinamento continua sendo enviada automaticamente pelo módulo de Treinamentos, pois depende de uma sessão cancelada e de um link específico de nova escolha.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setTypeDialog(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-[1120px]">
        <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Revisar comunicação</DialogTitle>
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
              {type === 'confirmation_request' ? 'Solicitação de confirmação' : 'Mensagem geral do evento'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Edite o conteúdo e confira exatamente como a mensagem ficará antes de confirmar o envio.
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-border/60 p-5 lg:border-b-0 lg:border-r">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Destinatários</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{effectiveSelected.length}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{selected.length} selecionado(s)</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Modo</p>
                <p className="mt-1 text-sm font-bold">{config?.mode === 'test' ? 'TESTE' : 'PRODUÇÃO'}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{canSend ? 'Envio habilitado' : 'Configuração incompleta'}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Exemplo</p>
                <p className="mt-1 truncate text-sm font-semibold">{previewLink?.collaborator_name || 'Sem destinatário'}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{previewLink?.email || 'Sem e-mail'}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {type === 'confirmation_request' && selectedAlreadySent.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
                  <p className="font-medium">
                    {selectedAlreadySent.length} pessoa(s) já receberam esta solicitação.
                  </p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allowConfirmationResend}
                      onCheckedChange={(checked) => setAllowConfirmationResend(checked === true)}
                    />
                    Incluir também quem já recebeu a solicitação
                  </label>
                </div>
              )}

              {type === 'confirmation_request' && selectedNotPendingConfirmation.length > 0 && (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.055] p-3 text-xs leading-relaxed">
                  <strong>{selectedNotPendingConfirmation.length} pessoa(s) não receberão este tipo de comunicação.</strong>
                  <span className="mt-1 block text-muted-foreground">
                    Já confirmados, recusados ou substituídos são removidos automaticamente da solicitação de confirmação.
                  </span>
                </div>
              )}

              {type !== 'confirmation_request' && selectedInactive.length > 0 && (
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.055] p-3 text-xs">
                  <strong>{selectedInactive.length} pessoa(s) recusadas ou substituídas serão ignoradas.</strong>
                </div>
              )}

              {config?.mode === 'test' && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs leading-relaxed">
                  <strong>MODO TESTE.</strong>{' '}
                  Os e-mails não serão enviados aos fiscais reais. Nesta execução, no máximo {config.testBatchLimit} serão processados.
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="communication-subject">Assunto</Label>
                <Input
                  id="communication-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Variáveis disponíveis</Label>
                  <span className="text-[10px] text-muted-foreground">Clique para inserir no texto</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_CHIPS.filter((chip) => !chip.confirmationOnly || type === 'confirmation_request').map((chip) => (
                    <Button
                      key={chip.token}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg px-2 text-xs"
                      onClick={() => insertVariable(chip.token)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="communication-template">Mensagem</Label>
                <Textarea
                  id="communication-template"
                  ref={templateRef}
                  rows={15}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="min-h-[340px] resize-y rounded-xl font-mono text-sm leading-relaxed"
                />
              </div>

              {result && (
                <div className="rounded-xl border p-3 text-xs">
                  Total: {result.total || 0} · Enviados: {result.sent || 0} · Falharam: {result.failed || 0} · Sem e-mail: {result.missingRecipient || 0} · Aguardando: {result.pending || 0} · Aguardando cota diária: {result.quotaWaiting || 0}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-muted/[0.08] p-5">
            <div className="lg:sticky lg:top-0">
              <div className="mb-3">
                <p className="text-sm font-semibold">Prévia do e-mail</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Exemplo renderizado com os dados de {previewLink?.collaborator_name || 'um destinatário selecionado'}.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
                <div className="space-y-2 border-b border-border/60 bg-muted/20 px-4 py-3 text-xs">
                  <div className="grid grid-cols-[58px_1fr] gap-2">
                    <span className="text-muted-foreground">Para</span>
                    <span className="truncate font-medium">{previewLink?.email || 'Destinatário sem e-mail'}</span>
                  </div>
                  <div className="grid grid-cols-[58px_1fr] gap-2">
                    <span className="text-muted-foreground">Assunto</span>
                    <span className="font-semibold">{previewSubject || 'Sem assunto'}</span>
                  </div>
                </div>

                <div className="max-h-[55vh] min-h-[360px] overflow-y-auto p-5">
                  <div className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {preview || 'Selecione um destinatário válido para visualizar o exemplo renderizado.'}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border/60 bg-background/50 p-3 text-[10px] leading-relaxed text-muted-foreground">
                As variáveis como nome, cargo, prédio, sala e horário são renderizadas individualmente para cada destinatário no momento do envio.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-background/95 px-5 py-3">
          <Button
            variant="ghost"
            onClick={() => {
              setDialog(false);
              setTypeDialog(true);
            }}
          >
            Trocar tipo
          </Button>
          <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!canSend || !effectiveSelected.length || send.isPending}
            className="min-w-36"
          >
            {send.isPending ? 'Processando...' : `Enviar para ${effectiveSelected.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
