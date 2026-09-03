import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsCommunicationConfig, usePsEventCommunications, usePsProcessEventCommunicationQueue, usePsRetryEventCommunications, usePsSendEventCommunication } from '@/hooks/useProcessoSeletivo';
import {
  DEFAULT_CONFIRMATION_SUBJECT, DEFAULT_CONFIRMATION_TEMPLATE, DEFAULT_EVENT_MESSAGE_SUBJECT, DEFAULT_EVENT_MESSAGE_TEMPLATE,
  filterPsCommunicationRecipients, formatPsEventDateBR, renderPsCommunicationTemplate,
} from '@/lib/psCommunicationCore.mjs';

const statusLabel:Record<string,string>={pending:'Pendente',waiting_provider_quota:'Aguardando cota diária',processing:'Processando',sent:'Enviado',failed:'Falhou',failed_missing_recipient:'Sem e-mail',cancelled:'Cancelado'};
const VARIABLE_CHIPS:{label:string;token:string;confirmationOnly?:boolean}[]=[
  {label:'Nome',token:'nome'},{label:'Evento',token:'evento'},{label:'Data',token:'data_evento'},{label:'Cargo',token:'cargo'},
  {label:'Campus',token:'campus'},{label:'Unidade',token:'unidade'},{label:'Prédio',token:'predio'},{label:'Andar',token:'andar'},
  {label:'Sala',token:'sala'},{label:'Horário',token:'horario'},{label:'Link de confirmação',token:'link_confirmacao',confirmationOnly:true},
];

