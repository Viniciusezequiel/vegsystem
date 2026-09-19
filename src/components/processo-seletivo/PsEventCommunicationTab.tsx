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
import { ChevronDown, Copy, Download, FileSpreadsheet, FileText, MoreHorizontal, Phone, Send } from 'lucide-react';
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
  onRequestConfirmation: (link: any) => void;
  onCopyConfirmationMessage: (link: any) => void;
  onReplace: (link: any) => void;
  onExportFiltered: (rows: any[], format: 'pdf' | 'excel', filters: string[]) => void;
  requestingConfirmation?: boolean;
};

export function PsEventCommunicationTab({
  event,
  links,
  onRequestConfirmation,
  onCopyConfirmationMessage,
  onReplace,
  onExportFiltered,
  requestingConfirmation = false,
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

  const filtered = useMemo(() => {
    const base = filterPsCommunicationRecipients(links, { search, status, unit: 'all', room });
    return base.filter((link: any) => {
      const roleName = link.role_name || link.assigned_role || 'Sem função';
      if (roles.length && !roles.includes(roleName)) return false;
      if (building !== 'all' && normalizePsLocation(link.building, { building: true }) !== building) return false;
      if (delivery !== 'all' && confirmationDelivery.state.get(String(link.id)) !== delivery) return false;
      return true;
    });
  }, [links, search, status, building, room, roles, delivery, confirmationDelivery]);

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
    setType(nextType);
    setAllowConfirmationResend(false);
    setSubject(nextType === 'confirmation_request' ? DEFAULT_CONFIRMATION_SUBJECT : DEFAULT_EVENT_MESSAGE_SUBJECT);
    setTemplate(nextType === 'confirmation_request' ? DEFAULT_CONFIRMATION_TEMPLATE : DEFAULT_EVENT_MESSAGE_TEMPLATE);
    setRequestKey(crypto.randomUUID());
    setResult(null);
    setDialog(true);
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
    search.trim() ? `Busca: ${search.trim()}` : '',
    status !== 'all' ? `Situação: ${getPsConfirmationStatusLabel(status)}` : '',
    roles.length ? `Cargo(s): ${roles.join(', ')}` : '',
    building !== 'all' ? `Prédio: ${building}` : '',
    room !== 'all' ? `Sala: ${room}` : '',
    delivery !== 'all' ? `Envio: ${deliveryLabel[delivery] || delivery}` : '',
  ].filter(Boolean);

  const copyPhone = async (link: any) => {
    const phone = getPsContactPhone(link);
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    toast.success('Celular copiado.');
  };

  return <div className="space-y-3">
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.10] via-indigo-500/[0.06] to-transparent px-4 py-3 shadow-[0_0_35px_rgba(124,58,237,0.08)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Comunicação</h2>
          <p className="text-xs text-muted-foreground">Mensagens, confirmações e acompanhamento dos envios.</p>
        </div>
        <span className="hidden rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-violet-200 sm:inline-flex">Produção</span>
      </div>
    </div>

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

    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card/70 via-card/45 to-violet-500/[0.035] p-2 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-500/15 bg-gradient-to-r from-card/70 via-card/50 to-violet-500/[0.035] p-2 shadow-sm">
      <Button variant="outline" size="sm" onClick={selectAllFiltered}>Selecionar filtrados</Button>
      <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={!selected.length}>Limpar seleção</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={!selected.length} className="ps-gradient-button">
            <Send className="mr-2 h-4 w-4" />Enviar comunicação<ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuItem onSelect={() => openMessage('event_message')}>Nova mensagem por e-mail</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openMessage('confirmation_request')}>Solicitar confirmação</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Ações de ${link.collaborator_name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-56">
                      {['pending_confirmation', 'declined'].includes(link.participation_status) && (
                        <>
                          <DropdownMenuItem disabled={requestingConfirmation} onSelect={() => onRequestConfirmation(link)}>{link.public_confirmation_token_expires_at ? 'Gerar novo link' : 'Gerar link'}</DropdownMenuItem>
                          <DropdownMenuItem disabled={requestingConfirmation} onSelect={() => onCopyConfirmationMessage(link)}>Copiar mensagem + link</DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => openMessage('event_message', link.id)}>Enviar mensagem por e-mail</DropdownMenuItem>
                      {link.participation_status !== 'replaced' && <DropdownMenuItem onSelect={() => onReplace(link)}>Substituir fiscal</DropdownMenuItem>}
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

    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Prévia do envio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Tipo</Label><p>{type === 'confirmation_request' ? 'Solicitação de confirmação' : 'Mensagem geral do evento'}</p></div>
          <div><Label>Destinatários</Label><p>{effectiveSelected.length}</p></div>
          {type === 'confirmation_request' && selectedAlreadySent.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">{selectedAlreadySent.length} pessoa(s) selecionada(s) já receberam esta solicitação e serão ignoradas para evitar envio duplicado.</p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-muted-foreground">
                <Checkbox checked={allowConfirmationResend} onCheckedChange={(checked) => setAllowConfirmationResend(checked === true)} />
                Incluir pessoas que já receberam a confirmação
              </label>
            </div>
          )}
          {type === 'confirmation_request' && selectedNotPendingConfirmation.length > 0 && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
              <p className="font-medium">
                {selectedNotPendingConfirmation.length} pessoa(s) não estão aguardando confirmação e não receberão esta solicitação.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Já confirmados, recusados ou substituídos são retirados automaticamente deste envio.
              </p>
            </div>
          )}
          {type !== 'confirmation_request' && selectedInactive.length > 0 && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
              <p className="font-medium">
                {selectedInactive.length} pessoa(s) recusadas ou substituídas serão ignoradas neste envio.
              </p>
            </div>
          )}
          <div><Label>Modo</Label><p className="font-semibold">{config?.mode === 'test' ? 'TESTE' : 'PRODUÇÃO'}</p></div>
          {config?.mode === 'test' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Os e-mails NÃO serão enviados aos fiscais reais. Nesta execução, no máximo {config.testBatchLimit} serão processados.</p>}
          <div><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div>
            <Label>Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {VARIABLE_CHIPS.filter((chip) => !chip.confirmationOnly || type === 'confirmation_request').map((chip) => (
                <Button key={chip.token} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => insertVariable(chip.token)}>{chip.label}</Button>
              ))}
            </div>
          </div>
          <div><Label>Mensagem</Label><Textarea ref={templateRef} rows={12} value={template} onChange={(e) => setTemplate(e.target.value)} /></div>
          <div>
            <Label>Exemplo renderizado</Label>
            <p className="text-xs text-muted-foreground">Assunto: {previewSubject || 'Selecione um destinatário.'}</p>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-xs">{preview || 'Selecione um destinatário.'}</pre>
          </div>
          {result && <div className="rounded-lg border p-3 text-sm">Total: {result.total || 0} · Enviados: {result.sent || 0} · Falharam: {result.failed || 0} · Sem e-mail: {result.missingRecipient || 0} · Aguardando: {result.pending || 0} · Aguardando cota diária: {result.quotaWaiting || 0}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialog(false)}>Fechar</Button>
          <Button onClick={submit} disabled={!canSend || !effectiveSelected.length || send.isPending}>{send.isPending ? 'Processando...' : 'Confirmar envio'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
