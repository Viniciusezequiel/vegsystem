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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  usePsCommunicationConfig,
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

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  waiting_provider_quota: 'Aguardando cota diária',
  processing: 'Processando',
  sent: 'Enviado',
  failed: 'Falhou',
  failed_missing_recipient: 'Sem e-mail',
  cancelled: 'Cancelado',
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

type ConfirmationDeliveryState = 'not_sent' | 'sent' | 'failed' | 'queued';

const queuedStatuses = new Set(['pending', 'waiting_provider_quota', 'processing']);
const failedStatuses = new Set(['failed', 'failed_missing_recipient']);

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

export function PsEventCommunicationTab({ event, links }: { event: any; links: any[] }) {
  const { data: history = [] } = usePsEventCommunications(event?.id);
  const { data: config, error: configError } = usePsCommunicationConfig(event?.id);
  const send = usePsSendEventCommunication();
  const retry = usePsRetryEventCommunications();
  const processQueue = usePsProcessEventCommunicationQueue();

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [roles, setRoles] = useState<string[]>([]);
  const [unit, setUnit] = useState('all');
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
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const roleOptions = useMemo(
    () => [...new Set(links.map((link) => link.role_name || link.assigned_role || 'Sem função'))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
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
      if (sent.has(linkId)) {
        state.set(linkId, 'sent');
        continue;
      }
      const job = latest.get(linkId);
      if (!job || job.status === 'cancelled') state.set(linkId, 'not_sent');
      else if (failedStatuses.has(job.status)) state.set(linkId, 'failed');
      else if (queuedStatuses.has(job.status)) state.set(linkId, 'queued');
      else state.set(linkId, 'not_sent');
    }

    return { latest, sent, state };
  }, [history, links]);

  const filtered = useMemo(() => {
    const base = filterPsCommunicationRecipients(links, { search, status, unit, room });
    return base.filter((link: any) => {
      const roleName = link.role_name || link.assigned_role || 'Sem função';
      if (roles.length && !roles.includes(roleName)) return false;
      if (delivery !== 'all' && confirmationDelivery.state.get(String(link.id)) !== delivery) return false;
      return true;
    });
  }, [links, search, status, unit, room, roles, delivery, confirmationDelivery]);

  const selectedAlreadySent = useMemo(
    () => selected.filter((id) => confirmationDelivery.sent.has(id)),
    [selected, confirmationDelivery],
  );
  const selectedNotPreviouslySent = useMemo(
    () => selected.filter((id) => !confirmationDelivery.sent.has(id)),
    [selected, confirmationDelivery],
  );
  const effectiveSelected = type === 'confirmation_request' && !allowConfirmationResend
    ? selectedNotPreviouslySent
    : selected;

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

    const totalResult = {
      ...first,
      sent: Number(first.sent || 0),
      failed: Number(first.failed || 0),
      missingRecipient: Number(first.missingRecipient || 0),
      quotaWaiting: Number(first.quotaWaiting || 0),
      pending: Number(first.pending || 0),
    };

    setResult(totalResult);

    const batchSize = Math.max(1, Number(config?.batchLimit || 5));
    const extraRuns = Math.ceil(Number(first.pending || 0) / batchSize);

    for (let i = 0; i < extraRuns; i += 1) {
      if (totalResult.quotaWaiting > 0) break;

      const next = await processQueue.mutateAsync({ eventId: event.id, silent: true });
      totalResult.sent += Number(next.sent || 0);
      totalResult.failed += Number(next.failed || 0);
      totalResult.missingRecipient += Number(next.missingRecipient || 0);
      totalResult.quotaWaiting += Number(next.quotaWaiting || 0);
      totalResult.pending = Math.max(
        0,
        Number(first.total || recipients.length)
          - totalResult.sent
          - totalResult.failed
          - totalResult.missingRecipient
          - totalResult.quotaWaiting,
      );
      setResult({ ...totalResult });
      if (Number(next.total || 0) === 0) break;
    }

    setResult({ ...totalResult });
    if (
      totalResult.pending === 0
      && totalResult.quotaWaiting === 0
      && totalResult.failed === 0
      && totalResult.missingRecipient === 0
    ) {
      setDialog(false);
      setSelected([]);
    }
  };

  const failedJobs = history.filter(
    (job: any) => ['failed', 'failed_missing_recipient'].includes(job.status) && selected.includes(job.event_collaborator_id),
  );
  const quotaWaiting = history.filter((job: any) => job.status === 'waiting_provider_quota').length;

  const selectAllFiltered = () => setSelected((current) => [...new Set([...current, ...filtered.map((link: any) => link.id)])]);
  const selectUnsentFiltered = () => setSelected((current) => [
    ...new Set([
      ...current,
      ...filtered
        .filter((link: any) => confirmationDelivery.state.get(String(link.id)) === 'not_sent')
        .map((link: any) => link.id),
    ]),
  ]);

  return <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Comunicação</h2>
      <p className="text-sm text-muted-foreground">Envie mensagens e solicitações de confirmação aos fiscais deste evento.</p>
    </div>

    <div className={`rounded-xl border p-3 text-sm ${config?.mode === 'test' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'bg-muted/30'}`}>
      {config?.mode === 'test'
        ? <strong>TEST MODE: os e-mails NÃO serão enviados aos fiscais reais.</strong>
        : configError
          ? 'Backend de e-mail ainda não publicado/configurado.'
          : config?.mode === 'production'
            ? 'Modo Produção'
            : 'Verificando configuração do provider...'}
      {config && !config.providerConfigured && <span> Provider pendente de configuração.</span>}
      {config?.mode === 'test' && !config.testRecipientConfigured && <span> PS_EMAIL_TEST_RECIPIENT ausente; envios bloqueados.</span>}
      {config && <span className="ml-2">Provider: {String(config.provider || 'brevo').toUpperCase()} · Limite configurado: {config.dailyLimit}/dia · lote técnico: {config.batchLimit}</span>}
    </div>

    {quotaWaiting > 0 && <p className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">{quotaWaiting} mensagens aguardando a renovação da cota diária do provedor.</p>}

    <div className="grid gap-2 lg:grid-cols-6">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" />

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {['pending_confirmation', 'confirmed', 'declined', 'replaced'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between font-normal">
            {roles.length === 0 ? 'Todos: Cargo' : roles.length === 1 ? roles[0] : `${roles.length} cargos selecionados`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 w-[320px] overflow-y-auto" align="start">
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

      <Select value={unit} onValueChange={setUnit}>
        <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos: Unidade</SelectItem>
          {[...new Set(links.map((link) => link.unit || 'Sem unidade'))].map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
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
          <SelectItem value="failed">Falhou</SelectItem>
          <SelectItem value="queued">Na fila</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={selectAllFiltered}>Selecionar todos filtrados</Button>
      <Button variant="outline" onClick={selectUnsentFiltered}>Selecionar não enviados filtrados</Button>
      <Button variant="outline" onClick={() => setSelected([])}>Limpar seleção</Button>
      <Button onClick={() => openMessage('event_message')} disabled={!selected.length}>Nova mensagem</Button>
      <Button onClick={() => openMessage('confirmation_request')} disabled={!selected.length}>Solicitar confirmação</Button>
      <Button
        variant="outline"
        disabled={!failedJobs.length || retry.isPending}
        onClick={() => retry.mutate({ eventId: event.id, jobIds: failedJobs.map((job: any) => job.id) })}
      >
        Reenviar falhas
      </Button>
      <Button
        variant="outline"
        disabled={!canSend || processQueue.isPending}
        onClick={() => processQueue.mutate({ eventId: event.id })}
      >
        Processar fila
      </Button>
      <strong className="ml-auto text-sm">{selected.length} destinatários selecionados</strong>
    </div>

    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3" />
              <th>Nome</th>
              <th>Cargo</th>
              <th>Unidade/Sala</th>
              <th>Confirmação</th>
              <th>E-mail</th>
              <th>E-mail de confirmação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((link: any) => {
              const linkId = String(link.id);
              const deliveryState = confirmationDelivery.state.get(linkId) || 'not_sent';
              const sentJob = confirmationDelivery.sent.get(linkId);
              const latestConfirmation = confirmationDelivery.latest.get(linkId);
              return <tr key={link.id} className="border-b">
                <td className="p-3">
                  <Checkbox
                    checked={selected.includes(link.id)}
                    onCheckedChange={(checked) => setSelected(checked
                      ? [...selected, link.id]
                      : selected.filter((id) => id !== link.id))}
                  />
                </td>
                <td>{link.collaborator_name}</td>
                <td>{link.role_name || link.assigned_role || '—'}</td>
                <td>{link.unit || '—'} / {link.room || '—'}</td>
                <td><Badge variant="outline">{link.participation_status}</Badge></td>
                <td>{link.email || <span className="text-destructive">Sem e-mail</span>}</td>
                <td>
                  {deliveryState === 'sent' && <Badge>Enviado{sentJob?.sent_at ? ` · ${formatSentAt(sentJob.sent_at)}` : ''}</Badge>}
                  {deliveryState === 'queued' && <Badge variant="secondary">Na fila</Badge>}
                  {deliveryState === 'failed' && <Badge variant="destructive">{latestConfirmation?.status === 'failed_missing_recipient' ? 'Sem e-mail' : 'Falhou'}</Badge>}
                  {deliveryState === 'not_sent' && <Badge variant="outline">Não enviado</Badge>}
                </td>
                <td><Button size="sm" variant="ghost" onClick={() => openMessage('event_message', link.id)}>Mensagem</Button></td>
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
              <span>{links.find((link) => link.id === job.event_collaborator_id)?.collaborator_name || 'Fiscal'} · {job.communication_type}</span>
              <span>{statusLabel[job.status] || job.status} · tentativa {job.attempt_count}</span>
            </div>
          ))}
          {!history.length && <p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>}
          {history.length > 20 && <p className="pt-2 text-xs text-muted-foreground">Exibindo os 20 envios mais recentes.</p>}
        </CardContent>
      )}
    </Card>

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