export function PsEventCommunicationTab({ event, links }: { event:any; links:any[] }) {
  const { data: history=[] }=usePsEventCommunications(event?.id);
  const { data: config, error:configError }=usePsCommunicationConfig(event?.id);
  const send=usePsSendEventCommunication(); const retry=usePsRetryEventCommunications(); const processQueue=usePsProcessEventCommunicationQueue();
  const [selected,setSelected]=useState<string[]>([]); const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all'); const [role,setRole]=useState('all'); const [unit,setUnit]=useState('all'); const [room,setRoom]=useState('all');
  const [dialog,setDialog]=useState(false); const [type,setType]=useState('confirmation_request');
  const [subject,setSubject]=useState(DEFAULT_CONFIRMATION_SUBJECT); const [template,setTemplate]=useState(DEFAULT_CONFIRMATION_TEMPLATE);
  const [requestKey,setRequestKey]=useState(''); const [result,setResult]=useState<any>(null);
  const templateRef=useRef<HTMLTextAreaElement>(null);
  const filtered=useMemo(()=>filterPsCommunicationRecipients(links,{search,status,role,unit,room}),[links,search,status,role,unit,room]);
  const latestByLink=useMemo(()=>{const map=new Map();for(const job of history)if(!map.has(job.event_collaborator_id))map.set(job.event_collaborator_id,job);return map;},[history]);
  const previewLink=links.find(link=>selected.includes(link.id));
  const previewValues={
    nome:previewLink?.collaborator_name,evento:event?.name,cargo:previewLink?.role_name||previewLink?.assigned_role,
    campus:previewLink?.campus,unidade:previewLink?.unit,instituicao:previewLink?.institution,setor:previewLink?.sector,
    predio:previewLink?.building,andar:previewLink?.floor,sala:previewLink?.room,horario:previewLink?.work_schedule,
    data_evento:formatPsEventDateBR(event?.date),local_evento:event?.location,descricao_evento:event?.description,
    coordenador_evento:event?.coordinator_name,link_confirmacao:'https://www.vegsystem.site/ps/confirmacao/…',
  };
  const preview=previewLink?renderPsCommunicationTemplate(template,previewValues):'';
  const previewSubject=previewLink?renderPsCommunicationTemplate(subject,previewValues):subject;
  const canSend=!!config?.providerConfigured&&(config.mode!=='test'||config.testRecipientConfigured);
  const openMessage=(nextType:string,onlyId?:string)=>{if(onlyId)setSelected([onlyId]);setType(nextType);setSubject(nextType==='confirmation_request'?DEFAULT_CONFIRMATION_SUBJECT:DEFAULT_EVENT_MESSAGE_SUBJECT);setTemplate(nextType==='confirmation_request'?DEFAULT_CONFIRMATION_TEMPLATE:DEFAULT_EVENT_MESSAGE_TEMPLATE);setRequestKey(crypto.randomUUID());setResult(null);setDialog(true);};
  const insertVariable=(token:string)=>{
    const el=templateRef.current; const chip=`{{${token}}}`;
    if(!el){setTemplate(prev=>`${prev}${chip}`);return;}
    const start=el.selectionStart??template.length; const end=el.selectionEnd??template.length;
    const next=`${template.slice(0,start)}${chip}${template.slice(end)}`;
    setTemplate(next);
    requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+chip.length,start+chip.length);});
  };
  const submit=async()=>{const data=await send.mutateAsync({eventId:event.id,eventCollaboratorIds:selected,communicationType:type,subject,template,requestKey});setResult(data);};
  const failedJobs=history.filter((job:any)=>['failed','failed_missing_recipient'].includes(job.status)&&selected.includes(job.event_collaborator_id));
  const quotaWaiting=history.filter((job:any)=>job.status==='waiting_provider_quota').length;
  return <div className="space-y-4">
    <div><h2 className="text-lg font-semibold">Comunicação</h2><p className="text-sm text-muted-foreground">Envie mensagens e solicitações de confirmação aos fiscais deste evento.</p></div>
    <div className={`rounded-xl border p-3 text-sm ${config?.mode==='test'?'border-amber-400 bg-amber-50 text-amber-900':'bg-muted/30'}`}>
      {config?.mode==='test'?<strong>TEST MODE: os e-mails NÃO serão enviados aos fiscais reais.</strong>:configError?'Backend de e-mail ainda não publicado/configurado.':config?.mode==='production'?'Modo Produção':'Verificando configuração do provider...'}
      {config&&!config.providerConfigured&&<span> Provider pendente de configuração.</span>}{config?.mode==='test'&&!config.testRecipientConfigured&&<span> PS_EMAIL_TEST_RECIPIENT ausente; envios bloqueados.</span>}
      {config&&<span className="ml-2">Provider: {String(config.provider||'brevo').toUpperCase()} · Limite configurado: {config.dailyLimit}/dia · lote técnico: {config.batchLimit}</span>}
    </div>
    {quotaWaiting>0&&<p className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">{quotaWaiting} mensagens aguardando a renovação da cota diária do provedor.</p>}
    <div className="grid gap-2 md:grid-cols-5"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome" />
      <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{['pending_confirmation','confirmed','declined','replaced'].map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      {[['Cargo',role,setRole,[...new Set(links.map(l=>l.role_name||l.assigned_role||'Sem função'))]],['Unidade',unit,setUnit,[...new Set(links.map(l=>l.unit||'Sem unidade'))]],['Sala',room,setRoom,[...new Set(links.map(l=>l.room||'Sem sala'))]]].map(([label,value,setValue,options]:any)=><Select key={label} value={value} onValueChange={setValue}><SelectTrigger><SelectValue placeholder={label}/></SelectTrigger><SelectContent><SelectItem value="all">Todos: {label}</SelectItem>{options.map((option:string)=><SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>)}
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={()=>setSelected([...new Set([...selected,...filtered.map((l:any)=>l.id)])])}>Selecionar todos filtrados</Button><Button variant="outline" onClick={()=>setSelected([])}>Limpar seleção</Button><Button onClick={()=>openMessage('event_message')} disabled={!selected.length}>Nova mensagem</Button><Button onClick={()=>openMessage('confirmation_request')} disabled={!selected.length}>Solicitar confirmação</Button><Button variant="outline" disabled={!failedJobs.length||retry.isPending} onClick={()=>retry.mutate({eventId:event.id,jobIds:failedJobs.map((job:any)=>job.id)})}>Reenviar falhas</Button><Button variant="outline" disabled={!canSend||processQueue.isPending} onClick={()=>processQueue.mutate({eventId:event.id})}>Processar fila</Button><strong className="ml-auto text-sm">{selected.length} destinatários selecionados</strong></div>
    <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3"></th><th>Nome</th><th>Cargo</th><th>Unidade/Sala</th><th>Confirmação</th><th>E-mail</th><th>Último envio</th><th></th></tr></thead><tbody>{filtered.map((link:any)=>{const last=latestByLink.get(link.id);return <tr key={link.id} className="border-b"><td className="p-3"><Checkbox checked={selected.includes(link.id)} onCheckedChange={checked=>setSelected(checked?[...selected,link.id]:selected.filter(id=>id!==link.id))}/></td><td>{link.collaborator_name}</td><td>{link.role_name||link.assigned_role||'—'}</td><td>{link.unit||'—'} / {link.room||'—'}</td><td><Badge variant="outline">{link.participation_status}</Badge></td><td>{link.email||<span className="text-destructive">Sem e-mail</span>}</td><td>{last?<Badge variant={last.status==='sent'?'default':last.status==='failed'?'destructive':'secondary'}>{statusLabel[last.status]||last.status}</Badge>:'—'}</td><td><Button size="sm" variant="ghost" onClick={()=>openMessage('event_message',link.id)}>Mensagem</Button></td></tr>})}</tbody></table>{!filtered.length&&<p className="p-4 text-muted-foreground">Nenhum fiscal corresponde aos filtros.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader><CardContent className="space-y-2">{history.slice(0,50).map((job:any)=><div key={job.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><span>{links.find(l=>l.id===job.event_collaborator_id)?.collaborator_name||'Fiscal'} · {job.communication_type}</span><span>{statusLabel[job.status]||job.status} · tentativa {job.attempt_count}</span></div>)}{!history.length&&<p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>}</CardContent></Card>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Prévia do envio</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Tipo</Label><p>{type==='confirmation_request'?'Solicitação de confirmação':'Mensagem geral do evento'}</p></div><div><Label>Destinatários</Label><p>{selected.length}</p></div><div><Label>Modo</Label><p className="font-semibold">{config?.mode==='test'?'TESTE':'PRODUÇÃO'}</p></div>{config?.mode==='test'&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Os e-mails NÃO serão enviados aos fiscais reais. Nesta execução, no máximo {config.testBatchLimit} serão processados.</p>}<div><Label>Assunto</Label><Input value={subject} onChange={e=>setSubject(e.target.value)}/></div>
      <div><Label>Variáveis disponíveis</Label><div className="flex flex-wrap gap-1.5 pt-1">{VARIABLE_CHIPS.filter(chip=>!chip.confirmationOnly||type==='confirmation_request').map(chip=><Button key={chip.token} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={()=>insertVariable(chip.token)}>{chip.label}</Button>)}</div></div>
      <div><Label>Mensagem</Label><Textarea ref={templateRef} rows={12} value={template} onChange={e=>setTemplate(e.target.value)}/></div><div><Label>Exemplo renderizado</Label><p className="text-xs text-muted-foreground">Assunto: {previewSubject||'Selecione um destinatário.'}</p><pre className="max-h-64 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs">{preview||'Selecione um destinatário.'}</pre></div>{result&&<div className="rounded-lg border p-3 text-sm">Total: {result.total||0} · Enviados: {result.sent||0} · Falharam: {result.failed||0} · Sem e-mail: {result.missingRecipient||0} · Aguardando: {result.pending||0} · Aguardando cota diária: {result.quotaWaiting||0}</div>}</div><DialogFooter><Button variant="outline" onClick={()=>setDialog(false)}>Fechar</Button><Button onClick={submit} disabled={!canSend||!selected.length||send.isPending}>{send.isPending?'Processando...':'Confirmar envio'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
